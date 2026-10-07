// Serialized by chrome.scripting; keep this function entirely self-contained.
export async function pageTool(command, args = {}) {
  const dom = globalThis.__loopyDOMRuntime;
  const error = (code, message) => ({ ok: false, code, error: message });
  const redact = value => String(value ?? '')
    .replace(/\b(?:sk|ghp|gho|github_pat)[-_][A-Za-z0-9_-]{12,}\b/g, '[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED JWT]')
    .replace(/((?:api[_ -]?key|password|passwd|secret|access[_ -]?token|authorization|密码|密钥)\s*[=:：]\s*)[^\s,;"<>]+/gi, '$1[REDACTED]');
  const safeUrl = value => {
    try {
      const url = new URL(value, location.href);
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      url.username = ''; url.password = ''; url.search = ''; url.hash = '';
      return redact(url.href);
    } catch { return ''; }
  };
  const label = element => [element.getAttribute('aria-label'),
    [...(element.labels ?? [])].map(item => item.textContent).join(' '),
    element.getAttribute('placeholder'), element.getAttribute('title'),
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) ? '' : dom ? dom.labelText(element) : element.textContent
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, 180);
  const sensitive = element => /password|passwd|secret|token|api.?key|authorization|credit.?card|card.?number|cvv|otp|one.?time|密码|密钥|验证码/i
    .test([element.type, element.name, element.id, element.autocomplete, label(element), ...(dom ? dom.ancestors(element).slice(1).map(host => [host.id, host.getAttribute('aria-label'), host.getAttribute('name')].join(' ')) : [])].join(' '));
  const visible = element => {
    if (dom) return dom.visible(element);
    if (!element.isConnected || !element.getClientRects().length || element.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
    for (let parent = element; parent && parent.nodeType === 1; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    }
    return true;
  };
  const stateKey = '__loopyAssistantPage_v2';
  let state = globalThis[stateKey];
  if (!state) {
    state = { revision: 0, refs: new Map(), identities: new WeakMap(), documentToken: crypto.randomUUID(), snapshotId: null, url: null };
    state.observer = new MutationObserver(() => state.revision++);
    state.observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    globalThis[stateKey] = state;
  }
  if (state.observer.takeRecords().length) state.revision++;
  let tree;
  try { tree = dom?.refresh(state); } catch (failure) { return error(failure.code || 'DOCUMENT_LIMIT', failure.message); }
  if (args._embedded && ['observe', 'visibility'].includes(command)) {
    const displayed = await new Promise(resolve => {
      const timer = setTimeout(() => { observer.disconnect(); resolve(false); }, 700);
      const observer = new IntersectionObserver(entries => { clearTimeout(timer); observer.disconnect(); resolve(entries.some(entry => entry.isIntersecting)); });
      observer.observe(document.documentElement);
    });
    if (!displayed) return error('FRAME_HIDDEN', '框架隐藏或离屏，请先在页面中显示它');
    try { tree = dom?.refresh(state); } catch (failure) { return error('DOCUMENT_LIMIT', failure.message); }
  }
  if (args._documentToken && (args._documentToken !== state.documentToken || args._expectedUrl !== location.href)) return error('STALE_SNAPSHOT', '目标文档已经变化，未执行操作');
  if (command === 'visibility' || command === 'document') return { ok: true, documentToken: state.documentToken, pageUrl: location.href };
  const fingerprint = element => JSON.stringify({
    tag: element.tagName, label: label(element), type: element.type,
    href: element.getAttribute('href'), name: element.name, id: element.id, handler: element.getAttribute('onclick'),
    form: element.closest('form') ? [element.closest('form').action, element.closest('form').method, element.closest('form').target] : null,
    options: element.options ? [...element.options].map(option => [option.value, option.textContent, option.disabled]) : null
  });
  if (command === 'observe') {
    state.refs.clear();
    state.snapshotId = crypto.randomUUID(); state.url = location.href;
    const elements = [];
    const selector = 'a[href],button,input,textarea,select,[role="button"],[role="link"],[contenteditable="true"]';
    const candidates = tree ? tree.elements.filter(element => element.matches(selector)) : document.querySelectorAll(selector);
    for (const element of candidates) {
      if (elements.length >= 80) break;
      if (!visible(element) || element.disabled || element.getAttribute('aria-disabled') === 'true' || element.readOnly || sensitive(element) || ['hidden', 'file'].includes(element.type)) continue;
      if (element.tagName === 'A' && (!safeUrl(element.href) || element.hasAttribute('download'))) continue;
      const id = `e${elements.length + 1}`;
      const signature = fingerprint(element);
      let identity = state.identities.get(element);
      if (!identity || identity.signature !== signature) {
        identity = { signature, grantId: crypto.randomUUID() }; state.identities.set(element, identity);
      }
      const capabilities = ['click'];
      if (element.tagName === 'SELECT') capabilities.push('select');
      if (element.tagName === 'TEXTAREA' || element.isContentEditable || element.tagName === 'INPUT' && ['text', 'search', 'url', 'email', 'tel', 'number'].includes(element.type)) capabilities.push('fill');
      state.refs.set(id, { element, fingerprint: signature });
      elements.push({ id, grantId: identity.grantId, capabilities, tag: element.tagName.toLowerCase(), type: element.type ?? '', label: redact(label(element)),
        ...(element.tagName === 'A' ? { href: safeUrl(element.href) } : {}),
        ...(element.tagName === 'SELECT' ? { options: [...element.options].filter(option => !option.disabled).slice(0, 30)
          .map(option => ({ value: redact(option.value), label: redact(option.textContent) })) } : {}) });
    }
    // Text nodes only: no input values, scripts, hidden nodes or sensitive regions.
    const walker = tree ? (() => { let index = 0; return { nextNode: () => tree.textNodes[index++] }; })() : document.createTreeWalker(document.body ?? document.documentElement, NodeFilter.SHOW_TEXT);
    const pieces = []; let length = 0; let visited = 0; let node;
    while ((node = walker.nextNode()) && length < 12000 && visited++ < 30000) {
      const parent = node.parentElement;
      if (dom ? !dom.textVisible(node) : !parent || parent.closest('script,style,noscript,template,input,textarea,select,[contenteditable],svg') || !visible(parent)) continue;
      const text = node.textContent.replace(/\s+/g, ' ').trim();
      if (text) { pieces.push(text); length += text.length + 1; }
    }
    state.observedRevision = state.revision;
    return { ok: true, documentToken: state.documentToken, pageUrl: location.href, snapshotId: state.snapshotId, url: safeUrl(location.href),
      title: redact(document.title), shadowRoots: tree?.hosts.length ?? 0, coverage: tree ? '当前文档可见 DOM，含开放/闭合 Shadow DOM 与 slot；不含输入值' : '当前文档顶层 DOM', text: redact(pieces.join('\n').slice(0, 12000)), elements };
  }
  if (command === 'scroll') {
    if (!['up', 'down'].includes(args.direction) || !Number.isInteger(args.amount ?? 600) || (args.amount ?? 600) < 100 || (args.amount ?? 600) > 1200) return error('INVALID_ACTION', '无效滚动参数');
    window.scrollBy({ top: (args.direction === 'up' ? -1 : 1) * (args.amount ?? 600), behavior: 'instant' });
    return { ok: true, message: '已滚动，需重新观察' };
  }
  if (!['click', 'fill', 'select'].includes(command)) return error('INVALID_ACTION', '未知页面工具');
  try { dom?.refresh(state); } catch (failure) { return error('DOCUMENT_LIMIT', failure.message); }
  if (args.snapshotId !== state.snapshotId || state.observedRevision !== state.revision || state.url !== location.href) return error('STALE_SNAPSHOT', '页面已经变化，请重新观察后再确认');
  const reference = state.refs.get(args.elementId);
  const element = reference?.element;
  if (!element || !visible(element) || element.disabled || element.getAttribute('aria-disabled') === 'true' || element.readOnly || sensitive(element) || reference.fingerprint !== fingerprint(element)) return error('STALE_SNAPSHOT', '目标元素不可用或发生变化');
  if (command === 'click') {
    if (['file', 'password', 'hidden'].includes(element.type) || element.hasAttribute('download') || element.tagName === 'A' && !safeUrl(element.href)) return error('BLOCKED', '不允许此类点击');
    // Navigation stays in the authorized tab; sites may still open their own popups.
    if (element.tagName === 'A' && element.target && element.target !== '_self') return error('BLOCKED', '此链接将打开其他窗口，请手动操作');
    element.scrollIntoView({ block: 'center' }); element.click();
  } else if (command === 'fill') {
    if (typeof args.value !== 'string' || args.value.length > 4000) return error('INVALID_ACTION', '无效输入值');
    const types = ['text', 'search', 'url', 'email', 'tel', 'number'];
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT' && types.includes(element.type)) {
      const proto = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (!setter) return error('BLOCKED', '无法写入此字段');
      element.focus(); setter.call(element, args.value);
    } else if (element.isContentEditable) { element.focus(); element.textContent = args.value; }
    else return error('BLOCKED', '只允许普通文本输入');
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    if (element.tagName !== 'SELECT' || typeof args.value !== 'string' || ![...element.options].some(option => option.value === args.value && !option.disabled)) return error('BLOCKED', '只能选择当前存在的可用选项');
    element.value = args.value; element.dispatchEvent(new Event('change', { bubbles: true }));
  }
  state.snapshotId = null;
  return { ok: true, message: '已执行页面动作，需重新观察确认结果' };
}
