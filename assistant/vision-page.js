// Self-contained isolated-world probe. No credentials are injected into the page.
export function visionPage(command, args = {}) {
  const error = (code, message) => ({ ok: false, code, error: message });
  const state = globalThis.__loopyAssistantPage_v2;
  if (!state) return error('STALE_SNAPSHOT', '请先观察页面');
  let tree; try { tree = globalThis.__loopyDOMRuntime?.refresh(state); } catch { return error('DOCUMENT_LIMIT', '页面结构超过预算'); }
  if (state.observer.takeRecords().length) state.revision++;
  const viewport = { width: innerWidth, height: innerHeight, scrollX, scrollY, dpr: devicePixelRatio };
  const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
  const visible = element => {
    if (!element?.isConnected || !element.getClientRects().length || element.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
    for (let node = element; node?.nodeType === 1; node = node.parentElement) {
      const css = getComputedStyle(node); if (css.display === 'none' || css.visibility === 'hidden' || css.opacity === '0') return false;
    }
    const r = rect(element); return r.width > 0 && r.height > 0 && r.x < innerWidth && r.y < innerHeight && r.x + r.width > 0 && r.y + r.height > 0;
  };
  const signature = element => JSON.stringify({ tag: element.tagName, label: (element.getAttribute('aria-label') || element.textContent || element.title || '').slice(0, 180),
    type: element.type, href: element.getAttribute('href'), target: element.getAttribute('target'), name: element.name, id: element.id,
    handler: element.getAttribute('onclick'), form: element.closest('form') ? [element.closest('form').action, element.closest('form').method, element.closest('form').target] : null, rect: rect(element) });
  const masks = []; const textRects = []; const layout = [];
  let overflow = false;
  const allNodes = tree?.elements ?? [...document.querySelectorAll('*')];
  for (const element of allNodes.filter(element => element.matches('input,textarea,select,[contenteditable],iframe,img,video,object,embed'))) {
    if (visible(element)) masks.push(rect(element)); if (masks.length > 1000) { overflow = true; break; }
  }
  if (allNodes.length > 30000) overflow = true;
  else for (const element of allNodes) {
    if ((globalThis.__loopyDOMRuntime?.root(element) || element.shadowRoot || element.tagName.includes('-')) && visible(element)) masks.push(rect(element));
    if (masks.length > 1000) { overflow = true; break; }
  }
  const walker = tree ? (() => { let index = 0; return { nextNode: () => tree.textNodes[index++] }; })() : document.createTreeWalker(document.body ?? document.documentElement, NodeFilter.SHOW_TEXT);
  let node; let count = 0;
  while ((node = walker.nextNode())) {
    if (++count > 30000 || textRects.length > 1000) { overflow = true; break; }
    const parent = node.parentElement;
    if (!parent || (tree ? !globalThis.__loopyDOMRuntime.textVisible(node) : parent.closest('script,style,noscript,template,input,textarea,select,[contenteditable],svg')) || !visible(parent) || !node.textContent.trim()) continue;
    const range = document.createRange(); range.selectNodeContents(node); const bounds = range.getBoundingClientRect(); const container = rect(parent);
    const x = Math.min(bounds.x, container.x), y = Math.min(bounds.y, container.y);
    const area = { x, y, width: Math.max(bounds.right, container.x + container.width) - x, height: Math.max(bounds.bottom, container.y + container.height) - y };
    if (node.textContent.length > 16000 || globalThis.__loopyDOMRuntime?.sensitiveRegion(parent)) masks.push(area);
    else textRects.push({ text: node.textContent, ...area });
  }
  for (const element of document.querySelectorAll('button,a[href],input,textarea,select,[role="button"],[role="link"],canvas')) {
    if (visible(element)) layout.push(signature(element)); if (layout.length > 1000) { overflow = true; break; }
  }
  const probe = { ok: true, documentToken: state.documentToken, pageUrl: location.href, revision: state.revision, viewport, masks, textRects, overflow,
    layoutKey: JSON.stringify([masks, textRects, layout]) };
  if (command === 'probe') return probe;
  if (args.documentToken !== state.documentToken || args.pageUrl !== location.href || args.revision !== state.revision || args.layoutKey !== probe.layoutKey || Object.keys(viewport).some(key => args.viewport?.[key] !== viewport[key])) return error('STALE_SNAPSHOT', '截图对应的页面或视口已经变化');
  const { x, y } = args;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return error('INVALID_ACTION', '坐标不在当前截图视口');
  const hit = document.elementFromPoint(x, y);
  const element = hit?.closest('button,a[href],input,textarea,select,[role="button"],[role="link"],canvas');
  if (!visible(element) || element.disabled || element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true' || element.readOnly || element.closest('input,textarea,select,[contenteditable],iframe,object,embed') || element.hasAttribute('download')) return error('BLOCKED', '目标不是可见可操作区域或属于遮挡区域');
  if (element.tagName === 'A') {
    try { const url = new URL(element.href); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || element.target && element.target !== '_self') return error('BLOCKED', '不允许此链接操作'); } catch { return error('BLOCKED', '无效链接'); }
  }
  if (command === 'resolve') {
    state.visionTarget = { token: crypto.randomUUID(), element, signature: signature(element) };
    return { ok: true, token: state.visionTarget.token, label: (element.getAttribute('aria-label') || element.textContent || element.title || element.tagName).slice(0, 180), tag: element.tagName.toLowerCase(), x, y };
  }
  if (command !== 'click' || state.visionTarget?.token !== args.targetToken || state.visionTarget.element !== element || state.visionTarget.signature !== signature(element)) return error('STALE_SNAPSHOT', '截图点击目标已经变化');
  state.visionTarget = null;
  for (const type of ['mousedown', 'mouseup', 'click']) {
    if (!element.isConnected) break;
    element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0, buttons: type === 'mousedown' ? 1 : 0 }));
  }
  state.snapshotId = null;
  return { ok: true, message: '已派发合成坐标点击；需检查新观察确认结果' };
}
