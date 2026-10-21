// Reads KEY=value pairs from .env for scripts that need credentials, so tokens never have to live
// in the shell or in Claude's environment. Values already set in the environment win.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './queue.mjs';

export function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    // Quoted values are taken as-is; unquoted values end at an inline " # comment".
    const quoted = m[2].match(/^(['"])(.*?)\1/);
    out[m[1]] = quoted ? quoted[2] : m[2].replace(/\s+#.*$/, '');
  }
  return out;
}

export function loadEnv(root = ROOT, base = process.env) {
  const path = join(root, '.env');
  let fromFile = {};
  try {
    if (existsSync(path)) fromFile = parseEnv(readFileSync(path, 'utf8'));
  } catch {
    // Inside the agents' sandbox .env is unreadable on purpose: carry on without credentials.
  }
  const env = { ...base };
  for (const [k, v] of Object.entries(fromFile)) if (!env[k] && v) env[k] = v;
  return env;
}
