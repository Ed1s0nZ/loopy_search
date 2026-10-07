import test from 'node:test';
import assert from 'node:assert/strict';
import { AssistantRunner } from '../assistant/runner.js';

const config = { apiUrl: 'https://model.example.test/chat/completions', model: 'test' };
const snapshot = (key = 'document-a', id = 'snapshot-a') => ({ snapshotId: id, documentKey: key, url: 'https://example.test/', title: 'fixture', text: 'safe', elements: [{ id: 'e1', label: 'Search', tag: 'input', type: 'text' }] });
const finish = { tool: 'finish', args: { summary: 'done' } };
const fill = { tool: 'fill', args: { snapshotId: 'snapshot-a', elementId: 'e1', value: 'synthetic' } };
const settle = () => new Promise(resolve => setTimeout(resolve, 10));
function setup(actions = [finish], options = {}) {
  let calls = 0; const writes = []; const observations = [snapshot()];
  const runner = new AssistantRunner({ browser: {
    prepareScope: async (tabId, tabIds = [tabId]) => ({ windowId: 1, incognito: false, tabs: tabIds.map(id => ({ id, title: 'fixture', url: 'https://example.test/' })) }),
    observe: async () => structuredClone(observations.length > 1 ? observations.shift() : observations[0]),
    execute: async (...args) => { writes.push(args); }
  }, complete: async () => ({ content: JSON.stringify(actions[calls++] ?? finish) }), ...options });
  return { runner, writes, observations, calls: () => calls };
}
async function start(runner, mode = 'read') {
  const view = await runner.prepare({ tabId: 1, mode, task: 'synthetic task', config });
  runner.approvePreview(view.id, view.preview.id); await settle(); return runner.view();
}
test('no model call before explicit preview approval', async () => {
  const fixture = setup(); const view = await fixture.runner.prepare({ tabId: 1, mode: 'read', task: 'read', config });
  assert.equal(view.status, 'preview'); assert.equal(fixture.calls(), 0);
  fixture.runner.approvePreview(view.id, view.preview.id); await settle();
  assert.equal(fixture.runner.view().status, 'completed'); assert.equal(fixture.writes.length, 0);
});
test('writes require exact confirmation and cannot be replayed', async () => {
  const { runner, writes } = setup([fill, finish]); const view = await start(runner, 'assist');
  assert.equal(view.status, 'confirmation'); assert.equal(writes.length, 0);
  await assert.rejects(runner.confirm(view.id, 'wrong', true), { code: 'STALE_CONFIRMATION' });
  await runner.confirm(view.id, view.pending.id, true); await settle();
  assert.equal(writes.length, 1); assert.equal(runner.view().status, 'completed');
  await assert.rejects(runner.confirm(view.id, view.pending.id, true), { code: 'STALE_CONFIRMATION' });
});
test('read mode refuses model write and never executes', async () => {
  const { runner, writes } = setup([fill]); await start(runner);
  assert.equal(runner.view().error.code, 'READ_ONLY'); assert.equal(writes.length, 0);
});
test('rejection stops and never writes', async () => {
  const { runner, writes } = setup([fill]); const view = await start(runner, 'assist');
  await runner.confirm(view.id, view.pending.id, false); assert.equal(runner.view().status, 'stopped'); assert.equal(writes.length, 0);
});
test('stop while model is running prevents late result execution and new overlapping task', async () => {
  let resolve; const { runner, writes } = setup([], { complete: () => new Promise(done => { resolve = done; }) });
  await start(runner, 'assist'); runner.stop();
  await assert.rejects(runner.prepare({ tabId: 1, mode: 'read', task: 'new', config }), { code: 'BUSY' });
  resolve({ content: JSON.stringify(fill) }); await settle(); assert.equal(runner.view().status, 'stopped'); assert.equal(writes.length, 0);
});
test('new document requires another send preview', async () => {
  const { runner, observations, calls } = setup([{ tool: 'observe', args: {} }, finish]);
  observations.push(snapshot('document-b', 'snapshot-b'));
  await start(runner); assert.equal(runner.view().status, 'preview'); assert.equal(calls(), 1);
  const view = runner.view(); runner.approvePreview(view.id, view.preview.id); await settle(); assert.equal(runner.view().status, 'completed');
});
test('unknown element and step/time limits fail closed', async () => {
  const invalid = { ...fill, args: { ...fill.args, elementId: 'e99' } };
  const { runner, writes } = setup([invalid]); await start(runner, 'assist'); assert.equal(runner.view().error.code, 'STALE_SNAPSHOT'); assert.equal(writes.length, 0);
  const limited = setup([{ tool: 'observe', args: {} }], { maxSteps: 1 }); await start(limited.runner); assert.equal(limited.runner.view().error.code, 'LIMIT');
  let now = 0; const timed = setup([finish], { maxTimeMs: 10, now: () => now });
  const view = await timed.runner.prepare({ tabId: 1, mode: 'read', task: 'x', config }); now = 11;
  assert.throws(() => timed.runner.approvePreview(view.id, view.preview.id), { code: 'TIMEOUT' });
});
