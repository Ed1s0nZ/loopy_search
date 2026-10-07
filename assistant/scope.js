import { assertWebUrl, fail } from './policy.js';
import { publicUrl, redactText } from './privacy.js';

export const MAX_TASK_TABS = 8;
export function validateTabIds(tabId, tabIds = [tabId]) {
  if (!Number.isInteger(tabId) || tabId < 0 || !Array.isArray(tabIds) || !tabIds.length || tabIds.length > MAX_TASK_TABS ||
      tabIds.some(id => !Number.isInteger(id) || id < 0) || new Set(tabIds).size !== tabIds.length || !tabIds.includes(tabId)) {
    throw fail('SCOPE', '请选择初始页及最多 8 个不同的任务标签页');
  }
  return [...tabIds];
}
export function assertScopedTab(scope, tab) {
  if (!scope.tabs.some(item => item.id === tab.id) || tab.windowId !== scope.windowId || Boolean(tab.incognito) !== scope.incognito) {
    throw fail('SCOPE', '标签页不在本次授权窗口或环境中');
  }
  assertWebUrl(tab.url);
  return tab;
}
export function tabSummary(tab, secrets = []) {
  return { id: tab.id, title: redactText(tab.title || '网页', secrets).slice(0, 160), url: publicUrl(tab.url, secrets) };
}
export function publicScope(scope) {
  return scope.tabs.map(tab => ({ id: tab.id, title: tab.title, url: tab.url }));
}
export function requireTaskTab(scope, tabId) {
  if (!scope.tabs.some(tab => tab.id === tabId)) throw fail('SCOPE', 'AI 只能使用你选定或确认新开的标签页');
}
