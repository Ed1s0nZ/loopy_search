import { fail, assertWebUrl } from './policy.js';
import { publicUrl, redactText } from './privacy.js';
export function validateFrameIds(ids = [0]) {
  if (!Array.isArray(ids) || !ids.includes(0) || ids.length > 16 || ids.some(id => !Number.isInteger(id) || id < 0) || new Set(ids).size !== ids.length) throw fail('FRAME_SCOPE', '请选择顶层和最多 16 个不同框架');
  return [...ids];
}
export const frameSummary = (frame, secrets = []) => ({ frameId: frame.frameId, parentFrameId: frame.parentFrameId,
  url: redactText(/^about:(blank|srcdoc)$/.test(frame.url) ? '[嵌入文档]' : publicUrl(frame.url), secrets) });
export function createFrameAdapter(api, { checkTab }) {
  async function permission() {
    if (!await api.permissions?.contains({ permissions: ['webNavigation'] })) throw fail('FRAME_PERMISSION', '请在助手中加载框架列表并允许框架权限');
  }
  function eligible(frame, all) {
    const seen = new Set(); let current = frame;
    while (current && /^about:(blank|srcdoc)$/.test(current.url)) {
      if (seen.has(current.frameId)) return false; seen.add(current.frameId);
      current = all.find(item => item.frameId === current.parentFrameId);
    }
    try { assertWebUrl(current?.url); return true; } catch { return false; }
  }
  async function catalog(tabId, scope) {
    await checkTab(tabId, scope); await permission();
    let frames; try { frames = await api.webNavigation.getAllFrames({ tabId }); } catch { throw fail('PAGE_UNAVAILABLE', '无法枚举框架，请等待页面加载完成'); }
    if (!frames || frames.length > 128) throw fail('DOCUMENT_LIMIT', '框架列表不可用或超过 128 个');
    return frames.filter(frame => !frame.errorOccurred && (!frame.documentLifecycle || frame.documentLifecycle === 'active') && eligible(frame, frames));
  }
  async function allowed(tabId, scope) {
    const range = scope.frameScopes?.[tabId];
    if (!range) return [{ frameId: 0, parentFrameId: -1, url: (await checkTab(tabId, scope)).url }];
    const frames = await catalog(tabId, scope); const root = frames.find(frame => frame.frameId === 0);
    if (!root) throw fail('PAGE_UNAVAILABLE', '顶层框架不可用');
    if (root.documentId !== range.rootDocumentId) { range.rootDocumentId = root.documentId; range.ids = [0]; }
    return frames.filter(frame => range.ids.includes(frame.frameId));
  }
  return {
    catalog,
    async prepare(tabId, frameIds, scope, expected) {
      const ids = validateFrameIds(frameIds); scope.frameScopes ??= {};
      if (ids.length === 1) { delete scope.frameScopes[tabId]; return; }
      const frames = await catalog(tabId, scope); const root = frames.find(frame => frame.frameId === 0);
      if (expected !== undefined && (!Array.isArray(expected) || expected.length !== ids.length || ids.some(id => { const choice = expected.find(item => item?.frameId === id); return !choice || frames.find(item => item.frameId === id)?.documentId !== choice.documentId; }))) throw fail('STALE_SNAPSHOT', '框架列表发生变化，请重新加载并选择');
      if (!root?.documentId || ids.some(id => !frames.some(frame => frame.frameId === id))) throw fail('FRAME_SCOPE', '框架不属于当前页面或不可访问，请重新加载列表');
      scope.frameScopes[tabId] = { rootDocumentId: root.documentId, ids };
    },
    async list(tabId, scope, secrets) { return (await allowed(tabId, scope)).map(frame => frameSummary(frame, secrets)); },
    async check(tabId, frameId, scope) {
      const frames = await allowed(tabId, scope); const frame = frames.find(item => item.frameId === frameId);
      if (!frame) throw fail('FRAME_SCOPE', '只能使用明确选定且仍属于当前父文档的框架');
      return frame;
    },
    async visible(tabId, frameId, callback) {
      if (!frameId) return callback();
      const tab = await checkTab(tabId); const [prior] = await api.tabs.query({ windowId: tab.windowId, active: true });
      try { await api.tabs.update(tabId, { active: true }); await api.windows.update(tab.windowId, { focused: true }); return await callback(); }
      finally { if (prior && prior.id !== tabId) { try { const [current] = await api.tabs.query({ windowId: tab.windowId, active: true }); if (current?.id === tabId) await api.tabs.update(prior.id, { active: true }); } catch { /* prior closed */ } } }
    }
  };
}
