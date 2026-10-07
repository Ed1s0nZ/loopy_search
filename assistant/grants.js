import { fail } from './policy.js';

const AUTO_TOOLS = new Set(['click', 'fill', 'select']);
export class AutomaticGrants {
  constructor({ now = Date.now, ttlMs = 60000 } = {}) {
    this.now = now; this.ttlMs = ttlMs; this.clear();
  }
  clear() {
    this.generation = (this.generation ?? 0) + 1;
    this.rules = new Map(); this.remaining = 0; this.expires = 0; this.documentKey = null;
    this.descriptions = [];
  }
  issue(observation, automation, mode) {
    if (automation === undefined) { this.clear(); return; }
    if (mode !== 'auto' || !automation || typeof automation !== 'object' || Array.isArray(automation) ||
        Object.keys(automation).some(key => !['grants', 'limit', 'acknowledged'].includes(key)) || !Array.isArray(automation.grants) ||
        automation.grants.length > 24 || !Number.isInteger(automation.limit ?? 3) || (automation.limit ?? 3) < 1 || (automation.limit ?? 3) > 8) {
      throw fail('INVALID_GRANT', '自动授权必须在自动模式中明确选择，次数为 1–8');
    }
    if (automation.grants.length && automation.acknowledged !== true) throw fail('INVALID_GRANT', '请明确同意所选元素的自动操作');
    const rules = new Map(); const descriptions = [];
    for (const grant of automation.grants) {
      if (!grant || typeof grant !== 'object' || Object.keys(grant).some(key => !['elementId', 'tool'].includes(key)) || !AUTO_TOOLS.has(grant.tool)) {
        throw fail('INVALID_GRANT', '只能授权当前元素的点击、填写或选择');
      }
      const element = observation.elements.find(element => element.id === grant.elementId);
      if (!element?.grantId || !element.capabilities?.includes(grant.tool)) throw fail('INVALID_GRANT', '授权目标不属于本次预览或不支持此操作');
      const key = `${element.grantId}|${grant.tool}`;
      if (rules.has(key)) throw fail('INVALID_GRANT', '不能重复授权同一操作');
      rules.set(key, true); descriptions.push({ elementId: element.id, tool: grant.tool, label: element.label });
    }
    this.clear(); this.rules = rules; this.descriptions = descriptions;
    this.documentKey = observation.documentKey;
    this.remaining = rules.size ? automation.limit ?? 3 : 0;
    this.expires = this.now() + this.ttlMs;
  }
  consume(action, observation) {
    const element = observation.elements.find(element => element.id === action.args.elementId);
    if (this.remaining <= 0 || this.now() >= this.expires || this.documentKey !== observation.documentKey ||
        !element?.grantId || !this.rules.has(`${element.grantId}|${action.tool}`)) return null;
    this.remaining--;
    return { generation: this.generation, expires: this.expires };
  }
  assertTicket(ticket) {
    if (ticket.generation !== this.generation || this.now() >= ticket.expires) throw fail('GRANT_REVOKED', '自动授权已撤销或过期，未派发页面操作');
  }
  view() {
    return { remaining: this.now() < this.expires ? this.remaining : 0, expires: this.expires,
      grants: [...this.descriptions], active: this.rules.size > 0 && this.remaining > 0 && this.now() < this.expires };
  }
}
