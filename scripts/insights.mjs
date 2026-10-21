// `npm run insights`: read-only pull of recent Instagram and Facebook post numbers for the weekly
// report. Writes reports/data/insights-<YYYY-MM-DD>.json and prints a compact table.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './lib/queue.mjs';
import { loadEnv } from './lib/env.mjs';
import { canReadInstagram, canReadFacebook, instagramInsights, facebookInsights } from './lib/meta-read.mjs';

export async function gather({ env = {}, fetchImpl = fetch, now = new Date() } = {}) {
  const out = { generated_at: now.toISOString(), instagram: [], facebook: [], errors: [] };
  const sources = [
    ['instagram', canReadInstagram, instagramInsights],
    ['facebook', canReadFacebook, facebookInsights],
  ];
  for (const [channel, ready, pull] of sources) {
    if (!ready(env)) { out.errors.push({ channel, error: 'not configured' }); continue; }
    try {
      out[channel] = await pull(env, fetchImpl);
    } catch (e) {
      out.errors.push({ channel, error: e.message });
    }
    for (const row of out[channel]) if (row.insights_error) out.errors.push({ channel, id: row.id, error: row.insights_error });
  }
  return out;
}

const COLS = ['date', 'channel', 'caption', 'reach', 'likes', 'reactions', 'comments', 'saved', 'shares'];

export function table(result) {
  const rows = [...result.instagram, ...result.facebook]
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
    .map((r) => ({
      date: String(r.at || '').slice(0, 10), channel: r.channel,
      caption: (r.caption || '').replace(/\s+/g, ' ').slice(0, 30),
      reach: r.reach, likes: r.likes, reactions: r.reactions, comments: r.comments, saved: r.saved, shares: r.shares,
    }))
    .map((r) => COLS.map((c) => (r[c] === undefined || r[c] === null ? '-' : String(r[c]))));
  const all = [COLS, ...rows];
  const w = COLS.map((_, i) => Math.max(...all.map((r) => r[i].length)));
  return all.map((r) => r.map((v, i) => v.padEnd(w[i])).join('  ').trimEnd()).join('\n');
}

async function main() {
  const result = await gather({ env: loadEnv(), fetchImpl: fetch });
  const dir = join(ROOT, 'reports', 'data');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `insights-${result.generated_at.slice(0, 10)}.json`);
  writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
  if (result.instagram.length + result.facebook.length) console.log(table(result));
  else console.log('no posts returned');
  for (const e of result.errors) console.log(`${e.channel}${e.id ? ` ${e.id}` : ''}: ${e.error}`);
  console.log(`written to ${relative(process.cwd(), file) || file}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main().catch((e) => { console.error(e.message); process.exit(1); });
