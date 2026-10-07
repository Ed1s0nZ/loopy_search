import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserTools } from '../assistant/browser.js';
import { AssistantRunner } from '../assistant/runner.js';
const tab = (id, overrides = {}) => ({ id, windowId: 1, incognito: false, url: `https://example.test/${id}`, status: 'complete', title: 'fixture', ...overrides });
test('browser adapter enforces window and incognito scope before document injection', async () => {
  const tabs = new Map([[1, tab(1)], [2, tab(2, { windowId: 2 })], [3, tab(3, { incognito: true })]]);
  let injected = 0; const browser = createBrowserTools({ tabs: { get: async id => tabs.get(id) }, scripting: { executeScript: async () => { injected++; } } });
  await assert.rejects(browser.prepareScope(1, [1, 2], [], false), { code: 'SCOPE' });
  await assert.rejects(browser.prepareScope(1, [1, 3], [], false), { code: 'SCOPE' });
  await assert.rejects(browser.prepareScope(3, [3], [], false), { code: 'SCOPE' });
  const scope = await browser.prepareScope(1, [1], [], false);
  await assert.rejects(browser.observe(2, [], null, scope), { code: 'SCOPE' }); assert.equal(injected, 0);
  for (const id of [2, 3]) {
    await assert.rejects(browser.observe(id, [], null, scope, 1), { code: 'SCOPE' });
    await assert.rejects(browser.frames.catalog(id, scope), { code: 'SCOPE' });
  }
  assert.equal(injected, 0);
});
test('close compares captured title even if document record is refreshed', async () => {
  let title = 'original'; let removed = false;
  const browser = createBrowserTools({ tabs: { get: async () => tab(1, { title }), remove: async () => { removed = true; } },
    scripting: { executeScript: async () => [{ documentId: 'doc', result: { ok: true, documentToken: 'token', pageUrl: 'https://example.test/1' } }] } });
  const scope = await browser.prepareScope(1, [1], [], false); const captured = await browser.describeTab(1, scope);
  title = 'changed'; await browser.describeTab(1, scope);
  await assert.rejects(browser.closeTab(1, captured, scope, null, () => {}), { code: 'STALE_SNAPSHOT' }); assert.equal(removed, false);
});
test('revocation during asynchronous dispatch preparation prevents actual write', { timeout: 5000 }, async () => {
  let release; let entered; let writes = 0;
  const prepared = new Promise(resolve => { entered = resolve; });
  const observation = { documentKey: 'doc', snapshotId: 'snapshot-a', title: 'fixture', url: 'https://example.test/', elements: [{ id: 'e1', grantId: 'node', capabilities: ['fill'], label: 'Search' }] };
  const runner = new AssistantRunner({ browser: {
    prepareScope: async () => ({ windowId: 1, incognito: false, tabs: [{ id: 1, title: 'fixture', url: observation.url }] }),
    observe: async () => observation,
    execute: async (_id, _action, _signal, _document, _scope, guard) => {
      entered(); await new Promise(resolve => { release = resolve; }); guard(); writes++;
    }
  }, complete: async () => ({ content: JSON.stringify({ tool: 'fill', args: { snapshotId: 'snapshot-a', elementId: 'e1', value: 'synthetic' } }) }) });
  const view = await runner.prepare({ tabId: 1, mode: 'auto', task: 'test', config: { model: 'test', apiUrl: 'https://model.example.test/' } });
  runner.approvePreview(view.id, view.preview.id, { grants: [{ elementId: 'e1', tool: 'fill' }], limit: 1, acknowledged: true });
  await prepared; runner.revoke(view.id); release();
  for (let i = 0; runner.view().status === 'running' && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(writes, 0); assert.equal(runner.view().error.code, 'GRANT_REVOKED');
});
