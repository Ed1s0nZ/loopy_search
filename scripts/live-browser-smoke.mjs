// Explicit live opt-in; fresh profile + local synthetic page, read mode only.
import { chromium } from 'playwright';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const config = JSON.parse(await readFile(process.env.LOOPY_TEST_CONFIG || `${process.env.HOME}/.config/loopy-search/testing.json`, 'utf8'));
const server = createServer((req, res) => { res.setHeader('content-type', 'text/html;charset=utf-8'); res.end('<!doctype html><html lang="zh-CN"><title>合成公告</title><body><h1>合成公告</h1><p>Example 1.0 存在输入校验问题，建议升级到 1.1。</p></body></html>'); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const profile = await mkdtemp(join(tmpdir(), 'loopy-live-test-'));
let context;
let stage = 'launch'; let final; let networkFailure;
try {
  const extension = resolve('.');
  context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--no-first-run'] });
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
  const tabId = (await call('assistant:tabs')).data.find(tab => tab.title === '合成公告').id;
  const preview = await call('assistant:prepare', { tabId, mode: 'read', task: '用一句话总结合成公告。已有完整页面观察，直接使用 finish 完成；不要调用其他工具。' });
  if (!preview.success || preview.data.status !== 'preview') throw new Error('Preview failed');
  stage = 'approve';
  const approved = await call('assistant:preview', { id: preview.data.id, previewId: preview.data.preview.id });
  if (!approved.success) throw new Error('Approval failed');
  stage = 'model';
  for (let attempt = 0; attempt < 100; attempt++) {
    final = (await call('assistant:get')).data.state;
    if (['completed', 'failed', 'stopped'].includes(final.status)) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (final.status !== 'completed' || final.steps !== 1 || !final.result.includes('1.1')) throw new Error('Read-only browser smoke did not finish in one step');
  console.log(JSON.stringify({ passed: true, status: final.status, steps: final.steps, usage: final.usage, browserWrites: 0, profileRemovedOnExit: true }));
} catch {
  console.error(JSON.stringify({ passed: false, stage, status: final?.status, steps: final?.steps, code: final?.error?.code, usage: final?.usage,
    networkFailure, note: 'No private configuration or model response printed.' })); process.exitCode = 1;
} finally {
  config.apiKey = ''; await context?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(profile, { recursive: true, force: true });
}
