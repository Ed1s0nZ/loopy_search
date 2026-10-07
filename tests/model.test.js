import test from 'node:test';
import assert from 'node:assert/strict';
import { complete } from '../assistant/model.js';

const config = { apiUrl: 'https://model.example.test/chat/completions', model: 'test-model', apiKey: ['sk', 'synthetic'.repeat(4)].join('-') };
test('model client uses configured endpoint, omits browser credentials, denies redirects and redacts output', async () => {
  const result = await complete(config, [{ role: 'user', content: 'synthetic task' }], { fetchImpl: async (url, options) => {
    assert.equal(url, config.apiUrl); assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, `Bearer ${config.apiKey}`);
    assert(!options.body.includes(config.apiKey));
    return Response.json({ choices: [{ message: { content: config.apiKey } }], usage: { prompt_tokens: 10, completion_tokens: 2 } });
  } });
  assert.equal(result.content, '[REDACTED]'); assert.equal(result.usage.prompt_tokens, 10);
});
test('service error body cannot leak credentials', async () => {
  await assert.rejects(complete(config, [], { fetchImpl: async () => new Response(config.apiKey, { status: 401 }) }), error => error.code === 'MODEL_ERROR' && !error.message.includes(config.apiKey));
});
test('invalid/large response is rejected', async () => {
  await assert.rejects(complete(config, [], { fetchImpl: async () => new Response('not JSON') }), { code: 'MODEL_ERROR' });
  await assert.rejects(complete(config, [], { fetchImpl: async () => new Response('x'.repeat(1000001)) }), { code: 'MODEL_ERROR' });
});
test('timeout covers waiting for HTTP response', async () => {
  await assert.rejects(complete(config, [], { timeoutMs: 10, fetchImpl: async (url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
  }) }), { code: 'TIMEOUT' });
});
test('caller cancellation aborts request', async () => {
  const controller = new AbortController();
  const pending = complete(config, [], { signal: controller.signal, fetchImpl: async (url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
  }) });
  controller.abort(new Error('cancelled')); await assert.rejects(pending, /cancelled/);
});
