import { captureObservation, modelObservation, clearVision } from './vision-session.js';
import { parseAction, validateAction, WRITE_TOOLS, fail } from './policy.js';
import { SYSTEM_PROMPT } from './model.js';
import { redactText, publicUrl } from './privacy.js';
import { AutomaticGrants } from './grants.js';
import { TaskActions } from './actions.js';
import { validateTabIds, publicScope } from './scope.js';

const ACTIVE = new Set(['preparing', 'preview', 'running', 'confirmation']);
const clone = value => structuredClone(value);

export class AssistantRunner {
  constructor({ browser, complete, notify = () => {}, maxSteps = 16, maxTimeMs = 180000, now = Date.now }) {
    Object.assign(this, { browser, complete, notify, maxSteps, maxTimeMs, now });
    this.actions = new TaskActions(browser); this.session = null; this.revision = 0;
  }
  view() {
    const session = this.session;
    if (!session) return { status: 'idle', events: [], revision: this.revision };
    return clone({ revision: this.revision, id: session.id, tabId: session.tabId, frameId: session.frameId, status: session.status, mode: session.mode,
      task: session.task, steps: session.steps, events: session.events, result: session.result, error: session.error,
      vision: session.vision, scope: session.scope ? publicScope(session.scope) : [], automation: session.grants.view(),
      pending: session.pending ? { id: session.pending.id, action: session.pending.action, target: session.pending.target } : null,
      preview: session.status === 'preview' ? session.preview : null,
      model: session.config.model, endpoint: publicUrl(session.config.apiUrl), usage: session.usage });
  }
  publish() { this.revision++; this.notify(this.view()); }
  event(type, message) {
    const session = this.session;
    session.events.push({ time: this.now(), type, message: redactText(message, [session.config.apiKey]).slice(0, 1000) });
    session.events = session.events.slice(-80); this.publish();
  }
  assertRunning(session) {
    if (this.session !== session || !ACTIVE.has(session.status) || session.controller.signal.aborted) throw fail('STOPPED', '任务已停止');
    if (this.now() - session.started > this.maxTimeMs) throw fail('TIMEOUT', '任务达到时间上限，请缩小任务后重试');
  }
  async prepare({ tabId, tabIds, mode, task, config, incognito, frameIds, frameDocuments, vision = false }) {
    if (this.session && (ACTIVE.has(this.session.status) || this.session.inFlight)) throw fail('BUSY', '请先停止当前任务并等待结束');
    validateTabIds(tabId, tabIds);
    if (typeof vision !== 'boolean') throw fail('INVALID_TASK', '视觉开关无效');
    clearVision(this.browser, this.session);
    if (!['read', 'assist', 'auto'].includes(mode) || typeof task !== 'string' || !task.trim() || task.length > 4000) throw fail('INVALID_TASK', '请填写有效任务（最多 4000 字）');
    const session = { id: crypto.randomUUID(), tabId, frameId: 0, mode, vision, task: redactText(task.trim(), [config.apiKey]),
      config: { ...config }, status: 'preparing', steps: 0, events: [], controller: new AbortController(),
      started: this.now(), usage: { prompt_tokens: 0, completion_tokens: 0 }, messages: [], inFlight: true,
      grants: new AutomaticGrants({ now: this.now }) };
    this.session = session; this.publish();
    try {
      session.scope = await this.browser.prepareScope(tabId, tabIds, [config.apiKey], incognito); this.assertRunning(session);
      if (frameIds !== undefined) await this.browser.frames.prepare(tabId, frameIds, session.scope, frameDocuments);
      this.assertRunning(session);
      let observation = await this.browser.observe(tabId, [config.apiKey], session.controller.signal, session.scope, session.frameId);
      if (this.browser.frames) observation.frames = await this.browser.frames.list(session.tabId, session.scope, [session.config.apiKey]);
      observation = await captureObservation(this.browser, session, observation);
      this.assertRunning(session); this.setPreview(session, observation);
    } catch (error) { this.handleError(session, error); }
    finally { session.inFlight = false; this.publish(); }
    return this.view();
  }
  setPreview(session, observation) {
    session.grants.clear(); session.observation = observation;
    const { documentKey, ...preview } = observation;
    session.preview = { ...preview, tabs: publicScope(session.scope), id: crypto.randomUUID() };
    session.previewId = session.preview.id; session.status = 'preview';
    this.event('preview', '请核对脱敏页面、标签范围和模型服务，批准后才发送内容');
  }
  async maskVision(id, previewId, masks) {
    const session = this.session;
    if (session?.id !== id || !session.vision || session.status !== 'preview' || session.previewId !== previewId || session.inFlight) throw fail('STALE_CONFIRMATION', '截图预览已过期');
    this.assertRunning(session); session.inFlight = true;
    try {
      const vision = await this.browser.vision.mask(session.tabId, session.observation.vision.id, masks, session.scope, session.controller.signal, session.observation.documentKey);
      this.assertRunning(session); this.setPreview(session, { ...session.observation, vision });
    } finally { session.inFlight = false; this.publish(); }
    return this.view();
  }
  approvePreview(id, previewId, automation) {
    const session = this.session;
    if (session?.id !== id || session.status !== 'preview' || session.previewId !== previewId || session.inFlight) throw fail('STALE_CONFIRMATION', '页面预览已过期');
    this.assertRunning(session);
    session.grants.issue(session.observation, automation, session.mode);
    session.allowedDocument = session.observation.documentKey; session.status = 'running'; session.preview = null;
    if (!session.messages.length) session.messages = [{ role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify({ task: session.task, mode: session.mode, tabs: publicScope(session.scope) }) }];
    this.event('consent', '已批准向当前模型服务发送脱敏上下文');
    void this.pump(session); return this.view();
  }
  async perform(session, action, ticket, pending) {
    const guard = () => { this.assertRunning(session); if (ticket) session.grants.assertTicket(ticket); };
    guard();
    const result = await this.actions.execute(session, action, guard, pending); this.assertRunning(session);
    session.messages.push({ role: 'user', content: JSON.stringify({ toolResult: result, note: '根据新的页面观察判断结果' }) });
    let observation = await this.browser.observe(session.tabId, [session.config.apiKey], session.controller.signal, session.scope, session.frameId);
    this.assertRunning(session);
    const tab = session.scope.tabs.find(tab => tab.id === session.tabId);
    if (tab && session.frameId === 0) { tab.title = observation.title; tab.url = observation.url; }
    if (this.browser.frames) observation.frames = await this.browser.frames.list(session.tabId, session.scope, [session.config.apiKey]);
    observation = await captureObservation(this.browser, session, observation); this.assertRunning(session);
    if (session.vision || observation.documentKey !== session.allowedDocument) this.setPreview(session, observation);
    else session.observation = observation;
  }
  async pump(session) {
    session.inFlight = true;
    try {
      while (session.status === 'running') {
        this.assertRunning(session);
        if (session.steps >= this.maxSteps) throw fail('LIMIT', '达到步骤上限，请拆分任务');
        const observationMessage = await modelObservation(this.browser, session); this.assertRunning(session);
        session.messages.push(observationMessage);
        this.event('model', '正在请求下一步动作');
        const output = await this.complete(session.config, session.messages, { signal: session.controller.signal });
        this.assertRunning(session);
        if (output.usage) for (const key of ['prompt_tokens', 'completion_tokens']) session.usage[key] += output.usage[key] || 0;
        const action = parseAction(output.content, session.mode);
        session.messages.push({ role: 'assistant', content: JSON.stringify(action) }); session.steps++;
        if (action.tool === 'finish') {
          session.result = redactText(action.args.summary, [session.config.apiKey]); session.grants.clear();
          session.status = 'completed'; clearVision(this.browser, session); this.event('completed', '任务完成'); break;
        }
        this.assertActionTarget(session, action);
        const ticket = session.mode === 'auto' ? session.grants.consume(action, session.observation) : null;
        if (WRITE_TOOLS.has(action.tool) && !ticket) {
          const pending = await this.actions.pending(session, action, () => this.assertRunning(session));
          this.assertRunning(session); session.pending = pending;
          session.status = 'confirmation'; this.event('confirmation', '等待你批准本次操作；未使用自动授权'); break;
        }
        if (ticket) this.event('automatic', `按已授权范围执行 ${action.tool}；剩余 ${session.grants.remaining} 次`);
        await this.perform(session, action, ticket);
      }
    } catch (error) { this.handleError(session, error); }
    finally { session.inFlight = false; this.publish(); }
  }
  assertActionTarget(session, action) { validateAction(action, session.mode); this.actions.assertTarget(session, action); }
  async confirm(id, confirmationId, approved) {
    const session = this.session;
    if (session?.id !== id || session.status !== 'confirmation' || session.pending?.id !== confirmationId || session.inFlight) throw fail('STALE_CONFIRMATION', '操作确认已过期');
    this.assertRunning(session);
    if (approved !== true) return this.stop('你拒绝了本次操作');
    const pending = session.pending; const action = clone(pending.action);
    this.assertActionTarget(session, action); session.pending = null; session.status = 'running'; session.inFlight = true;
    this.event('action', `已批准 ${action.tool}；执行后重新观察`);
    try { await this.perform(session, action, null, pending); }
    catch (error) { this.handleError(session, error); }
    finally { session.inFlight = false; this.publish(); }
    if (session.status === 'running') void this.pump(session);
    return this.view();
  }
  revoke(id) {
    const session = this.session;
    if (session?.id !== id) throw fail('STALE_CONFIRMATION', '任务已过期');
    session.grants.clear(); this.event('revoke', '自动授权已撤销；后续写入需要单次确认'); return this.view();
  }
  stop(message = '任务已停止；已执行动作不会自动撤销') {
    const session = this.session;
    if (session && ACTIVE.has(session.status)) {
      session.status = 'stopped'; session.pending = null; session.preview = null; session.grants.clear();
      clearVision(this.browser, session);
      session.controller.abort(fail('STOPPED', '任务已停止')); this.event('stopped', message);
    }
    return this.view();
  }
  handleError(session, error) {
    if (this.session !== session || session.status === 'stopped') return;
    session.status = 'failed'; session.pending = null; session.preview = null; session.grants.clear();
    session.error = { code: error.code ?? 'INTERNAL', message: error.code ? redactText(error.message, [session.config.apiKey]) : '操作失败；请检查页面权限或重新开始' };
    clearVision(this.browser, session); session.controller.abort(); this.event('failed', session.error.message);
  }
}
