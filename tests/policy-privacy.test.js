import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAction, parseAction, assertEndpoint, trustedPage } from '../assistant/policy.js';
import { redactText, publicUrl, sanitizeObservation } from '../assistant/privacy.js';
import { findLeaks } from '../scripts/secret-scan.mjs';
import { tabSummary } from '../assistant/scope.js';

const secret = ['sk', 'synthetic'.repeat(4)].join('-');
test('tool schema refuses code, unknown parameters, invalid references and writes in read mode', () => {
  for (const action of [{ tool: 'eval', args: { code: 'alert(1)' } }, { tool: 'observe', args: { selector: '*' } },
    { tool: 'fill', args: { snapshotId: 'valid-snapshot', elementId: 'body', value: 'text' } },
    { tool: 'scroll', args: { direction: 'down', amount: 100000 } }, { tool: 'finish', args: { summary: 'x' }, code: 'x' }]) {
    assert.throws(() => validateAction(action, 'assist'));
  }
  assert.throws(() => validateAction({ tool: 'click', args: { snapshotId: 'valid-snapshot', elementId: 'e1' } }, 'read'), { code: 'READ_ONLY' });
  assert.equal(parseAction('```json\n{"tool":"finish","args":{"summary":"done"}}\n```', 'read').tool, 'finish');
  assert.throws(() => parseAction('Here is the JSON: {}', 'read'), { code: 'INVALID_ACTION' });
});
test('navigation refuses executable schemes and URL credentials; remote endpoints require TLS', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,x', 'file:///tmp/x', 'https://user:pass@example.test/']) {
    assert.throws(() => validateAction({ tool: 'navigate', args: { url } }, 'assist'));
  }
  assert.throws(() => assertEndpoint('http://example.test/chat/completions'), { code: 'CONFIG' });
  assert.throws(() => assertEndpoint('https://example.test/api?key=value'), { code: 'CONFIG' });
  assert.equal(assertEndpoint('http://127.0.0.1:1234/chat/completions'), 'http://127.0.0.1:1234/chat/completions');
});
test('privacy strips actual secrets, credential patterns and URL query/fragment', () => {
  const text = redactText(`key ${secret} password=privatevalue https://example.test/path?token=private#fragment`, [secret]);
  assert(!text.includes(secret)); assert(!text.includes('privatevalue')); assert(!text.includes('?token'));
  assert.equal(publicUrl('https://u:p@example.test/path?q=secret#hash'), 'https://example.test/path');
  const observed = sanitizeObservation({ snapshotId: 'snapshot', url: 'https://example.test/?q=x', text: secret,
    elements: [{ id: 'e1', tag: 'input', type: 'text', label: secret, value: 'must not pass' }] }, [secret]);
  assert(!JSON.stringify(observed).includes('must not pass')); assert(!JSON.stringify(observed).includes(secret));
});
test('configured opaque credentials are removed from page, link and tab URL paths, including encoded form', () => {
  const opaque = ['opaque', 'fixture+token'].join('/');
  for (const value of [opaque, encodeURIComponent(opaque)]) {
    const url = `https://example.test/${value}/resource`;
    const observed = sanitizeObservation({ url, elements: [{ id: 'e1', href: url }] }, [opaque]);
    assert(!JSON.stringify(observed).includes(value)); assert(!publicUrl(url, [opaque]).includes(value));
    assert(!tabSummary({ id: 1, url }, [opaque]).url.includes(value));
  }
});
test('only exact internal assistant origin can use privileged API', () => {
  const runtime = { id: 'extension', getURL: path => `chrome-extension://extension/${path}` };
  assert(trustedPage({ id: 'extension', url: runtime.getURL('assistant.html') }, runtime));
  assert(trustedPage({ id: 'extension', url: runtime.getURL('assistant.html'), tab: { id: 1 } }, runtime));
  assert(!trustedPage({ id: 'extension', url: 'https://example.test/assistant.html', tab: {} }, runtime));
  assert(!trustedPage({ id: 'other', url: runtime.getURL('assistant.html') }, runtime));
});
test('secret scanner detects values without returning them', () => {
  const findings = findLeaks(`const credential = '${secret}';`);
  assert(findings.length > 0); assert(!JSON.stringify(findings).includes(secret));
  assert(findLeaks('public docs and empty apiKey').length === 0);
});
