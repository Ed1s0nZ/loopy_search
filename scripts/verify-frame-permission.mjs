// Run locally with a visible isolated Chromium. No credentials or model requests.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const profile = await mkdtemp(join(tmpdir(), 'loopy-native-permission-'));
const server = createServer((req, res) => { res.setHeader('content-type', 'text/html'); res.end('<title>Loopy isolated permission fixture</title><p>local permission test</p>'); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let context;
try {
  context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: false, viewport: null,
    args: [`--disable-extensions-except=${resolve('.')}`, `--load-extension=${resolve('.')}`, '--window-size=1100,900'] });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const fixture = await context.newPage(); await fixture.goto(`http://127.0.0.1:${server.address().port}/`);
  const assistant = await context.newPage(); await assistant.goto(`chrome-extension://${new URL(worker.url()).host}/assistant.html`);
  assert.equal(await assistant.evaluate(() => chrome.permissions.contains({ permissions: ['webNavigation'] })), false);
  await assistant.locator('#framePicker summary').click(); await assistant.locator('#loadFrames').click();
  if (process.argv.includes('--deny-first')) {
    console.log('Reject the first native prompt; the script will then request it again.');
    await assistant.waitForFunction(() => document.querySelector('#notice').textContent.includes('框架权限未允许'), undefined, { timeout: 120000 });
    assert.equal(await assistant.evaluate(() => chrome.permissions.contains({ permissions: ['webNavigation'] })), false);
    assert.equal(await assistant.locator('#frameChoices input').count(), 0);
    console.log('PASS: native denial leaves permission absent and renders its notice.');
    await assistant.locator('#loadFrames').click();
  }
  console.log('Native permission request opened in isolated Chromium; approve its prompt to verify grant and revocation.');
  await assistant.waitForFunction(() => document.querySelector('#frameChoices input'), undefined, { timeout: 120000 });
  assert(await assistant.evaluate(() => chrome.permissions.contains({ permissions: ['webNavigation'] })));
  assert.equal(await assistant.locator('#frameChoices input').count(), 1);
  assert(await assistant.evaluate(() => chrome.permissions.remove({ permissions: ['webNavigation'] })));
  await assistant.waitForFunction(() => document.querySelector('#frameHint').textContent.includes('已撤销'));
  assert.equal(await assistant.locator('#frameChoices input').count(), 0);
  console.log('PASS: actual optional permission grant, metadata UI and revocation reset; zero model requests.');
} finally {
  await context?.close(); await new Promise(resolve => server.close(resolve)); await rm(profile, { recursive: true, force: true });
}
