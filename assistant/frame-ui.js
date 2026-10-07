export function createFrameUI({ request, guarded, root = document }) {
  const $ = id => root.getElementById(id); let catalog = []; const chosen = new Set([0]);
  function reset() { catalog = []; chosen.clear(); chosen.add(0); $('frameChoices').replaceChildren(); $('frameHint').textContent = '默认只访问顶层文档，加载列表不会读取 iframe 正文。'; }
  function draw() {
    $('frameChoices').replaceChildren();
    for (const frame of catalog) {
      const label = document.createElement('label'); label.className = 'check scope-option';
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = chosen.has(frame.frameId); checkbox.disabled = frame.frameId === 0; checkbox.dataset.frameId = frame.frameId;
      checkbox.addEventListener('change', () => {
        if (checkbox.checked && chosen.size >= 16) { checkbox.checked = false; $('frameHint').textContent = '最多选择 16 个框架（含顶层），请先取消其他选择。'; return; }
        if (checkbox.checked) chosen.add(frame.frameId); else chosen.delete(frame.frameId);
      });
      label.append(checkbox, document.createTextNode(`#${frame.frameId} · ${frame.url}`)); $('frameChoices').append(label);
    }
    $('frameHint').textContent = '最多 16 个框架；未选框架正文不读取。框架操作会短暂激活目标页并恢复原活动页；隐藏/离屏时拒绝，请先显示它。';
  }
  $('target').addEventListener('change', reset);
  $('loadFrames').addEventListener('click', () => {
    // Called directly from the click gesture, before awaiting anything.
    void guarded(async () => {
      const permission = chrome.permissions.request({ permissions: ['webNavigation'] });
      if (!await permission) throw new Error('框架权限未允许；顶层任务仍可用');
      const next = await request('assistant:frames', { tabId: Number($('target').value) });
      catalog = next; chosen.clear(); chosen.add(0); draw();
    });
  });
  chrome.permissions.onRemoved.addListener(removed => {
    if (removed.permissions?.includes('webNavigation')) { reset(); $('frameHint').textContent = '框架权限已撤销；重新加载列表可再次申请，顶层任务仍可用。'; }
  });
  reset();
  return {
    reset,
    selection: () => ({ frameIds: [...chosen], frameDocuments: catalog.filter(frame => chosen.has(frame.frameId)).map(frame => ({ frameId: frame.frameId, documentId: frame.documentId })) }),
    render(state, locked) {
      $('loadFrames').disabled = locked; for (const input of $('frameChoices').querySelectorAll('input')) input.disabled = locked || input.dataset.frameId === '0';
      $('currentFrame').textContent = state.id ? `当前任务框架：#${state.frameId ?? 0}；导航作用于整个标签，子框架不使用顶层视觉坐标。` : '';
    }
  };
}
