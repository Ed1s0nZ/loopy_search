import test from 'node:test';
import assert from 'node:assert/strict';
import { createSettings } from '../security/settings.js';
import { legacyAI } from '../security/legacy-ai.js';

function fixture() {
  const store = { apiUrl: 'https://model.example.test/chat/completions', actualModel: 'test', apiKey: ['sk', 'synthetic'.repeat(4)].join('-'), prompt: 'public', memos: [] };
  const listeners = []; let level;
  const api = { runtime: { id: 'fixture', getURL: path => `chrome-extension://fixture/${path}`, onMessage: { addListener: listener => listeners.push(listener) } },
    storage: { local: { setAccessLevel: async value => { level = value; }, get: async keys => {
      if (Array.isArray(keys)) return Object.fromEntries(keys.filter(key => key in store).map(key => [key, store[key]]));
      return { ...keys, ...Object.fromEntries(Object.keys(keys).filter(key => key in store).map(key => [key, store[key]])) };
    }, set: async values => Object.assign(store, values) }, onChanged: { addListener: () => {} } }, tabs: { query: async () => [] } };
  return { api, store, listeners, level: () => level };
}
test('credentials are trusted-only and public config reports presence without value', async () => {
  const { api, store, level } = fixture(); const settings = createSettings(api);
  await settings.ready; assert.equal(level().accessLevel, 'TRUSTED_CONTEXTS');
  const config = await settings.publicConfig(); assert(config.hasApiKey); assert(!JSON.stringify(config).includes(store.apiKey));
  await assert.rejects(settings.readPublic(['apiKey']), { code: 'FORBIDDEN' });
  await assert.rejects(settings.readPublic(['proxyPassword']), { code: 'FORBIDDEN' });
  assert.equal((await settings.readPublic(['prompt'])).prompt, 'public');
});
test('blank key omission preserves key and explicit deletion removes it', async () => {
  const { api, store } = fixture(); const settings = createSettings(api); const original = store.apiKey;
  await settings.save({ apiUrl: store.apiUrl, model: 'new' }); assert.equal(store.apiKey, original);
  await settings.save({ apiUrl: store.apiUrl, model: 'new', apiKey: '' }); assert.equal(store.apiKey, '');
});
test('public bridge denies arbitrary writes and extension-impostor sender', async () => {
  const { api, store, listeners } = fixture(); const settings = createSettings(api); settings.installBridge();
  const send = (message, sender) => new Promise(resolve => listeners[0](message, sender, resolve));
  const sender = { id: api.runtime.id, tab: { id: 1 }, url: 'https://example.test/' };
  assert.equal((await send({ action: 'publicSettings:set', values: { apiKey: 'x' } }, sender)).success, false);
  assert.equal((await send({ action: 'publicSettings:get', keys: ['prompt'] }, { ...sender, id: 'other' })).success, false);
  assert.equal((await send({ action: 'publicSettings:set', values: { memos: [{ text: 'synthetic' }] } }, sender)).success, true);
  assert.equal(store.memos[0].text, 'synthetic');
});
test('legacy AI rejects untrusted sender and malformed messages before network access', async () => {
  const { api } = fixture(); const settings = createSettings(api);
  await assert.rejects(legacyAI({ data: { messages: [] } }, { id: 'other' }, api, settings), { code: 'FORBIDDEN' });
  await assert.rejects(legacyAI({ data: { messages: [{ role: 'tool', content: 'x' }] } }, { id: api.runtime.id, url: api.runtime.getURL('popup.html') }, api, settings), { code: 'INVALID_REQUEST' });
});
