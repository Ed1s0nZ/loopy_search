import { fail } from './policy.js';
import { MAX_TASK_TABS, requireTaskTab } from './scope.js';
import { publicUrl, redactText } from './privacy.js';

export class TaskActions {
  constructor(browser) { this.browser = browser; }
  assertTarget(session, action) {
    if (['switch_tab', 'close_tab'].includes(action.tool)) requireTaskTab(session.scope, action.args.tabId);
    if (action.tool === 'close_tab' && session.scope.tabs.length < 2) throw fail('SCOPE', '不能关闭最后一个任务标签页');
    if (action.tool === 'open_tab' && session.scope.tabs.length >= MAX_TASK_TABS) throw fail('SCOPE', '任务最多允许 8 个标签页');
    if (action.args.snapshotId && (action.args.snapshotId !== session.observation.snapshotId || !session.observation.elements.some(element => element.id === action.args.elementId))) {
      throw fail('STALE_SNAPSHOT', '模型目标不属于最新观察，请重新开始');
    }
  }
  async pending(session, action, guard) {
    this.assertTarget(session, action);
    const pending = { id: crypto.randomUUID(), action,
      target: session.observation.elements.find(element => element.id === action.args.elementId) ?? { url: action.args.url } };
    if (action.tool === 'close_tab') {
      pending.closeTarget = await this.browser.describeTab(action.args.tabId, session.scope, session.controller.signal);
      guard();
      pending.target = { id: action.args.tabId, title: redactText(pending.closeTarget.title, [session.config.apiKey]), url: publicUrl(pending.closeTarget.url) };
    }
    return pending;
  }
  async execute(session, action, guard, pending) {
    guard(); this.assertTarget(session, action);
    const signal = session.controller.signal;
    switch (action.tool) {
      case 'observe': return { tool: action.tool, executed: false };
      case 'list_tabs': {
        const tabs = await this.browser.listScope(session.scope, [session.config.apiKey]); guard();
        session.scope.tabs = tabs; return { tool: action.tool, tabs, executed: false };
      }
      case 'switch_tab': session.tabId = action.args.tabId; return { tool: action.tool, tabId: session.tabId, executed: true };
      case 'open_tab': {
        const id = await this.browser.openTab(session.tabId, action.args.url, session.scope, signal, session.allowedDocument, guard);
        guard();
        session.scope.tabs.push({ id, title: '新建任务页面', url: publicUrl(action.args.url) });
        session.tabId = id; return { tool: action.tool, tabId: id, executed: true };
      }
      case 'close_tab': {
        if (!pending?.closeTarget) throw fail('STALE_CONFIRMATION', '缺少关闭目标的确认记录');
        await this.browser.closeTab(action.args.tabId, pending.closeTarget, session.scope, signal, guard); guard();
        session.scope.tabs = session.scope.tabs.filter(tab => tab.id !== action.args.tabId);
        if (session.tabId === action.args.tabId) session.tabId = session.scope.tabs[0].id;
        return { tool: action.tool, tabId: action.args.tabId, executed: true };
      }
      default: await this.browser.execute(session.tabId, action, signal, session.allowedDocument, session.scope, guard);
        return { tool: action.tool, executed: true };
    }
  }
}
