import { trustedPage, fail, assertEndpoint } from '../assistant/policy.js';

export const PUBLIC_KEYS = new Set(['apiUrl', 'model', 'customModel', 'actualModel', 'prompt', 'useMarkdown',
  'saveHistory', 'historyRetention', 'maxChatHistory', 'showSelectionButton', 'buttonDisplayMode',
  'searchHistory', 'memos', 'promptTemplates', 'customCategories', 'selectionButtonMode', 'showButton', 'apiConfigured']);
const WRITABLE = new Set(['memos']);

export function createSettings(api) {
  const ready = api.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  async function config() {
    await ready;
    const data = await api.storage.local.get({ apiUrl: '', actualModel: '', model: '', customModel: '', apiKey: '' });
    return { apiUrl: data.apiUrl, model: data.actualModel || (data.model === 'custom' ? data.customModel : data.model), apiKey: data.apiKey };
  }
  async function save(input) {
    await ready;
    if (!input || typeof input !== 'object') throw fail('CONFIG', '设置无效');
    const apiUrl = assertEndpoint(input.apiUrl);
    if (typeof input.model !== 'string' || !input.model.trim() || input.model.length > 120) throw fail('CONFIG', '请输入有效模型名称');
    if (input.apiKey !== undefined && (typeof input.apiKey !== 'string' || input.apiKey.length > 512 || /[\r\n]/.test(input.apiKey))) throw fail('CONFIG', '密钥格式无效');
    const data = { apiUrl, actualModel: input.model.trim(), model: 'custom', customModel: input.model.trim() };
    if (input.apiKey !== undefined) data.apiKey = input.apiKey.trim();
    await api.storage.local.set(data);
    return publicConfig();
  }
  async function publicConfig() {
    const data = await config();
    return { apiUrl: data.apiUrl, model: data.model, hasApiKey: Boolean(data.apiKey) };
  }
  async function readPublic(keys) {
    await ready;
    if (!keys || !Array.isArray(keys) || keys.length > 30 || keys.some(key => !PUBLIC_KEYS.has(key))) throw fail('FORBIDDEN', '不允许读取此设置');
    const data = await api.storage.local.get(keys.filter(key => key !== 'apiConfigured'));
    if (keys.includes('apiConfigured')) data.apiConfigured = Boolean((await config()).apiKey);
    return data;
  }
  function installBridge() {
    api.runtime.onMessage.addListener((message, sender, respond) => {
      if (!['publicSettings:get', 'publicSettings:set', 'publicSettings:rate'].includes(message?.action)) return;
      if (sender.id !== api.runtime.id || !sender.tab || !/^https?:/.test(sender.url ?? '')) { respond({ success: false, error: '禁止访问' }); return; }
      const operation = message.action === 'publicSettings:get' ? readPublic(message.keys) : (async () => {
        await ready;
        if (message.action === 'publicSettings:rate') {
          if (typeof message.id !== 'string' || ![-1, 0, 1].includes(message.rating)) throw fail('FORBIDDEN', '无效评分');
          const data = await api.storage.local.get({ searchHistory: [] });
          const item = data.searchHistory.find(item => item.id === message.id);
          if (item) { item.rating = message.rating; await api.storage.local.set({ searchHistory: data.searchHistory }); }
          return {};
        }
        const values = message.values;
        if (!values || typeof values !== 'object' || Object.keys(values).some(key => !WRITABLE.has(key)) || JSON.stringify(values).length > 500000) throw fail('FORBIDDEN', '不允许修改此设置');
        await api.storage.local.set(values); return {};
      })();
      operation.then(data => respond({ success: true, data })).catch(() => respond({ success: false, error: '设置访问失败' }));
      return true;
    });
    api.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      const publicChanges = Object.fromEntries(Object.entries(changes).filter(([key]) => PUBLIC_KEYS.has(key)));
      if (!Object.keys(publicChanges).length) return;
      api.tabs.query({}).then(tabs => Promise.allSettled(tabs.filter(tab => /^https?:/.test(tab.url ?? '')).map(tab =>
        api.tabs.sendMessage(tab.id, { action: 'publicSettings:changed', changes: publicChanges })
      ))).catch(() => {});
    });
  }
  return { ready, config, save, publicConfig, readPublic, installBridge,
    isTrusted: sender => trustedPage(sender, api.runtime, ['assistant.html', 'popup.html', 'history.html']) };
}
