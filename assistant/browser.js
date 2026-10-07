import { pageTool } from './page-tools.js';
import { assertWebUrl, fail } from './policy.js';
import { sanitizeObservation } from './privacy.js';

export function createBrowserTools(api) {
  async function check(tabId) {
    const tab = await api.tabs.get(tabId);
    try { assertWebUrl(tab.url); } catch { throw fail('PAGE_UNAVAILABLE', '无法操作此页面；请打开普通 HTTP(S) 网页'); }
    return tab;
  }
  async function ready(tabId, signal) {
    for (let i = 0; i < 40; i++) {
      if (signal?.aborted) throw fail('STOPPED', '任务已停止');
      const tab = await check(tabId);
      if (tab.status === 'complete') return;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw fail('TIMEOUT', '页面尚未加载完成，请稍后重新开始');
  }
  async function invoke(tabId, command, args, signal) {
    await ready(tabId, signal);
    if (signal?.aborted) throw fail('STOPPED', '任务已停止');
    const results = await api.scripting.executeScript({ target: { tabId }, world: 'ISOLATED', func: pageTool, args: [command, args] });
    const result = results?.[0]?.result;
    if (!result?.ok) throw fail(result?.code ?? 'PAGE_UNAVAILABLE', result?.error ?? '无法读取页面；请检查扩展站点访问权限');
    return result;
  }
  return {
    async observe(tabId, secrets, signal) {
      const tab = await check(tabId);
      const observation = sanitizeObservation(await invoke(tabId, 'observe', {}, signal), secrets);
      return { ...observation, documentKey: `${new URL(tab.url).origin}|${tab.url}` };
    },
    async execute(tabId, action, signal, expectedDocument) {
      const tab = await check(tabId);
      if (expectedDocument && `${new URL(tab.url).origin}|${tab.url}` !== expectedDocument) throw fail('STALE_SNAPSHOT', '目标标签页已经导航，请重新开始');
      if (signal?.aborted) throw fail('STOPPED', '任务已停止');
      if (action.tool === 'navigate') {
        const url = assertWebUrl(action.args.url).href;
        await api.tabs.update(tabId, { url });
        await ready(tabId, signal);
        return { ok: true, message: '导航完成' };
      }
      return invoke(tabId, action.tool, action.args, signal);
    }
  };
}
