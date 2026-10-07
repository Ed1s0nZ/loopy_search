import { createFrameAdapter } from './frame-adapter.js';
import { createVisionBrowser } from './vision-browser.js';
import { pageTool } from './page-tools.js';
import { assertWebUrl, fail } from './policy.js';
import { sanitizeObservation } from './privacy.js';
import { validateTabIds, assertScopedTab, tabSummary } from './scope.js';

export function createBrowserTools(api) {
  const documents = new Map();
  const frameSummarySafe = (raw, secrets) => ({ frameId: raw.frameId || 0, url: /^about:(blank|srcdoc)$/.test(raw.pageUrl) ? '[嵌入文档]' : sanitizeObservation(raw, secrets).url });
  async function check(tabId, scope, loading = false) {
    let tab;
    try { tab = await api.tabs.get(tabId); } catch { throw fail('PAGE_UNAVAILABLE', '目标标签页已关闭或不可访问'); }
    const inspected = loading && tab.pendingUrl ? { ...tab, url: tab.pendingUrl } : tab;
    try { assertWebUrl(inspected.url); } catch { throw fail('PAGE_UNAVAILABLE', '无法操作此页面；请打开普通 HTTP(S) 网页'); }
    if (scope) assertScopedTab(scope, inspected);
    return tab;
  }
  const stopped = signal => { if (signal?.aborted) throw fail('STOPPED', '任务已停止'); };
  async function ready(tabId, signal, scope) {
    for (let i = 0; i < 40; i++) {
      stopped(signal);
      const tab = await check(tabId, scope, true);
      if (tab.status === 'complete' && !tab.pendingUrl) return tab;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw fail('TIMEOUT', '页面尚未加载完成，请稍后重新开始');
  }
  const frames = createFrameAdapter(api, { checkTab: check });
  async function invoke(tabId, command, args, signal, scope, authorize = () => {}, frameId = 0, documentId) {
    await ready(tabId, signal, scope); stopped(signal); authorize();
    const frame = frameId ? await frames.check(tabId, frameId, scope) : null;
    const target = { tabId, ...(documentId || frame?.documentId ? { documentIds: [documentId || frame.documentId] } : frameId ? { frameIds: [frameId] } : {}) };
    return frames.visible(tabId, frameId, async () => {
    let results;
    try {
      await api.scripting.executeScript({ target, world: 'ISOLATED', files: ['assistant/dom-runtime.js'] });
      if (frameId && !['document', 'observe'].includes(command)) {
        const visibility = await api.scripting.executeScript({ target, world: 'ISOLATED', func: pageTool, args: ['visibility', { ...args, _embedded: true }] });
        if (!visibility[0]?.result?.ok) throw fail(visibility[0]?.result?.code || 'FRAME_HIDDEN', '框架隐藏或不可见');
      }
      stopped(signal); authorize();
      results = await api.scripting.executeScript({ target, world: 'ISOLATED', func: pageTool, args: [command, { ...args, _embedded: Boolean(frameId) }] }); }
    catch (error) { if (error.code) throw error; throw fail(documentId ? 'STALE_SNAPSHOT' : 'PAGE_UNAVAILABLE', documentId ? '目标文档已经变化，请重新观察' : '无法访问页面；请检查扩展站点权限'); }
    const result = results?.[0]?.result;
    if (!result?.ok) throw fail(result?.code ?? 'PAGE_UNAVAILABLE', result?.error ?? '页面观察失败');
    return { ...result, frameId, chromeDocumentId: results[0].documentId };
    });
  }
  function record(tab, raw) {
    if (!raw.documentToken || !raw.frameId && raw.pageUrl !== tab.url) throw fail('STALE_SNAPSHOT', '页面在观察过程中发生变化，请重试');
    const key = `${tab.id}|${raw.frameId || 0}|${raw.chromeDocumentId || raw.documentToken}|${raw.pageUrl}`;
    const saved = { key, tabId: tab.id, frameId: raw.frameId || 0, url: raw.pageUrl, title: tab.title, windowId: tab.windowId,
      incognito: Boolean(tab.incognito), token: raw.documentToken, chromeDocumentId: raw.chromeDocumentId };
    documents.set(key, saved);
    if (documents.size > 64) documents.delete(documents.keys().next().value);
    return saved;
  }
  async function source(tabId, key, signal, scope) {
    const saved = documents.get(key); const tab = await check(tabId, scope);
    const frame = saved?.frameId ? await frames.check(tabId, saved.frameId, scope) : null;
    if (!saved || saved.tabId !== tab.id || saved.url !== (frame?.url || tab.url) || saved.windowId !== tab.windowId || saved.incognito !== Boolean(tab.incognito)) throw fail('STALE_SNAPSHOT', '目标文档或窗口已经变化');
    const raw = await invoke(tabId, 'document', { _documentToken: saved.token, _expectedUrl: saved.url }, signal, scope, () => {}, saved.frameId, saved.chromeDocumentId);
    if (raw.chromeDocumentId !== saved.chromeDocumentId) throw fail('STALE_SNAPSHOT', '目标页面已经重载');
    return saved;
  }
  const vision = createVisionBrowser(api, { ready, check, source });
  return {
    vision, frames,
    async prepareScope(tabId, tabIds, secrets, incognito) {
      const ids = validateTabIds(tabId, tabIds); const tabs = await Promise.all(ids.map(id => check(id)));
      const initial = tabs.find(tab => tab.id === tabId);
      if (Boolean(initial.incognito) !== Boolean(incognito ?? api.extension?.inIncognitoContext)) throw fail('SCOPE', '不能跨普通/无痕环境执行任务');
      if (tabs.some(tab => tab.windowId !== initial.windowId || Boolean(tab.incognito) !== Boolean(initial.incognito))) throw fail('SCOPE', '任务标签必须位于同一窗口和同一环境');
      return { windowId: initial.windowId, incognito: Boolean(initial.incognito), tabs: tabs.map(tab => tabSummary(tab, secrets)) };
    },
    async listScope(scope, secrets) {
      const tabs = await Promise.all(scope.tabs.map(tab => check(tab.id, scope)));
      return tabs.map(tab => tabSummary(tab, secrets));
    },
    async observe(tabId, secrets, signal, scope, frameId = 0) {
      await check(tabId, scope);
      const raw = await invoke(tabId, 'observe', {}, signal, scope, () => {}, frameId);
      if (frameId && (await frames.check(tabId, frameId, scope)).documentId !== raw.chromeDocumentId) throw fail('STALE_SNAPSHOT', '子框架在观察过程中重载');
      const saved = record(await check(tabId, scope), raw);
      return { ...sanitizeObservation(raw, secrets), ...(/^about:(blank|srcdoc)$/.test(raw.pageUrl) ? { url: '[嵌入文档]' } : {}), documentKey: saved.key, frameId, frame: frameSummarySafe(raw, secrets) };
    },
    async execute(tabId, action, signal, expectedDocument, scope, authorize = () => {}) {
      const saved = await source(tabId, expectedDocument, signal, scope);
      stopped(signal); authorize();
      if (action.tool === 'navigate') {
        const url = assertWebUrl(action.args.url).href;
        await api.tabs.update(tabId, { url }); await ready(tabId, signal, scope);
        return { ok: true, message: '导航完成' };
      }
      return invoke(tabId, action.tool, { ...action.args, _documentToken: saved.token, _expectedUrl: saved.url }, signal, scope, authorize, saved.frameId, saved.chromeDocumentId);
    },
    async openTab(tabId, url, scope, signal, expectedDocument, authorize) {
      await source(tabId, expectedDocument, signal, scope); stopped(signal); authorize();
      const tab = await api.tabs.create({ windowId: scope.windowId, url: assertWebUrl(url).href, active: false });
      await ready(tab.id, signal);
      return tab.id;
    },
    async describeTab(tabId, scope, signal) {
      const tab = await check(tabId, scope);
      const raw = await invoke(tabId, 'document', {}, signal, scope);
      return record(await check(tab.id, scope), raw);
    },
    async closeTab(tabId, target, scope, signal, authorize) {
      await source(tabId, target.key, signal, scope);
      const tab = await check(tabId, scope);
      if (target.title !== tab.title) throw fail('STALE_SNAPSHOT', '关闭目标的标题已经变化，请重新检查');
      stopped(signal); authorize(); await api.tabs.remove(tabId);
    }
  };
}
