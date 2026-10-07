// Classic bootstrap installed in the extension's isolated world for each document.
(() => {
  if (globalThis.__loopyDOMRuntime) return;
  let distributed = new WeakMap();
  const parent = element => element.assignedSlot || distributed.get(element) || element.parentElement || element.getRootNode()?.host || null;
  const root = element => {
    if (/^(INPUT|TEXTAREA|SELECT|VIDEO|AUDIO|IMG|IFRAME|OBJECT|EMBED)$/.test(element.tagName)) return null;
    try { return chrome.dom?.openOrClosedShadowRoot(element) || element.shadowRoot; } catch { return element.shadowRoot; }
  };
  const ancestors = element => { const result = []; for (let node = element; node; node = parent(node)) { if (result.includes(node)) break; result.push(node); } return result; };
  const within = (element, selector) => ancestors(element).some(node => node.matches(selector));
  const sensitiveRegion = element => ancestors(element).some(node => /password|passwd|secret|token|api.?key|authorization|credit.?card|cvv|otp|密码|密钥|验证码/i.test([node.id, node.getAttribute('name'), node.getAttribute('aria-label'), node.getAttribute('autocomplete')].join(' ')));
  const styledVisible = element => !ancestors(element).some(node => {
    if (node.matches('[hidden],[inert],[aria-hidden="true"]')) return true;
    const css = getComputedStyle(node); return css.display === 'none' || ['hidden', 'collapse'].includes(css.visibility) || css.opacity === '0';
  });
  const visible = element => Boolean(element?.isConnected && element.getClientRects().length && styledVisible(element));
  const textVisible = node => {
    const element = node.parentElement || node.getRootNode()?.host;
    if (!element || !styledVisible(element) || within(element, 'script,style,noscript,template,input,textarea,select,[contenteditable],svg')) return false;
    const range = document.createRange(); range.selectNodeContents(node); return Boolean(range.getClientRects().length);
  };
  const labelText = element => {
    const queue = [element]; const seen = new Set(); const pieces = []; let size = 0;
    for (let index = 0; index < queue.length && index < 1000 && size < 180; index++) {
      const node = queue[index]; if (seen.has(node)) continue; seen.add(node);
      if (node.nodeType === 3 && textVisible(node)) { pieces.push(node.textContent); size += node.textContent.length; }
      if (node.nodeType === 1 && /^(INPUT|TEXTAREA|SELECT|SCRIPT|STYLE)$/.test(node.tagName)) continue;
      if (node.nodeType === 1 && node.tagName === 'SLOT' && node.assignedNodes().length) queue.push(...node.assignedNodes({ flatten: true }));
      else queue.push(...node.childNodes);
      if (node.nodeType === 1) { const shadow = root(node); if (shadow) queue.push(shadow); }
    }
    return pieces.join(' ').replace(/\s+/g, ' ').trim().slice(0, 180);
  };
  function refresh(state) {
    if (state.observer.takeRecords().length) state.revision++;
    const roots = [document]; const elements = []; const textNodes = []; const hosts = []; let visited = 0;
    for (let index = 0; index < roots.length; index++) {
      const walker = document.createTreeWalker(roots[index], NodeFilter.SHOW_ALL); let node;
      while ((node = walker.nextNode())) {
        if (++visited > 30000) throw Object.assign(new Error('页面结构超过 30000 节点，请缩小页面范围'), { code: 'DOCUMENT_LIMIT' });
        if (node.nodeType === 3) textNodes.push(node);
        if (node.nodeType !== 1) continue;
        elements.push(node); const shadow = root(node);
        if (shadow && !roots.includes(shadow)) {
          roots.push(shadow); hosts.push(node);
          if (roots.length > 65) throw Object.assign(new Error('页面影子根超过 64 个，请缩小页面范围'), { code: 'DOCUMENT_LIMIT' });
        }
      }
    }
    distributed = new WeakMap();
    for (const element of elements) if (element.tagName === 'SLOT') {
      for (const node of element.assignedNodes()) distributed.set(node, element);
    }
    if (!state.domRoots || roots.length !== state.domRoots.length || roots.some(item => !state.domRoots.includes(item))) {
      state.revision++; state.observer.disconnect();
      for (const target of roots) state.observer.observe(target, { subtree: true, childList: true, attributes: true, characterData: true });
      state.domRoots = roots;
    }
    const tree = { roots, elements, textNodes, hosts }; state.domTree = tree; return tree;
  }
  globalThis.__loopyDOMRuntime = { parent, root, ancestors, within, sensitiveRegion, visible, textVisible, labelText, refresh };
})();
