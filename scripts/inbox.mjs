// `npm run inbox`: read-only sweep of new CRM leads and Instagram/Facebook comments.
// Writes only new items to reports/inbox/<stamp>.json (git-ignored: it holds personal data) and
// remembers what it has seen in reports/inbox/seen.json. It never replies, posts or writes to the CRM.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './lib/queue.mjs';
import { loadEnv } from './lib/env.mjs';
import { canRead, newLeads } from './lib/crm.mjs';
import { canReadInstagram, canReadFacebook, instagramComments, facebookComments } from './lib/meta-read.mjs';

export const INBOX_DIR = join(ROOT, 'reports', 'inbox');
const SEEN_FILE = join(INBOX_DIR, 'seen.json');

export function leadItem(l) {
  return {
    type: 'lead', source: 'crm', key: `crm:${l.id}`, id: l.id, reference: l.reference ?? null,
    name: l.name ?? null, phone: l.phone ?? null, email: l.email ?? null,
    requirement: l.requirement ?? null, at: l.createdAt ?? null,
  };
}

export const commentItem = (c) => ({ ...c, source: c.channel, key: `${c.channel}:${c.id}` });

// Pure: keep items whose key is not in `seen` (and not repeated within this batch).
export function newItems(items, seen = []) {
  const known = new Set(seen);
  const out = [];
  for (const item of items) {
    if (!item?.key || known.has(item.key)) continue;
    known.add(item.key);
    out.push(item);
  }
  return out;
}

const SOURCES = [
  { name: 'crm', ready: canRead, fetch: async (env, f) => (await newLeads(env, f)).map(leadItem) },
  { name: 'instagram', ready: canReadInstagram, fetch: async (env, f) => (await instagramComments(env, f)).map(commentItem) },
  { name: 'facebook', ready: canReadFacebook, fetch: async (env, f) => (await facebookComments(env, f)).map(commentItem) },
];

// Each source is optional; a failing source is reported, not fatal.
export async function collect({ env = {}, fetchImpl = fetch, seen = [] } = {}) {
  const all = [];
  const report = {};
  for (const s of SOURCES) {
    if (!s.ready(env)) { report[s.name] = { status: 'not configured' }; continue; }
    try {
      const got = await s.fetch(env, fetchImpl);
      all.push(...got);
      report[s.name] = { status: 'ok', fetched: got.length };
    } catch (e) {
      report[s.name] = { status: 'error', error: e.message };
    }
  }
  const items = newItems(all, seen);
  for (const s of SOURCES) if (report[s.name].status === 'ok') report[s.name].new = items.filter((i) => i.source === s.name).length;
  return { items, report };
}

export function readSeen(file = SEEN_FILE) {
  if (!existsSync(file)) return [];
  try {
    const v = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export const stamp = (d = new Date()) => d.toISOString().slice(0, 16).replace(':', '-');

async function main() {
  mkdirSync(INBOX_DIR, { recursive: true });
  const seen = readSeen();
  if (!existsSync(SEEN_FILE)) writeFileSync(SEEN_FILE, '[]\n');
  const { items, report } = await collect({ env: loadEnv(), fetchImpl: fetch, seen });

  for (const [name, r] of Object.entries(report)) {
    if (r.status === 'ok') console.log(`${name}: ${r.fetched} fetched, ${r.new} new`);
    else if (r.status === 'error') console.log(`${name}: error: ${r.error}`);
  }
  const off = Object.entries(report).filter(([, r]) => r.status === 'not configured').map(([n]) => n);

  if (!items.length) {
    console.log('nothing new');
  } else {
    const file = join(INBOX_DIR, `${stamp()}.json`);
    writeFileSync(file, JSON.stringify({ generated_at: new Date().toISOString(), report, items }, null, 2) + '\n');
    writeFileSync(SEEN_FILE, JSON.stringify([...seen, ...items.map((i) => i.key)], null, 2) + '\n');
    console.log(`${items.length} new item(s) written to ${relative(process.cwd(), file) || file}`);
  }
  if (off.length) console.log(`not configured: ${off.join(', ')} (see .env.example)`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main().catch((e) => { console.error(e.message); process.exit(1); });
