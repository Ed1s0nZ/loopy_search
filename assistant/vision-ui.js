export function createVisionUI({ root = document, apply }) {
  const $ = id => root.getElementById(id); let previewKey; let vision; let masks = []; let dirty = false; let start;
  const svgNS = 'http://www.w3.org/2000/svg';
  function draw() {
    $('visionOverlay').replaceChildren(); $('visionMaskList').replaceChildren();
    for (const [index, mask] of masks.entries()) {
      const rect = document.createElementNS(svgNS, 'rect');
      for (const key of ['x', 'y', 'width', 'height']) rect.setAttribute(key, mask[key]);
      rect.setAttribute('fill', '#182230'); $('visionOverlay').append(rect);
      const item = document.createElement('li'); item.textContent = `区域 ${index + 1}：${Math.round(mask.width)} × ${Math.round(mask.height)} `;
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '删除'; remove.setAttribute('aria-label', `删除遮挡区域 ${index + 1}`);
      remove.addEventListener('click', () => { masks.splice(index, 1); dirty = true; draw(); }); item.append(remove); $('visionMaskList').append(item);
    }
    $('visionMaskStatus').textContent = dirty ? '有未应用的遮挡，请应用后再批准发送。' : `自动遮挡 ${vision?.maskedCount ?? 0} 处，额外遮挡 ${masks.length} 处。拖拽图像添加区域。截图有效至 ${vision?.expires ? new Date(vision.expires).toLocaleTimeString() : "—"}。`;
    $('applyVisionMasks').disabled = !dirty;
  }
  function position(event) {
    const bounds = $('visionOverlay').getBoundingClientRect();
    return { x: Math.max(0, Math.min(vision.viewport.width, (event.clientX - bounds.left) * vision.viewport.width / bounds.width)),
      y: Math.max(0, Math.min(vision.viewport.height, (event.clientY - bounds.top) * vision.viewport.height / bounds.height)) };
  }
  $('visionOverlay').addEventListener('pointerdown', event => {
    if (!vision || event.button !== 0 || masks.length >= 32 || $('visionEditor').dataset.busy === 'true') return;
    start = position(event); $('visionOverlay').setPointerCapture(event.pointerId);
  });
  $('visionOverlay').addEventListener('pointerup', event => {
    if (!start || !vision) return;
    const end = position(event); const mask = { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(start.x - end.x), height: Math.abs(start.y - end.y) };
    start = null;
    if (mask.width >= 2 && mask.height >= 2) { masks.push(mask); dirty = true; draw(); }
  });
  $('visionOverlay').addEventListener('pointercancel', () => { start = null; });
  $('addVisionMask').addEventListener('click', () => {
    if (!vision) return;
    const mask = { x: Number($('maskX').value), y: Number($('maskY').value), width: Number($('maskWidth').value), height: Number($('maskHeight').value) };
    if (masks.length >= 32 || Object.values(mask).some(value => !Number.isFinite(value)) || mask.x < 0 || mask.y < 0 || mask.width <= 0 || mask.height <= 0 || mask.x + mask.width > vision.viewport.width || mask.y + mask.height > vision.viewport.height) {
      $('visionMaskStatus').textContent = '区域必须位于截图视口内，最多 32 个。'; return;
    }
    masks.push(mask); dirty = true; draw();
  });
  $('zoomVision').addEventListener('click', () => {
    if (dirty || start) { $('visionMaskStatus').textContent = '请先应用遮挡，再放大检查处理后的截图。'; return; }
    if (vision) { $('visionZoomImage').src = vision.dataUrl; $('visionZoom').showModal(); }
  });
  $('closeVisionZoom').addEventListener('click', () => $('visionZoom').close());
  $('applyVisionMasks').addEventListener('click', () => apply(masks));
  $('clearVisionMasks').addEventListener('click', () => { masks = []; dirty = true; draw(); });
  return {
    render(state, busy) {
      const next = state.preview?.vision; $('visionEditor').hidden = !next; $('visionEditor').dataset.busy = String(busy);
      const key = next ? `${next.id}|${state.preview.id}` : '';
      if (key !== previewKey) {
        $('visionZoom').close(); $('visionZoomImage').removeAttribute('src');
        previewKey = key; vision = next; masks = structuredClone(next?.masks ?? []); dirty = false; start = null;
        if (next) { $('maskWidth').value = Math.min(100, next.viewport.width); $('maskHeight').value = Math.min(100, next.viewport.height); $('maskX').value = '0'; $('maskY').value = '0'; $('visionImage').src = next.dataUrl; $('visionOverlay').setAttribute('viewBox', `0 0 ${next.viewport.width} ${next.viewport.height}`); }
        else $('visionImage').removeAttribute('src'); draw();
      }
      for (const id of ['maskX', 'maskY', 'maskWidth', 'maskHeight', 'addVisionMask', 'zoomVision']) $(id).disabled = busy;
      for (const button of $('visionMaskList').querySelectorAll('button')) button.disabled = busy;
      $('applyVisionMasks').disabled = busy || !dirty; $('clearVisionMasks').disabled = busy || !masks.length;
    },
    assertReady() { if (dirty || start) throw new Error('请先应用截图遮挡，再批准发送'); }
  };
}
