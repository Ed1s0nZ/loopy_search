import { complete } from '../assistant/model.js';
import { fail } from '../assistant/policy.js';

export async function legacyAI(request, sender, api, settings) {
  if (sender.id !== api.runtime.id || !settings.isTrusted(sender) && !(sender.tab && /^https?:/.test(sender.url ?? ''))) throw fail('FORBIDDEN', '禁止访问');
  const config = await settings.config();
  const input = request.data;
  if (!Array.isArray(input?.messages) || input.messages.length > 100 || JSON.stringify(input.messages).length > 200000 ||
      input.messages.some(message => !['system', 'user', 'assistant'].includes(message.role) || typeof message.content !== 'string')) throw fail('INVALID_REQUEST', 'AI 消息格式无效');
  // The background selects endpoint and credentials, never a page-supplied key/URL.
  const temperature = typeof input.temperature === 'number' && input.temperature >= 0 && input.temperature <= 2 ? input.temperature : 0.7;
  const result = await complete(config, input.messages, { maxTokens: 4096, timeoutMs: 60000, temperature });
  return { success: true, data: { choices: [{ message: { role: 'assistant', content: result.content }, finish_reason: result.finishReason }] } };
}
