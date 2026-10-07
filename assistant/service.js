import { createBrowserTools } from './browser.js';
import { AssistantRunner } from './runner.js';
import { complete } from './model.js';
import { assertEndpoint, trustedPage } from './policy.js';

export function installAssistant(api, settings) {
  let port = null;
  const runner = new AssistantRunner({ browser: createBrowserTools(api), complete,
    notify: state => { try { port?.postMessage({ type: 'state', state }); } catch { runner.stop('界面连接已断开'); } } });
  api.runtime.onConnect.addListener(connection => {
    if (connection.name !== 'loopy-assistant' || !trustedPage(connection.sender, api.runtime)) return;
    if (port) { runner.stop('助手已在另一界面打开'); port.disconnect(); }
    port = connection;
    connection.onMessage.addListener(message => {
      if (message?.type === 'ping') {
        const session = runner.session;
        if (session && ['preparing', 'preview', 'running', 'confirmation'].includes(session.status)) {
          try { runner.assertRunning(session); } catch (error) { runner.handleError(session, error); }
        }
        try { connection.postMessage({ type: 'state', state: runner.view() }); } catch { /* disconnect stops task */ }
      }
    });
    connection.onDisconnect.addListener(() => {
      if (port === connection) { port = null; runner.stop('侧栏已关闭，任务停止'); }
    });
    connection.postMessage({ type: 'state', state: runner.view() });
  });
  api.runtime.onMessage.addListener((message, sender, respond) => {
    if (typeof message?.action !== 'string' || !message.action.startsWith('assistant:')) return;
    if (!trustedPage(sender, api.runtime)) { respond({ success: false, error: '禁止访问浏览器助手' }); return; }
    (async () => {
      switch (message.action) {
        case 'assistant:get': return { state: runner.view(), config: await settings.publicConfig() };
        case 'assistant:tabs': return (await api.tabs.query({ lastFocusedWindow: true }))
          .filter(tab => /^https?:/.test(tab.url ?? '')).map(tab => ({ id: tab.id, title: tab.title?.slice(0, 160) || '网页', active: tab.active }));
        case 'assistant:config': {
          if (runner.session && ['preparing', 'preview', 'running', 'confirmation'].includes(runner.session.status)) throw new Error('任务运行期间不能修改模型配置');
          return settings.save(message.config);
        }
        case 'assistant:prepare': {
          if (!port) throw new Error('请先连接助手界面');
          const config = await settings.config();
          assertEndpoint(config.apiUrl);
          return runner.prepare({ tabId: message.tabId, mode: message.mode, task: message.task, config });
        }
        case 'assistant:preview': return runner.approvePreview(message.id, message.previewId);
        case 'assistant:confirm': return runner.confirm(message.id, message.confirmationId, message.approved);
        case 'assistant:stop': return runner.stop();
        default: throw new Error('未知助手操作');
      }
    })().then(data => respond({ success: true, data })).catch(error => respond({ success: false,
      error: error.code ? error.message : ['任务运行期间不能修改模型配置', '请先连接助手界面'].includes(error.message) ? error.message : '操作失败，请检查页面和配置' }));
    return true;
  });
  api.commands.onCommand.addListener(command => {
    if (command === 'open_browser_assistant') api.windows.getLastFocused().then(window => api.sidePanel.open({ windowId: window.id })).catch(() => {});
  });
  return runner;
}
