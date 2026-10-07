const toolNames = { click: '点击', fill: '填写', select: '选择' };
export function createScopeUI(root = document) {
  const $ = id => root.getElementById(id);
  let tabs = []; const selected = new Set(); let previewId;
  function renderTabs() {
    const target = Number($('target').value); $('scopeTabs').replaceChildren();
    for (const tab of tabs) {
      const label = document.createElement('label'); label.className = 'check scope-option';
      const input = document.createElement('input'); input.type = 'checkbox'; input.value = tab.id;
      input.checked = tab.id === target || selected.has(tab.id); input.disabled = tab.id === target;
      input.dataset.current = String(tab.id === target);
      input.addEventListener('change', () => { if (input.checked) selected.add(tab.id); else selected.delete(tab.id); });
      const text = document.createElement('span'); text.textContent = `${tab.title} · ${tab.url}`;
      label.append(input, text); $('scopeTabs').append(label);
    }
  }
  $('target').addEventListener('change', renderTabs);
  function setTabs(next) {
    tabs = next;
    for (const id of selected) if (!tabs.some(tab => tab.id === id)) selected.delete(id);
    renderTabs();
  }
  function render(state, busy, scopeLocked = busy) {
    for (const input of $('scopeTabs').querySelectorAll('input')) input.disabled = scopeLocked || input.dataset.current === 'true';
    const current = state.scope?.find(tab => tab.id === state.tabId);
    $('currentTarget').textContent = current ? `任务当前页：${current.title} · #${state.tabId}；本次范围 ${state.scope.length} 页` : '';
    $('automationOptions').hidden = state.mode !== 'auto' || state.status !== 'preview';
    if (state.preview?.id !== previewId) {
      previewId = state.preview?.id; $('autoGrants').replaceChildren(); $('autoLimit').value = '3'; $('autoAcknowledge').checked = false;
      if (state.mode === 'auto' && state.preview) for (const element of state.preview.elements) {
        const row = document.createElement('fieldset'); row.className = 'grant-row';
        const legend = document.createElement('legend'); legend.textContent = `${element.id} · ${element.label || element.tag}`; row.append(legend);
        for (const tool of element.capabilities ?? []) {
          const label = document.createElement('label'); label.className = 'check';
          const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.element = element.id; input.dataset.tool = tool;
          label.append(input, document.createTextNode(toolNames[tool])); row.append(label);
        }
        $('autoGrants').append(row);
      }
    }
    for (const input of $('automationOptions').querySelectorAll('input')) input.disabled = busy;
    const automation = state.automation;
    $('automationStatus').textContent = state.mode === 'auto' ? `自动授权剩余 ${automation?.remaining ?? 0} 次；导航、新开和关闭标签仍逐次确认。` : '';
    $('revokeAutomation').hidden = !automation?.active;
    $('approvePreview').textContent = state.mode === 'auto' ? '批准发送及选定的自动授权' : '批准发送并开始';
  }
  function approval(mode) {
    if (mode !== 'auto') return undefined;
    const grants = [...$('autoGrants').querySelectorAll('input:checked')].map(input => ({ elementId: input.dataset.element, tool: input.dataset.tool }));
    if (grants.length && !$('autoAcknowledge').checked) throw new Error('请勾选同意所选元素的自动操作，或取消自动权限');
    return { grants, limit: Number($('autoLimit').value), acknowledged: $('autoAcknowledge').checked };
  }
  return { setTabs, render, approval, tabIds: () => [...new Set([Number($('target').value), ...selected])] };
}
