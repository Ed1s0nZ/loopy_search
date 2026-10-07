import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMasks, blockedPoint } from '../assistant/vision-image.js';
import { validateAction } from '../assistant/policy.js';
import { stripImages, modelObservation, clearVision } from '../assistant/vision-session.js';
import { createVisionBrowser } from '../assistant/vision-browser.js';
test('mask validation rejects geometry and forbidden fields; point edges have a safety margin', () => {
  const viewport = { width: 100, height: 80 };
  assert.deepEqual(validateMasks([{ x: 10, y: 10, width: 20, height: 10 }], viewport), [{ x: 10, y: 10, width: 20, height: 10 }]);
  for (const masks of [null, Array(33).fill({}), [{ x: -1, y: 0, width: 10, height: 10 }], [{ x: 0, y: 0, width: Infinity, height: 10 }], [{ x: 0, y: 0, width: 10, height: 10, script: 'no' }], [{ x: 90, y: 0, width: 20, height: 10 }]]) assert.throws(() => validateMasks(masks, viewport), { code: 'INVALID_MASK' });
  assert(blockedPoint(8, 8, [{ x: 10, y: 10, width: 20, height: 10 }]));
  assert(!blockedPoint(50, 50, [{ x: 10, y: 10, width: 20, height: 10 }]));
});
test('visual coordinate tools validate integers and remain writes even in auto mode', () => {
  const action = { tool: 'click_point', args: { imageId: 'synthetic-image', x: 10, y: 20 } };
  assert.equal(validateAction(action, 'auto').tool, 'click_point'); assert.throws(() => validateAction(action, 'read'), { code: 'READ_ONLY' });
  for (const change of [{ x: NaN }, { x: -1 }, { y: 1.2 }, { imageId: 'bad' }, { grant: true }]) assert.throws(() => validateAction({ ...action, args: { ...action.args, ...change } }, 'assist'), { code: 'INVALID_ACTION' });
});
test('model image assembly uses only approved sanitized image and removes old image payloads', async () => {
  let verified = false; let cleared = false;
  const browser = { vision: { verify: async () => { verified = true; }, clear: () => { cleared = true; } } };
  const session = { vision: true, tabId: 1, scope: {}, controller: new AbortController(), messages: [{ role: 'user', content: [{ type: 'text', text: 'old metadata' }, { type: 'image_url', image_url: { url: 'old image' } }] }],
    observation: { documentKey: 'private-document-key', title: 'public', vision: { id: 'image-id', dataUrl: 'data:image/png;base64,c3ludGhldGlj', width: 100, height: 80, viewport: { width: 100, height: 80 } } } };
  const message = await modelObservation(browser, session);
  assert(verified); assert.equal(session.messages[0].content, 'old metadata'); assert.equal(message.content[1].image_url.url, session.observation.vision.dataUrl);
  assert(!message.content[0].text.includes('data:image')); assert(!message.content[0].text.includes('private-document-key'));
  session.messages.push(message); clearVision(browser, session); assert(cleared); assert.equal(session.observation.vision, undefined); assert(!JSON.stringify(session.messages).includes('data:image'));
  stripImages(session.messages); assert.equal(typeof session.messages[1].content, 'string');
});
test('capture detects active-tab race and never processes or returns the wrong screenshot', async () => {
  let activeId = 1; let processed = false;
  const api = { tabs: { query: async () => [{ id: activeId }], update: async id => { activeId = id; }, captureVisibleTab: async () => { activeId = 99; return 'wrong-image'; } }, windows: { update: async () => {} }, scripting: { executeScript: async () => [{ result: { ok: true, documentToken: 'doc', pageUrl: 'https://example.test/', revision: 0, layoutKey: 'layout', viewport: { width: 100, height: 80 }, masks: [], textRects: [] } }] } };
  const vision = createVisionBrowser(api, { source: async () => {}, ready: async () => {}, check: async () => ({ windowId: 1 }) }, { now: () => 10000, image: async () => { processed = true; } });
  await assert.rejects(vision.capture(1, { windowId: 1 }, null, 'doc'), { code: 'STALE_SNAPSHOT' }); assert.equal(processed, false); assert.equal(vision.view(), null);
});
test('stopping a visual task clears screenshot payloads and refuses late model mutation', async () => {
  const { AssistantRunner } = await import('../assistant/runner.js'); let finish; let cleared = 0;
  const runner = new AssistantRunner({ browser: {
    prepareScope: async () => ({ tabs: [{ id: 1, title: 'fixture', url: 'https://example.test/' }] }),
    observe: async () => ({ documentKey: 'doc', snapshotId: 'snapshot-a', title: 'fixture', url: 'https://example.test/', elements: [] }),
    vision: { capture: async () => ({ id: 'synthetic-image', dataUrl: 'data:image/png;base64,c3ludGhldGlj', viewport: { width: 100, height: 80 }, width: 100, height: 80 }), verify: async () => {}, clear: () => { cleared++; } }
  }, complete: async () => new Promise(resolve => { finish = resolve; }) });
  const view = await runner.prepare({ tabId: 1, mode: 'read', vision: true, task: 'read', config: { apiUrl: 'https://model.example.test/', model: 'test' } });
  runner.approvePreview(view.id, view.preview.id);
  for (let i = 0; !finish && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert(finish); runner.stop(); assert(cleared); assert(!JSON.stringify(runner.view()).includes('data:image')); assert(!JSON.stringify(runner.session.messages).includes('data:image'));
  finish({ content: JSON.stringify({ tool: 'finish', args: { summary: 'late' } }) }); await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(runner.view().status, 'stopped'); assert.equal(runner.view().result, undefined);
});
test('overflow hides the entire viewport and expiry refuses reuse before new capture', async () => {
  let now = 10000; let received; let overflow = true;
  const viewport = { width: 100, height: 80, dpr: 1 };
  const api = { tabs: { query: async () => [{ id: 1 }], update: async () => {}, captureVisibleTab: async () => 'raw-image' }, windows: { update: async () => {} }, scripting: { executeScript: async () => [{ result: { ok: true, documentToken: 'doc', pageUrl: 'https://example.test/', revision: 0, layoutKey: 'layout', viewport, masks: [], textRects: [{ text: 'local-private', x: 10, y: 10, width: 20, height: 10 }], overflow } }] } };
  const vision = createVisionBrowser(api, { source: async () => {}, ready: async () => {}, check: async () => ({ windowId: 1 }) }, { now: () => now, image: async (_raw, _viewport, masks) => { received = masks; return { dataUrl: 'masked-image', width: 100, height: 80 }; } });
  const scope = { windowId: 1 }; const view = await vision.capture(1, scope, null, 'doc', ['local-private']);
  assert.deepEqual(received, [{ x: 0, y: 0, width: 100, height: 80 }]);
  now += 60000; await assert.rejects(vision.verify(1, view.id, scope, null, 'doc'), { code: 'STALE_SNAPSHOT' });
  overflow = false; await vision.capture(1, scope, null, 'doc', ['local-private']);
  assert.deepEqual(received, [{ x: 10, y: 10, width: 20, height: 10 }]);
});
