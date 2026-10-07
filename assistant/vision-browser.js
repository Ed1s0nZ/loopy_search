import { visionPage } from './vision-page.js';
import { maskImage, validateMasks, blockedPoint } from './vision-image.js';
import { fail } from './policy.js';
import { redactText } from './privacy.js';

export function createVisionBrowser(api, bridge, { now = Date.now, image = maskImage } = {}) {
  let saved; let lastCapture = 0;
  const stopped = signal => { if (signal?.aborted) throw fail('STOPPED', '任务停止'); };
  async function probe(tabId, scope, signal, command = 'probe', args = {}, authorize = () => {}) {
    await bridge.ready(tabId, signal, scope); stopped(signal); authorize();
    let results;
    try { results = await api.scripting.executeScript({ target: { tabId }, world: 'ISOLATED', func: visionPage, args: [command, args] }); }
    catch { throw fail('CAPTURE', '无法访问截图页面，请检查站点权限'); }
    const result = results?.[0]?.result;
    if (!result?.ok) throw fail(result?.code ?? 'CAPTURE', result?.error ?? '视觉探测失败');
    return result;
  }
  async function active(tabId, windowId) {
    const [tab] = await api.tabs.query({ active: true, windowId });
    if (tab?.id !== tabId) throw fail('STALE_SNAPSHOT', '活动页已变化，截图被丢弃');
  }
  const same = (a, b) => a.documentToken === b.documentToken && a.pageUrl === b.pageUrl && a.revision === b.revision && a.layoutKey === b.layoutKey && JSON.stringify(a.viewport) === JSON.stringify(b.viewport);
  async function validate(tabId, imageId, scope, signal, documentKey) {
    if (!saved || saved.id !== imageId || saved.tabId !== tabId || now() >= saved.expires) throw fail('STALE_SNAPSHOT', '截图过期，请重新开始视觉任务');
    await bridge.source(tabId, documentKey, signal, scope);
    const current = await probe(tabId, scope, signal);
    if (!same(saved.probe, current)) throw fail('STALE_SNAPSHOT', '截图对应的页面或视口已经变化');
    return saved;
  }
  async function pixels(capture, scope, signal, documentKey) {
    const tab = await bridge.check(capture.tabId, scope); const [prior] = await api.tabs.query({ active: true, windowId: scope.windowId });
    try {
      await api.tabs.update(capture.tabId, { active: true }); await api.windows.update(tab.windowId, { focused: true });
      const delay = 550 - (now() - lastCapture); if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
      stopped(signal); await validate(capture.tabId, capture.id, scope, signal, documentKey); await active(capture.tabId, tab.windowId);
      lastCapture = now(); let raw;
      try { raw = await api.tabs.captureVisibleTab(tab.windowId, { format: 'png' }); } catch { throw fail('CAPTURE', '无法复核截图，请重新开始'); }
      stopped(signal); await active(capture.tabId, tab.windowId); await validate(capture.tabId, capture.id, scope, signal, documentKey);
      const base = await image(raw, capture.probe.viewport, capture.masks);
      const rendered = capture.extra.length ? await image(base.dataUrl, capture.probe.viewport, capture.extra, true) : base;
      stopped(signal);
      if (rendered.dataUrl !== capture.dataUrl) throw fail('STALE_SNAPSHOT', '页面像素已变化，未执行旧截图操作');
    } finally {
      if (prior && prior.id !== capture.tabId) {
        try { const [current] = await api.tabs.query({ active: true, windowId: tab.windowId }); if (current?.id === capture.tabId) await api.tabs.update(prior.id, { active: true }); } catch { /* prior may have closed */ }
      }
    }
  }
  return {
    async capture(tabId, scope, signal, documentKey, secrets = []) {
      saved = null;
      await bridge.source(tabId, documentKey, signal, scope); stopped(signal);
      const tab = await bridge.check(tabId, scope); const [prior] = await api.tabs.query({ active: true, windowId: scope.windowId });
      try {
        await api.tabs.update(tabId, { active: true }); await api.windows.update(tab.windowId, { focused: true });
        stopped(signal);
        const delay = 550 - (now() - lastCapture); if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
        stopped(signal); await bridge.source(tabId, documentKey, signal, scope); await active(tabId, tab.windowId);
        const before = await probe(tabId, scope, signal); lastCapture = now();
        let raw;
        try { raw = await api.tabs.captureVisibleTab(tab.windowId, { format: 'png' }); } catch { throw fail('CAPTURE', '截图失败，请检查权限或稍后重新开始'); }
        stopped(signal); await active(tabId, tab.windowId); await bridge.source(tabId, documentKey, signal, scope);
        const after = await probe(tabId, scope, signal);
        if (!same(before, after)) throw fail('STALE_SNAPSHOT', '页面在截图过程中变化，未发送图像');
        const masks = before.overflow ? [{ x: 0, y: 0, width: before.viewport.width, height: before.viewport.height }] :
          [...before.masks, ...before.textRects.filter(item => redactText(item.text, secrets) !== item.text).map(({ text, ...rect }) => rect)];
        const rendered = await image(raw, before.viewport, masks); stopped(signal);
        saved = { id: crypto.randomUUID(), tabId, probe: before, masks, extra: [], base: rendered.dataUrl, expires: now() + 60000, ...rendered };
        return this.view();
      } finally {
        if (prior && prior.id !== tabId) {
          try { const [current] = await api.tabs.query({ active: true, windowId: tab.windowId }); if (current?.id === tabId) await api.tabs.update(prior.id, { active: true }); } catch { /* prior may have closed */ }
        }
      }
    },
    view() { return saved ? { id: saved.id, dataUrl: saved.dataUrl, width: saved.width, height: saved.height, viewport: saved.probe.viewport, expires: saved.expires, maskedCount: saved.masks.length, masks: saved.extra } : null; },
    async mask(tabId, imageId, masks, scope, signal, documentKey) {
      const capture = await validate(tabId, imageId, scope, signal, documentKey);
      const extra = validateMasks(masks, capture.probe.viewport);
      const rendered = await image(capture.base, capture.probe.viewport, extra, true); stopped(signal);
      capture.extra = extra; Object.assign(capture, rendered); return this.view();
    },
    async resolve(tabId, action, scope, signal, documentKey, secrets = []) {
      const capture = await validate(tabId, action.args.imageId, scope, signal, documentKey);
      if (blockedPoint(action.args.x, action.args.y, [...capture.masks, ...capture.extra])) throw fail('BLOCKED', '不能点击截图遮挡区域');
      await pixels(capture, scope, signal, documentKey);
      const target = await probe(tabId, scope, signal, 'resolve', { ...capture.probe, ...action.args });
      return { privateToken: target.token, target: { label: redactText(target.label, secrets), tag: target.tag, x: target.x, y: target.y, synthetic: true } };
    },
    async execute(tabId, action, pending, scope, signal, documentKey, guard) {
      const capture = await validate(tabId, action.args.imageId, scope, signal, documentKey);
      if (!pending?.privateToken || blockedPoint(action.args.x, action.args.y, [...capture.masks, ...capture.extra])) throw fail('STALE_CONFIRMATION', '缺少有效的视觉点击确认');
      await pixels(capture, scope, signal, documentKey); stopped(signal); guard();
      return probe(tabId, scope, signal, 'click', { ...capture.probe, ...action.args, targetToken: pending.privateToken }, guard);
    },
    async verify(tabId, imageId, scope, signal, documentKey) {
      const capture = await validate(tabId, imageId, scope, signal, documentKey); await pixels(capture, scope, signal, documentKey);
    },
    clear() { saved = null; }
  };
}
