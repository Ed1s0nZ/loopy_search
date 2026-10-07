import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { scanRepository } from './secret-scan.mjs';

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
for (const file of files.filter(file => /\.(js|mjs)$/.test(file))) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const required = [manifest.background.service_worker, manifest.action.default_popup, manifest.options_page, manifest.side_panel.default_path,
  ...manifest.content_scripts.flatMap(script => [...script.js, ...script.css])];
for (const file of required) if (!existsSync(file)) throw new Error(`Missing extension resource: ${file}`);
if (manifest.background.type !== 'module' || !manifest.permissions.includes('sidePanel')) throw new Error('Missing assistant manifest settings');
const leaks = scanRepository();
for (const issue of leaks) console.error(`${issue.file}:${issue.line}: ${issue.kind} (value suppressed)`);
if (leaks.length) process.exit(1);
execFileSync('git', ['diff', '--check'], { stdio: 'inherit' });
console.log('Syntax, manifest resources, whitespace and secret checks passed.');
