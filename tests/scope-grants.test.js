import test from 'node:test';
import assert from 'node:assert/strict';
import { AutomaticGrants } from '../assistant/grants.js';
import { validateTabIds, assertScopedTab, tabSummary } from '../assistant/scope.js';
import { TaskActions } from '../assistant/actions.js';
const observation = { documentKey: 'doc-a', elements: [{ id: 'e1', grantId: 'node-a', label: 'Search', capabilities: ['fill', 'click'] }] };
const action = { tool: 'fill', args: { elementId: 'e1' } };
const permission = { grants: [{ elementId: 'e1', tool: 'fill' }], limit: 2, acknowledged: true };
test('automatic grants require explicit acknowledgement and supported exact targets', () => {
  const grants = new AutomaticGrants();
  assert.equal(grants.consume(action, observation), null);
  for (const [value, mode] of [[{ ...permission, acknowledged: false }, 'auto'], [permission, 'assist'], [{ ...permission, unexpected: true }, 'auto'], [{ ...permission, grants: [{ elementId: 'e9', tool: 'fill' }] }, 'auto'], [{ ...permission, grants: [{ elementId: 'e1', tool: 'navigate' }] }, 'auto'], [{ ...permission, grants: [...permission.grants, ...permission.grants] }, 'auto']]) {
    assert.throws(() => grants.issue(observation, value, mode), { code: 'INVALID_GRANT' });
  }
  grants.issue(observation, permission, 'auto');
  assert.equal(grants.consume({ tool: 'click', args: { elementId: 'e1' } }, observation), null);
  assert.ok(grants.consume(action, observation)); assert.ok(grants.consume(action, observation));
  assert.equal(grants.consume(action, observation), null);
});
test('grants follow node identity across snapshots but reject document or node replacement', () => {
  const grants = new AutomaticGrants(); grants.issue(observation, permission, 'auto');
  assert.equal(grants.consume(action, { ...observation, documentKey: 'doc-b' }), null);
  assert.equal(grants.consume(action, { ...observation, elements: [{ ...observation.elements[0], grantId: 'replacement' }] }), null);
  assert.ok(grants.consume({ ...action, args: { elementId: 'e2' } }, { ...observation, elements: [{ ...observation.elements[0], id: 'e2' }] }));
});
test('expiry and revoke invalidate already prepared dispatch tickets', () => {
  let now = 0; const grants = new AutomaticGrants({ now: () => now, ttlMs: 10 });
  grants.issue(observation, permission, 'auto'); const ticket = grants.consume(action, observation);
  grants.clear(); assert.throws(() => grants.assertTicket(ticket), { code: 'GRANT_REVOKED' });
  grants.issue(observation, permission, 'auto'); const second = grants.consume(action, observation); now = 10;
  assert.throws(() => grants.assertTicket(second), { code: 'GRANT_REVOKED' });
  assert.equal(grants.view().active, false); assert.equal(grants.consume(action, observation), null);
});
test('task scope rejects duplicates, extra tabs, cross-window and cross-environment access', () => {
  assert.deepEqual(validateTabIds(1, [1, 2]), [1, 2]);
  for (const ids of [[2], [1, 1], [], Array.from({ length: 9 }, (_, i) => i)]) assert.throws(() => validateTabIds(1, ids), { code: 'SCOPE' });
  const scope = { windowId: 3, incognito: false, tabs: [{ id: 1 }] };
  const tab = { id: 1, windowId: 3, incognito: false, url: 'https://example.test/?token=private' };
  assert.equal(assertScopedTab(scope, tab), tab);
  for (const change of [{ id: 2 }, { windowId: 4 }, { incognito: true }]) assert.throws(() => assertScopedTab(scope, { ...tab, ...change }), { code: 'SCOPE' });
  assert.equal(tabSummary({ ...tab, title: 'secret' }, ['secret']).url, 'https://example.test/');
  assert.ok(!tabSummary({ ...tab, title: 'secret' }, ['secret']).title.includes('secret'));
});
test('tab operations reject outside scope, last-tab close and missing close confirmation', async () => {
  const actions = new TaskActions({}); const session = { scope: { tabs: [{ id: 1 }] }, observation, controller: new AbortController() };
  assert.throws(() => actions.assertTarget(session, { tool: 'switch_tab', args: { tabId: 2 } }), { code: 'SCOPE' });
  assert.throws(() => actions.assertTarget(session, { tool: 'close_tab', args: { tabId: 1 } }), { code: 'SCOPE' });
  session.scope.tabs.push({ id: 2 });
  await assert.rejects(actions.execute(session, { tool: 'close_tab', args: { tabId: 2 } }, () => {}), { code: 'STALE_CONFIRMATION' });
});
