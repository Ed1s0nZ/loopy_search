import { fail } from './policy.js';
export function validateMasks(masks, viewport, limit = 32) {
  if (!Array.isArray(masks) || masks.length > limit) throw fail('INVALID_MASK', `最多 ${limit} 个遮挡区域`);
  return masks.map(mask => {
    if (!mask || Object.keys(mask).some(key => !['x', 'y', 'width', 'height'].includes(key)) || ['x', 'y', 'width', 'height'].some(key => !Number.isFinite(mask[key])) || mask.width <= 0 || mask.height <= 0 || mask.x < 0 || mask.y < 0 || mask.x + mask.width > viewport.width + 1 || mask.y + mask.height > viewport.height + 1) throw fail('INVALID_MASK', '遮挡区域必须位于截图视口');
    return { x: mask.x, y: mask.y, width: mask.width, height: mask.height };
  });
}
export function blockedPoint(x, y, masks) {
  return masks.some(mask => x >= mask.x - 3 && y >= mask.y - 3 && x < mask.x + mask.width + 3 && y < mask.y + mask.height + 3);
}
export async function maskImage(dataUrl, viewport, masks, scaled = false) {
  if (!/^data:image\/png;base64,/.test(dataUrl) || dataUrl.length > 22000000) throw fail('CAPTURE', '截图格式或大小不受支持');
  let bitmap;
  try { bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob()); }
  catch { throw fail('CAPTURE', '截图无法解码，请重新开始视觉任务'); }
  try {
    const expectedScale = scaled ? Math.min(1, 1600 / Math.max(viewport.width * viewport.dpr, viewport.height * viewport.dpr)) : 1;
    if (bitmap.width * bitmap.height > 16000000 || viewport.width < 1 || viewport.height < 1 || !Number.isFinite(viewport.dpr) || Math.abs(bitmap.width - viewport.width * viewport.dpr * expectedScale) > 3 || Math.abs(bitmap.height - viewport.height * viewport.dpr * expectedScale) > 3 || Math.abs(bitmap.width / bitmap.height - viewport.width / viewport.height) > 0.03) throw fail('CAPTURE', '截图与当前视口尺寸不匹配');
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale)); const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height); const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw fail('CAPTURE', '浏览器不支持本地截图处理');
    context.drawImage(bitmap, 0, 0, width, height); context.fillStyle = '#182230';
    for (const mask of masks) {
      const sx = width / viewport.width; const sy = height / viewport.height;
      context.fillRect(Math.floor((mask.x - 3) * sx), Math.floor((mask.y - 3) * sy), Math.ceil((mask.width + 6) * sx) + 1, Math.ceil((mask.height + 6) * sy) + 1);
    }
    const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
    if (bytes.length > 3000000) throw fail('CAPTURE', '截图过大，请缩小窗口或改用 DOM 模式');
    let binary = ''; for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    return { dataUrl: `data:image/png;base64,${btoa(binary)}`, width, height };
  } finally { bitmap.close(); }
}
