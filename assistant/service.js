import { createBrowserTools } from './browser.js';
import { AssistantRunner } from './runner.js';
import { complete } from './model.js';
import { assertEndpoint, trustedPage } from './policy.js';
import { frameSummary } from './frame-adapter.js';
import { tabSummary } from './scope.js';

export function installAssistant(api, settings) {
  let port = null;
  const browser = createBrowserTools(api);
  const runner = new AssistantRunner({ browser, complete,
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
        case 'assistant:tabs': {
          const query = sender.tab ? { windowId: sender.tab.windowId } : { lastFocusedWindow: true };
          const incognito = Boolean(sender.tab?.incognito ?? api.extension?.inIncognitoContext);
          const config = await settings.config();
          return (await api.tabs.query(query)).filter(tab => /^https?:/.test(tab.url ?? '') && Boolean(tab.incognito) === incognito)
            .map(tab => ({ ...tabSummary(tab, [config.apiKey]), active: tab.active }));
        }
        case 'assistant:frames': {
          const tab = await api.tabs.get(message.tabId);
          if (Boolean(tab.incognito) !== Boolean(sender.tab?.incognito ?? api.extension?.inIncognitoContext) || sender.tab && tab.windowId !== sender.tab.windowId) throw new Error('框架不在当前窗口/环境');
          const config = await settings.config();
          return (await browser.frames.catalog(message.tabId)).map(frame => ({ ...frameSummary(frame, [config.apiKey]), documentId: frame.documentId }));
        }
        case 'assistant:config': {
          if (runner.session && ['preparing', 'preview', 'running', 'confirmation'].includes(runner.session.status)) throw new Error('任务运行期间不能修改模型配置');
          return settings.save(message.config);
        }
        case 'assistant:prepare': {
          if (!port) throw new Error('请先连接助手界面');
          const config = await settings.config();
          assertEndpoint(config.apiUrl);
          return runner.prepare({ tabId: message.tabId, tabIds: message.tabIds, frameIds: message.frameIds, frameDocuments: message.frameDocuments, mode: message.mode, vision: message.vision, task: message.task, config,
            incognito: Boolean(sender.tab?.incognito ?? api.extension?.inIncognitoContext) });
        }
        case 'assistant:visionMasks': return runner.maskVision(message.id, message.previewId, message.masks);
        case 'assistant:preview': return runner.approvePreview(message.id, message.previewId, message.automation);
        case 'assistant:confirm': return runner.confirm(message.id, message.confirmationId, message.approved);
        case 'assistant:stop': return runner.stop();
        case 'assistant:revoke': return runner.revoke(message.id);
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
