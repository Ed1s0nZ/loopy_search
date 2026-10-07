import { createVisionUI } from './assistant/vision-ui.js';
import { createScopeUI } from './assistant/scope-ui.js';
const $ = id => document.getElementById(id);
const scopeUI = createScopeUI();
const visionUI = createVisionUI({ apply: masks => guarded(async () => { updateState(await request('assistant:visionMasks', { id: state.id, previewId: state.preview.id, masks })); }) });
let state = { status: 'idle', events: [] };
let config = {}; let busy = false; let port;
function updateState(next) {
  if ((next.revision ?? 0) >= (state.revision ?? 0)) state = next;
}
const names = { idle: '就绪', preparing: '读取页面', preview: '等待发送批准', running: '运行中', confirmation: '等待操作确认', completed: '已完成', stopped: '已停止', failed: '失败' };
const active = () => ['preparing', 'preview', 'running', 'confirmation'].includes(state.status);
async function request(action, payload = {}) {
  const response = await chrome.runtime.sendMessage({ action, ...payload });
  if (!response?.success) throw new Error(response?.error ?? '后台连接失败，请重新打开助手');
  return response.data;
}
async function guarded(callback) {
  if (busy) return;
  busy = true; $('notice').textContent = ''; render();
  try { await callback(); } catch (error) { $('notice').textContent = error.message; }
  finally { busy = false; render(); }
}
function render() {
  $('status').textContent = names[state.status] ?? '未知状态';
  for (const id of ['visionEnabled', 'prepare', 'target', 'task', 'mode', 'refreshTabs', 'saveConfig', 'apiUrl', 'modelName', 'apiKey', 'clearKey']) $(id).disabled = busy || active();
  $('stop').disabled = !active();
  $('steps').textContent = `${state.steps ?? 0} 步 / 16`;
  $('previewCard').hidden = state.status !== 'preview';
  $('confirmationCard').hidden = state.status !== 'confirmation';
  for (const id of ['approvePreview', 'rejectPreview', 'approveAction', 'rejectAction']) $(id).disabled = busy;
  if (state.preview) {
    $('destination').textContent = `服务：${state.endpoint} · 模型：${state.model} · 目标标签：${state.tabId}`;
    $('previewTask').textContent = `任务：${state.task}`;
    const { vision, ...textPreview } = state.preview;
    $('preview').textContent = JSON.stringify({ ...textPreview, ...(vision ? { screenshot: { width: vision.width, height: vision.height, viewport: vision.viewport, maskedCount: vision.maskedCount } } : {}) }, null, 2);
  }
  if (state.pending) {
    const action = state.pending.action;
    $('actionReason').textContent = action.reason;
    $('actionDetail').textContent = JSON.stringify({ target: state.pending.target, ...action }, null, 2);
  }
  $('resultCard').hidden = !state.result && !state.error;
  $('result').textContent = state.result ?? (state.error ? `${state.error.code}：${state.error.message}` : '');
  $('events').replaceChildren();
  for (const event of state.events ?? []) {
    const li = document.createElement('li'); const time = document.createElement('time');
    time.textContent = new Date(event.time).toLocaleTimeString();
    li.append(document.createTextNode(event.message), time); $('events').append(li);
  }
  $('emptyEvents').hidden = Boolean(state.events?.length);
  $('usage').textContent = state.usage ? `服务报告用量：输入 ${state.usage.prompt_tokens} / 输出 ${state.usage.completion_tokens} tokens` : '';
  scopeUI.render(state, busy, busy || active()); visionUI.render(state, busy);
}
async function loadTabs() {
  const tabs = await request('assistant:tabs'); const previous = Number($('target').value);
  $('target').replaceChildren();
  for (const tab of tabs) { const option = document.createElement('option'); option.value = tab.id; option.textContent = tab.title; option.selected = tab.id === previous || !previous && tab.active; $('target').append(option); }
  if (!tabs.length) { const option = document.createElement('option'); option.textContent = '请先打开普通网页'; option.value = ''; $('target').append(option); }
  scopeUI.setTabs(tabs);
}
function updateConfig(next) {
  config = next; $('apiUrl').value = config.apiUrl ?? ''; $('modelName').value = config.model ?? '';
  $('apiKey').value = ''; $('clearKey').checked = false;
  $('keyStatus').textContent = config.hasApiKey ? '已保存密钥；界面不读取密钥。' : '未保存密钥；本地免认证服务可留空。';
}
function connect() {
  port = chrome.runtime.connect({ name: 'loopy-assistant' });
  port.onMessage.addListener(message => { if (message.type === 'state') { updateState(message.state); render(); } });
  port.onDisconnect.addListener(() => { state = { ...state, status: 'stopped', pending: null, preview: null }; $('notice').textContent = '后台连接已断开，任务停止；请重新打开助手。'; render(); });
}
$('prepare').addEventListener('click', () => guarded(async () => { updateState(await request('assistant:prepare', { tabId: Number($('target').value), tabIds: scopeUI.tabIds(), task: $('task').value, mode: $('mode').value, vision: $('visionEnabled').checked })); }));
$('approvePreview').addEventListener('click', () => guarded(async () => { visionUI.assertReady(); updateState(await request('assistant:preview', { id: state.id, previewId: state.preview.id, automation: scopeUI.approval(state.mode) })); }));
$('approveAction').addEventListener('click', () => guarded(async () => { updateState(await request('assistant:confirm', { id: state.id, confirmationId: state.pending.id, approved: true })); }));
$('rejectAction').addEventListener('click', () => guarded(async () => { updateState(await request('assistant:confirm', { id: state.id, confirmationId: state.pending.id, approved: false })); }));
for (const id of ['stop', 'rejectPreview']) $(id).addEventListener('click', async () => {
  try { updateState(await request('assistant:stop')); render(); } catch { $('notice').textContent = '连接失败，请关闭助手以停止任务'; }
});
$('refreshTabs').addEventListener('click', () => guarded(loadTabs));
$('revokeAutomation').addEventListener('click', async () => {
  try { updateState(await request('assistant:revoke', { id: state.id })); render(); } catch (error) { $('notice').textContent = error.message; }
});
$('configForm').addEventListener('submit', event => {
  event.preventDefault(); void guarded(async () => {
    const values = { apiUrl: $('apiUrl').value.trim(), model: $('modelName').value.trim() };
    if ($('clearKey').checked) values.apiKey = '';
    else if ($('apiKey').value.trim()) values.apiKey = $('apiKey').value.trim();
    updateConfig(await request('assistant:config', { config: values }));
    $('notice').textContent = '配置已保存到本机';
  });
});
connect();
const heartbeat = setInterval(() => { try { port.postMessage({ type: 'ping' }); } catch { /* disconnect handler handles this */ } }, 15000);
window.addEventListener('pagehide', () => { clearInterval(heartbeat); port.disconnect(); }, { once: true });
void guarded(async () => {
  const data = await request('assistant:get'); updateState(data.state); updateConfig(data.config); await loadTabs();
  if (!config.apiUrl || !config.model) $('settings').open = true;
});
