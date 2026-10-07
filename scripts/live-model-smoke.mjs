// Explicit opt-in. Reads private config outside the repository; one tiny read-only call.
import { readFile } from 'node:fs/promises';
import { complete, SYSTEM_PROMPT } from '../assistant/model.js';
import { parseAction } from '../assistant/policy.js';

const file = process.env.LOOPY_TEST_CONFIG || `${process.env.HOME}/.config/loopy-search/testing.json`;
let config;
try { config = JSON.parse(await readFile(file, 'utf8')); }
catch { console.error('Private test configuration unavailable. No credentials are read from repository files.'); process.exit(1); }
try {
  const output = await complete(config, [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: JSON.stringify({
    task: '只读总结下面的合成公告。直接用 finish 返回一句话，不调用其他工具。', mode: 'read',
    observation: { snapshotId: 'synthetic-snapshot', url: 'https://example.test/', title: '合成公告', text: 'Example 1.0 存在输入校验问题，建议升级 1.1。', elements: [] }
  }) }], { maxTokens: 160, timeoutMs: 30000 });
  const action = parseAction(output.content, 'read');
  if (action.tool !== 'finish') throw new Error('Expected finish for read-only fixture');
  console.log(JSON.stringify({ passed: true, tool: action.tool, usage: output.usage, note: 'One read-only synthetic request; no browser mutation and no response/credential printed.' }));
} catch (error) {
  console.error(JSON.stringify({ passed: false, code: error.code ?? 'SMOKE_FAILED', message: error.code ? error.message : 'Read-only smoke failed' }));
  process.exitCode = 1;
} finally { config.apiKey = ''; }
