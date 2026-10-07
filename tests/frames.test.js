import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrameAdapter, validateFrameIds, frameSummary } from '../assistant/frame-adapter.js';
import { validateAction } from '../assistant/policy.js';
test('frame ranges validate IDs and tool schema rejects model-provided document or code', () => {
  assert.deepEqual(validateFrameIds([0, 3]), [0, 3]);
  for (const value of [[3], [0, 0], [0, -1], [], Array.from({ length: 17 }, (_, i) => i)]) assert.throws(() => validateFrameIds(value), { code: 'FRAME_SCOPE' });
  assert.equal(validateAction({ tool: 'switch_frame', args: { frameId: 3 } }, 'read').tool, 'switch_frame');
  assert.throws(() => validateAction({ tool: 'switch_frame', args: { frameId: 3, documentId: 'forged' } }, 'assist'), { code: 'INVALID_ACTION' });
  assert.equal(frameSummary({ frameId: 1, parentFrameId: 0, url: 'about:srcdoc' }).url, '[嵌入文档]');
});
test('permissions, allowed IDs, inherited frames, reload metadata and parent navigation are enforced', async () => {
  let permitted = false; let calls = 0; let frames = [{ frameId: 0, parentFrameId: -1, url: 'https://example.test/?secret=hidden', documentId: 'root' },
    { frameId: 1, parentFrameId: 0, url: 'about:srcdoc', documentId: 'child' }, { frameId: 2, parentFrameId: 0, url: 'https://third.example.test/', documentId: 'outside' }, { frameId: 3, parentFrameId: 0, url: 'data:text/html,private', documentId: 'opaque' }];
  const adapter = createFrameAdapter({ permissions: { contains: async () => permitted }, webNavigation: { getAllFrames: async () => { calls++; return frames; } } }, { checkTab: async () => ({ url: 'https://example.test/' }) });
  const scope = {}; await adapter.prepare(1, [0], scope); assert.equal(calls, 0);
  await assert.rejects(adapter.catalog(1), { code: 'FRAME_PERMISSION' }); permitted = true;
  await assert.rejects(adapter.prepare(1, [0, 3], scope), { code: 'FRAME_SCOPE' });
  await assert.rejects(adapter.prepare(1, [0, 1], scope, [{ frameId: 0, documentId: 'root' }, { frameId: 1, documentId: 'old-child' }]), { code: 'STALE_SNAPSHOT' });
  await adapter.prepare(1, [0, 1], scope); assert.deepEqual((await adapter.list(1, scope)).map(frame => frame.frameId), [0, 1]);
  await assert.rejects(adapter.check(1, 2, scope), { code: 'FRAME_SCOPE' });
  frames = frames.map(frame => frame.frameId === 0 ? { ...frame, documentId: 'new-root' } : frame);
  await assert.rejects(adapter.check(1, 1, scope), { code: 'FRAME_SCOPE' }); assert.deepEqual(scope.frameScopes[1].ids, [0]);
  permitted = false; await assert.rejects(adapter.list(1, scope), { code: 'FRAME_PERMISSION' });
  const enumerations = calls; await adapter.prepare(1, [0], scope);
  assert.equal(scope.frameScopes[1], undefined); assert.deepEqual((await adapter.list(1, scope)).map(frame => frame.frameId), [0]);
  assert.equal(calls, enumerations); await assert.rejects(adapter.check(1, 1, scope), { code: 'FRAME_SCOPE' });
});
