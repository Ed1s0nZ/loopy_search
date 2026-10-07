import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function findLeaks(text, exactSecrets = []) {
  const patterns = [
    /\b(?:sk|ghp|gho|github_pat)[-_][A-Za-z0-9_-]{16,}\b/g,
    /\bAKIA[A-Z0-9]{16}\b/g,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    /["']?(?:api[_-]?key|access[_-]?token|proxyPassword|password)["']?\s*[:=]\s*["'](?!\[|<|your|example|placeholder)[A-Za-z0-9_./+=-]{16,}["']/gi
  ];
  const issues = [];
  for (const pattern of patterns) for (const match of text.matchAll(pattern)) issues.push({ line: text.slice(0, match.index).split('\n').length, kind: 'credential pattern' });
  for (const secret of exactSecrets) if (secret.length >= 8 && text.includes(secret)) issues.push({ line: text.slice(0, text.indexOf(secret)).split('\n').length, kind: 'local credential match' });
  return issues;
}
export function scanRepository({ staged = false } = {}) {
  const args = staged ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'] : ['ls-files', '--cached', '--others', '--exclude-standard', '-z'];
  const files = [...new Set(execFileSync('git', args, { encoding: 'utf8' }).split('\0').filter(Boolean))];
  let secrets = [];
  // Optional local exact-match guard. Never print credential values or matching text.
  try { const data = JSON.parse(readFileSync(`${process.env.HOME}/.config/loopy-search/testing.json`, 'utf8')); secrets = [data.apiKey].filter(value => typeof value === 'string'); } catch { /* CI has no private local configuration */ }
  const findings = [];
  for (const file of files) {
    let bytes;
    try { bytes = staged ? execFileSync('git', ['show', `:${file}`], { maxBuffer: 16000000 }) : readFileSync(file); } catch { continue; }
    if (bytes.includes(0) || /\.(png|jpe?g|gif|webp|ico|pdf|zip)$/i.test(file)) continue;
    for (const issue of findLeaks(bytes.toString('utf8'), secrets)) findings.push({ file, ...issue });
  }
  return findings;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const findings = scanRepository({ staged: process.argv.includes('--staged') });
  for (const issue of findings) console.error(`${issue.file}:${issue.line}: ${issue.kind} (value suppressed)`);
  if (findings.length) process.exitCode = 1;
  else console.log('Secret scan passed; no credential values printed.');
}
