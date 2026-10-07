const tools = {
  observe: [], click: ['snapshotId', 'elementId'],
  fill: ['snapshotId', 'elementId', 'value'], select: ['snapshotId', 'elementId', 'value'],
  scroll: ['direction', 'amount'], navigate: ['url'], finish: ['summary'],
  list_tabs: [], switch_tab: ['tabId'], open_tab: ['url'], close_tab: ['tabId']
};
export const WRITE_TOOLS = new Set(['click', 'fill', 'select', 'navigate', 'open_tab', 'close_tab']);

export function fail(code, message) {
  const error = new Error(message); error.code = code; return error;
}
export function assertWebUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) throw fail('INVALID_URL', '网址格式无效');
  let url;
  try { url = new URL(value); } catch { throw fail('INVALID_URL', '需要完整 HTTP(S) 网址'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw fail('INVALID_URL', '只允许不含凭据的 HTTP(S) 网址');
  }
  return url;
}
export function assertEndpoint(value) {
  const url = assertWebUrl(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !local) throw fail('CONFIG', '远程模型服务必须使用 HTTPS');
  if (url.search || url.hash) throw fail('CONFIG', '模型地址不能包含查询参数或片段');
  return url.href;
}
export function validateAction(raw, mode = 'read') {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw fail('INVALID_ACTION', '模型动作必须是 JSON 对象');
  if (Object.keys(raw).some(key => !['tool', 'args', 'reason'].includes(key))) throw fail('INVALID_ACTION', '模型动作包含未知字段');
  const allowed = Object.hasOwn(tools, raw.tool) ? tools[raw.tool] : null;
  if (!allowed) throw fail('INVALID_ACTION', '不支持的工具');
  const args = raw.args ?? {};
  if (typeof args !== 'object' || args === null || Array.isArray(args) || Object.keys(args).some(key => !allowed.includes(key))) {
    throw fail('INVALID_ACTION', '工具参数不符合合同');
  }
  for (const key of allowed) {
    if (key === 'amount') continue;
    if (key === 'tabId') {
      if (!Number.isInteger(args[key]) || args[key] < 0) throw fail('INVALID_ACTION', '需要有效标签页 ID');
      continue;
    }
    if (typeof args[key] !== 'string' || !args[key].trim() && key !== 'value') throw fail('INVALID_ACTION', `缺少有效 ${key}`);
    if (args[key].length > (key === 'summary' ? 12000 : key === 'value' ? 4000 : 2048)) throw fail('INVALID_ACTION', '参数过长');
  }
  if (args.snapshotId && !/^[a-zA-Z0-9-]{8,80}$/.test(args.snapshotId)) throw fail('INVALID_ACTION', '无效快照标识');
  if (args.elementId && !/^e\d{1,3}$/.test(args.elementId)) throw fail('INVALID_ACTION', '无效元素标识');
  if (raw.tool === 'scroll' && (!['up', 'down'].includes(args.direction) || args.amount !== undefined && (!Number.isInteger(args.amount) || args.amount < 100 || args.amount > 1200))) {
    throw fail('INVALID_ACTION', '滚动范围必须为 100–1200 像素');
  }
  if (['navigate', 'open_tab'].includes(raw.tool)) assertWebUrl(args.url);
  if (!['read', 'assist', 'auto'].includes(mode)) throw fail('INVALID_ACTION', '无效模式');
  if (mode === 'read' && WRITE_TOOLS.has(raw.tool)) throw fail('READ_ONLY', '只读模式不允许页面写入、导航、新开或关闭标签；请切换辅助模式后重新开始');
  if (raw.reason !== undefined && (typeof raw.reason !== 'string' || raw.reason.length > 1000)) throw fail('INVALID_ACTION', '无效动作说明');
  return { tool: raw.tool, args: { ...args }, reason: raw.reason ?? '' };
}
export function parseAction(text, mode) {
  const cleaned = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let raw;
  try { raw = JSON.parse(cleaned); } catch { throw fail('INVALID_ACTION', '模型未返回有效 JSON 动作，请重试或更换模型'); }
  return validateAction(raw, mode);
}
export function trustedPage(sender, runtime, paths = ['assistant.html']) {
  // Extension pages opened as tabs also have sender.tab. URL is supplied by Chrome.
  return sender?.id === runtime.id && paths.some(path => sender.url === runtime.getURL(path));
}
