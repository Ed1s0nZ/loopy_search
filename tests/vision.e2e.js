import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const syntheticKey = ['sk', 'fixture'.repeat(5)].join('-');
const html = `<!doctype html><title>Vision fixture</title><style>body{background:white;margin:20px;font:16px sans-serif}input{background:#00ff00;width:240px;height:32px}canvas{display:block;border:1px solid black;margin-top:20px}#private{width:180px;height:30px;background:#ff00ff}</style>
<h1>合成视觉测试页</h1><input id="privateInput" value="synthetic-private-value"><p id="credential">${syntheticKey}</p><div id="private">business private area</div><x-private style="display:block;width:200px;height:40px"></x-private><canvas id="board" width="300" height="120" aria-label="合成画布"></canvas><p id="result">clicked:0</p>
<script>const hidden=document.querySelector("x-private").attachShadow({mode:"closed"});hidden.innerHTML="<input value=closed-shadow-private style=background:lime>";const canvas=document.getElementById('board');const ctx=canvas.getContext('2d');ctx.fillStyle='#0066ff';ctx.fillRect(0,0,300,120);ctx.fillStyle='white';ctx.font='20px sans-serif';ctx.fillText('Local Canvas',50,60);let clicks=0;canvas.addEventListener('click',event=>{document.getElementById('result').textContent='clicked:'+ ++clicks+' at '+event.clientX+','+event.clientY});</script>`;
test('vision extension: masked pixels, consent, Canvas coordinates and stale image rejection', { timeout: 120000 }, async t => {
  let behavior = 'finish'; let calls = 0; let bodies = []; let point;
  const server = createServer(async (req, res) => {
    if (req.url === '/chat/completions') {
      let body = ''; for await (const chunk of req) body += chunk; bodies.push(JSON.parse(body)); calls++;
      const messages = bodies.at(-1).messages;
      const parsed = messages.filter(message => message.role === 'user').map(message => {
        try { return JSON.parse(Array.isArray(message.content) ? message.content.filter(part => part.type === 'text').map(part => part.text).join('') : message.content); } catch { return {}; }
      });
      const page = parsed.filter(message => message.observation).at(-1)?.observation;
      const executed = parsed.some(message => message.toolResult?.executed);
      let action = { tool: 'finish', args: { summary: 'synthetic vision complete' } };
      if (behavior === 'point' && !executed) action = { tool: 'click_point', args: { imageId: page.vision.id, x: point.x, y: point.y } };
      res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(action) } }] }));
    } else { res.setHeader('content-type', 'text/html;charset=utf-8'); res.end(html); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const base = `http://127.0.0.1:${server.address().port}`;
  const profile = await mkdtemp(join(tmpdir(), 'loopy-vision-test-')); let context;
  try {
    context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${resolve('.')}`, `--load-extension=${resolve('.')}`, '--window-size=1000,900'], viewport: null });
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker'); const extensionId = new URL(worker.url()).host;
    const fixture = await context.newPage(); await fixture.goto(base);
    const assistant = await context.newPage(); await assistant.goto(`chrome-extension://${extensionId}/assistant.html`);
    const call = (action, payload = {}) => assistant.evaluate(async ({ action, payload }) => chrome.runtime.sendMessage({ action, ...payload }), { action, payload });
    const tabId = (await call('assistant:tabs')).data.find(tab => tab.title === 'Vision fixture').id;
    assert((await call('assistant:config', { config: { apiUrl: `${base}/chat/completions`, model: 'synthetic-vision', apiKey: syntheticKey } })).success);
    const wait = async status => {
      for (let i = 0; i < 100; i++) {
        const state = (await call('assistant:get')).data.state;
        if (state.status === status) return state;
        if (state.status === 'failed') throw new Error(JSON.stringify(state.error));
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      throw new Error(`missing ${status}`);
    };
    const prepare = async (mode = 'read', vision = true) => {
      const result = await call('assistant:prepare', { tabId, mode, vision, task: 'Inspect only synthetic local canvas' }); assert(result.success, result.error);
      assert.equal(result.data.status, 'preview', JSON.stringify(result.data.error)); return result.data;
    };
    const approve = async view => { const result = await call('assistant:preview', { id: view.id, previewId: view.preview.id }); assert(result.success, result.error); };
    const pixel = async (image, point) => assistant.evaluate(async ({ image, point }) => {
      const bitmap = await createImageBitmap(await (await fetch(image.dataUrl)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height); const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0);
      const rgba = [...ctx.getImageData(Math.floor(point.x * bitmap.width / image.viewport.width), Math.floor(point.y * bitmap.height / image.viewport.height), 1, 1).data]; bitmap.close(); return rgba;
    }, { image, point });
    const center = selector => fixture.locator(selector).evaluate(element => { const r = element.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; });
    await t.test('screenshot is opt-in; automatic masks cover field and credential pixels before model consent', async () => {
      const priorUrl = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0].url);
      const view = await prepare(); assert.equal(calls, 0); assert(view.preview.vision.dataUrl.startsWith('data:image/png;base64,'));
      assert.deepEqual(await pixel(view.preview.vision, await center('#privateInput')), [24, 34, 48, 255]);
      assert.deepEqual(await pixel(view.preview.vision, await center('#credential')), [24, 34, 48, 255]);
      assert.deepEqual(await pixel(view.preview.vision, await center('x-private')), [24, 34, 48, 255]);
      assert.equal(await worker.evaluate(async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0].url), priorUrl);
      assert.notDeepEqual(await pixel(view.preview.vision, await center('#board')), [24, 34, 48, 255]);
      await approve(view); const done = await wait('completed'); assert.equal(calls, 1); assert(!JSON.stringify(done).includes('data:image'));
      const images = bodies.at(-1).messages.flatMap(message => Array.isArray(message.content) ? message.content.filter(part => part.type === 'image_url') : []);
      assert.equal(images.length, 1); assert.equal(images[0].image_url.url, view.preview.vision.dataUrl);
      assert(!JSON.stringify(bodies.at(-1)).includes(syntheticKey)); assert(!JSON.stringify(bodies.at(-1)).includes('documentToken'));
      const dom = await prepare('read', false); assert.equal(dom.preview.vision, undefined); await call('assistant:stop');
    });
    await t.test('manual masks are reversible without exposing automatic masked pixels and invalidate old approval', async () => {
      const view = await prepare(); const box = await fixture.locator('#private').boundingBox();
      const result = await call('assistant:visionMasks', { id: view.id, previewId: view.preview.id, masks: [box] }); assert(result.success, result.error);
      assert.notEqual(result.data.preview.id, view.preview.id);
      assert.deepEqual(await pixel(result.data.preview.vision, await center('#private')), [24, 34, 48, 255]);
      assert.equal((await call('assistant:preview', { id: view.id, previewId: view.preview.id })).success, false);
      const reset = await call('assistant:visionMasks', { id: view.id, previewId: result.data.preview.id, masks: [] }); assert(reset.success, reset.error);
      assert.notDeepEqual(await pixel(reset.data.preview.vision, await center('#private')), [24, 34, 48, 255]);
      assert.deepEqual(await pixel(reset.data.preview.vision, await center('#privateInput')), [24, 34, 48, 255]); await call('assistant:stop');
    });
    await t.test('Canvas coordinate click requires confirmation and new screenshot consent before next model call', async () => {
      point = await center('#board'); behavior = 'point'; const view = await prepare('auto'); await approve(view);
      const pending = await wait('confirmation'); assert.equal(pending.pending.action.tool, 'click_point');
      assert.equal(await fixture.textContent('#result'), 'clicked:0'); const before = calls;
      assert((await call('assistant:confirm', { id: view.id, confirmationId: pending.pending.id, approved: true })).success);
      const next = await wait('preview'); assert.equal(calls, before); assert((await fixture.textContent('#result')).includes(`clicked:1 at ${point.x},${point.y}`));
      assert.notEqual(next.preview.vision.id, view.preview.vision.id); await approve(next); await wait('completed');
      assert.equal(bodies.at(-1).messages.flatMap(message => Array.isArray(message.content) ? message.content.filter(part => part.type === 'image_url') : []).length, 1);
    });
    await t.test('scroll after preview prevents stale image transmission; masked coordinate cannot click', async () => {
      behavior = 'finish'; const view = await prepare(); const before = calls;
      await fixture.evaluate(() => document.body.style.height = '2000px'); await approve(view);
      for (let i = 0; i < 100 && (await call('assistant:get')).data.state.status !== 'failed'; i++) await new Promise(resolve => setTimeout(resolve, 20));
      const failed = (await call('assistant:get')).data.state; assert.equal(failed.status, 'failed'); assert.equal(failed.error.code, 'STALE_SNAPSHOT'); assert.equal(calls, before);
      behavior = 'point'; point = await center('#privateInput'); await approve(await prepare('assist'));
      for (let i = 0; i < 100 && (await call('assistant:get')).data.state.status !== 'failed'; i++) await new Promise(resolve => setTimeout(resolve, 20));
      assert.equal((await call('assistant:get')).data.state.error.code, 'BLOCKED');
    });
    await t.test('Canvas pixel-only changes are refused before model transmission or confirmed click', async () => {
      behavior = 'finish'; let view = await prepare(); const before = calls;
      await fixture.evaluate(() => { const ctx = document.getElementById('board').getContext('2d'); ctx.fillStyle = 'red'; ctx.fillRect(10, 10, 30, 30); });
      await approve(view);
      for (let i = 0; i < 100 && (await call('assistant:get')).data.state.status !== 'failed'; i++) await new Promise(resolve => setTimeout(resolve, 20));
      assert.equal((await call('assistant:get')).data.state.error.code, 'STALE_SNAPSHOT'); assert.equal(calls, before);
      behavior = 'point'; point = await center('#board'); view = await prepare('assist'); await approve(view); const pending = await wait('confirmation');
      const resultBefore = await fixture.textContent('#result');
      await fixture.evaluate(() => { const ctx = document.getElementById('board').getContext('2d'); ctx.fillStyle = 'yellow'; ctx.fillRect(20, 20, 30, 30); });
      await call('assistant:confirm', { id: view.id, confirmationId: pending.pending.id, approved: true });
      assert.equal((await call('assistant:get')).data.state.error.code, 'STALE_SNAPSHOT'); assert.equal(await fixture.textContent('#result'), resultBefore);
    });
    await t.test('scaled image masking keeps coordinate mapping and rejects mismatched raw viewport', async () => {
      const result = await assistant.evaluate(async () => {
        const { maskImage } = await import(chrome.runtime.getURL('assistant/vision-image.js'));
        const canvas = new OffscreenCanvas(2000, 1000); const context = canvas.getContext('2d'); context.fillStyle = 'blue'; context.fillRect(0, 0, 2000, 1000);
        const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
        let text = ''; for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
        const raw = `data:image/png;base64,${btoa(text)}`; const viewport = { width: 2000, height: 1000, dpr: 1 };
        const base = await maskImage(raw, viewport, [{ x: 100, y: 100, width: 100, height: 100 }]);
        const extra = await maskImage(base.dataUrl, viewport, [{ x: 500, y: 100, width: 100, height: 100 }], true);
        const bitmap = await createImageBitmap(await (await fetch(extra.dataUrl)).blob());
        const output = new OffscreenCanvas(bitmap.width, bitmap.height); const ctx = output.getContext('2d'); ctx.drawImage(bitmap, 0, 0);
        const first = [...ctx.getImageData(120, 120, 1, 1).data]; const second = [...ctx.getImageData(440, 120, 1, 1).data]; bitmap.close();
        let invalid; try { await maskImage(raw, { ...viewport, width: 1000 }, []); } catch (error) { invalid = error.code; }
        return { width: extra.width, first, second, invalid };
      });
      assert.equal(result.width, 1600); assert.deepEqual(result.first, [24, 34, 48, 255]); assert.deepEqual(result.second, [24, 34, 48, 255]); assert.equal(result.invalid, 'CAPTURE');
    });
    await t.test('actual visual UI captures, masks and approves locally', async () => {
      behavior = 'finish'; await assistant.setViewportSize({ width: 420, height: 900 });
      await assistant.selectOption('#target', String(tabId)); await assistant.fill('#task', 'Inspect local synthetic screenshot'); await assistant.locator('#visionEnabled').check();
      await assistant.click('#prepare'); await assistant.waitForSelector('#visionEditor:not([hidden])');
      await assistant.locator('#visionOverlay').scrollIntoViewIfNeeded();
      const rect = await assistant.locator('#visionOverlay').boundingBox();
      await assistant.mouse.move(rect.x + 20, rect.y + 20); await assistant.mouse.down(); await assistant.mouse.move(rect.x + 60, rect.y + 60); await assistant.mouse.up();
      await assistant.click('#approvePreview'); assert((await assistant.textContent('#notice')).includes('应用截图遮挡'));
      await assistant.click('#applyVisionMasks'); await assistant.waitForFunction(() => document.getElementById('visionMaskStatus').textContent.includes('额外遮挡 1'));
      await mkdir('artifacts', { recursive: true }); await assistant.screenshot({ path: 'artifacts/assistant-vision-preview.png', fullPage: true });
      await assistant.click('#zoomVision'); assert(await assistant.locator('#visionZoom').isVisible()); await assistant.click('#closeVisionZoom');
      await assistant.locator('#visionEditor details summary').click(); await assistant.fill('#maskX', '250'); await assistant.fill('#maskY', '50'); await assistant.fill('#maskWidth', '40'); await assistant.fill('#maskHeight', '20');
      await assistant.click('#addVisionMask'); await assistant.click('#applyVisionMasks'); await assistant.waitForFunction(() => document.getElementById('visionMaskStatus').textContent.includes('额外遮挡 2'));
      await assistant.screenshot({ path: 'artifacts/assistant-vision-preview.png', fullPage: true });
      await assistant.emulateMedia({ colorScheme: 'dark' }); await assistant.screenshot({ path: 'artifacts/assistant-vision-dark.png', fullPage: true });
      await assistant.click('#approvePreview'); await wait('completed');
    });
  } finally { await context?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(profile, { recursive: true, force: true }); }
});
