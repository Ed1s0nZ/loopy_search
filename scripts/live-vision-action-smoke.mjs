// Explicit opt-in: two small live vision requests, only a controlled synthetic Canvas write.
import { chromium } from 'playwright';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const config = JSON.parse(await readFile(process.env.LOOPY_TEST_CONFIG || `${process.env.HOME}/.config/loopy-search/testing.json`, 'utf8'));
const server = createServer((req, res) => { res.setHeader('content-type', 'text/html;charset=utf-8'); res.end('<!doctype html><title>合成视觉</title><body style="background:white"><p>请读取下方合成画布。</p><canvas id="board" width="450" height="180"></canvas><script>const c=document.getElementById("board").getContext("2d");c.fillStyle="white";c.fillRect(0,0,450,180);c.fillStyle="black";c.font="32px sans-serif";c.fillText("VISUAL-42",20,50);c.fillStyle="red";c.beginPath();c.moveTo(50,80);c.lineTo(90,150);c.lineTo(10,150);c.fill();c.fillStyle="blue";c.beginPath();c.arc(170,120,30,0,Math.PI*2);c.fill();document.getElementById("board").addEventListener("click",e=>{window.fixtureClick={x:e.clientX,y:e.clientY};document.getElementById("out").textContent="synthetic clicked"});</script><p id="out"></p>'); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const profile = await mkdtemp(join(tmpdir(), 'loopy-live-test-'));
let context;
let stage = 'launch'; let final; let networkFailure;
try {
  const extension = resolve('.');
  context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--no-first-run', '--window-size=600,500'], viewport: null });
  context.on('requestfailed', request => { if (request.url() === config.apiUrl) networkFailure = request.failure()?.errorText; });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).host;
  const page = await context.newPage(); await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const panel = await context.newPage(); await panel.goto(`chrome-extension://${id}/assistant.html`);
  await panel.waitForFunction(() => !document.getElementById('prepare').disabled);
  stage = 'configure';
  const call = (action, payload = {}) => panel.evaluate(async ({ action, payload }) => chrome.runtime.sendMessage({ action, ...payload }), { action, payload });
  const saved = await call('assistant:config', { config });
  if (!saved.success) throw new Error('Configuration failed');
  stage = 'preview';
  const tabId = (await call('assistant:tabs')).data.find(tab => tab.title === '合成视觉').id;
  const preview = await call('assistant:prepare', { tabId, mode: 'assist', vision: true, task: '在合成画布上点击蓝色圆形的中心：先只调用 click_point（截图视口 CSS 像素坐标）；执行成功后直接 finish。不要点击红色三角形，不要执行其他工具。' });
  if (!preview.success || preview.data.status !== 'preview') throw new Error('Preview failed');
  stage = 'approve';
  const approved = await call('assistant:preview', { id: preview.data.id, previewId: preview.data.preview.id });
  if (!approved.success) throw new Error('Approval failed');
  stage = 'model';
  for (let attempt = 0; attempt < 100; attempt++) {
    final = (await call('assistant:get')).data.state;
    if (['completed', 'failed', 'stopped', 'confirmation'].includes(final.status)) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (final.status !== 'confirmation' || final.pending?.action.tool !== 'click_point' || final.pending.target.tag !== 'canvas') throw new Error('Expected one controlled Canvas confirmation');
  const bounds = await page.locator('#board').boundingBox(); const { x, y } = final.pending.action.args;
  if (Math.hypot(x - (bounds.x + 170), y - (bounds.y + 120)) > 28) throw new Error('Model point does not hit the synthetic blue circle; no action confirmed');
  const confirmed = await call('assistant:confirm', { id: final.id, confirmationId: final.pending.id, approved: true });
  if (!confirmed.success || confirmed.data.status !== 'preview') throw new Error('Controlled click did not produce a fresh preview');
  const clicked = await page.evaluate(() => window.fixtureClick);
  if (!clicked || clicked.x !== x || clicked.y !== y) throw new Error('Controlled Canvas event coordinates differ');
  const second = await call('assistant:preview', { id: confirmed.data.id, previewId: confirmed.data.preview.id });
  if (!second.success) throw new Error('Second image approval failed');
  for (let attempt = 0; attempt < 100; attempt++) {
    final = (await call('assistant:get')).data.state;
    if (['completed', 'failed', 'stopped', 'confirmation'].includes(final.status)) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (final.status !== 'completed' || final.steps !== 2) throw new Error('Live vision action did not finish in two steps');
  console.log(JSON.stringify({ passed: true, status: final.status, steps: final.steps, usage: final.usage, browserWrites: 1, syntheticOnly: true, imageMatched: true, profileRemovedOnExit: true }));
} catch {
  console.error(JSON.stringify({ passed: false, stage, status: final?.status, steps: final?.steps, code: final?.error?.code, usage: final?.usage,
    networkFailure, note: 'No private configuration or model response printed.' })); process.exitCode = 1;
} finally {
  config.apiKey = ''; await context?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(profile, { recursive: true, force: true });
}
