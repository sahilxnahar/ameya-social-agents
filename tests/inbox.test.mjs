// Inbox, CRM, Meta read and env tests. Every network call goes to a fake fetch; files go to a temp root.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = mkdtempSync(join(tmpdir(), 'sma-inbox-'));
process.env.SMA_ROOT = root;

let crm, meta, env, inbox, insights;
before(async () => {
  crm = await import('../scripts/lib/crm.mjs');
  meta = await import('../scripts/lib/meta-read.mjs');
  env = await import('../scripts/lib/env.mjs');
  inbox = await import('../scripts/inbox.mjs');
  insights = await import('../scripts/insights.mjs');
});

// Fake fetch: `routes` maps a URL substring to [status, body]. Records every call.
function fakeFetch(routes) {
  const calls = [];
  const f = async (url, opts = {}) => {
    calls.push({ url: String(url), opts });
    const hit = Object.keys(routes).filter((k) => String(url).includes(k)).sort((a, b) => b.length - a.length)[0];
    const [status, body] = hit ? routes[hit] : [404, { error: { message: 'no route' } }];
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  f.calls = calls;
  return f;
}

const CRM_ENV = { CRM_API_URL: 'https://crm.test/', CRM_READ_TOKEN: 'read-tok' };
const META_ENV = { IG_USER_ID: 'ig1', META_PAGE_ID: 'pg1', META_PAGE_TOKEN: 'ptok', IG_USERNAME: 'AmeyaHeights' };
const LEAD = { id: 'L1', reference: 'AH-001', name: 'Test Lead', email: 't@example.test', phone: '+911234567890', source: 'WEBSITE', status: 'NEW', score: 40, budgetMax: null, requirement: 'Office space', createdAt: '2026-10-20T10:00:00Z', updatedAt: '2026-10-20T10:00:00Z' };

test('crm.newLeads calls the NEW leads endpoint with the read token', async () => {
  const f = fakeFetch({ '/api/v1/leads': [200, { ok: true, count: 1, data: [LEAD] }] });
  const leads = await crm.newLeads(CRM_ENV, f, 5);
  assert.equal(f.calls[0].url, 'https://crm.test/api/v1/leads?status=NEW&limit=5');
  assert.equal(f.calls[0].opts.headers.Authorization, 'Bearer read-tok');
  assert.equal(f.calls[0].opts.method, 'GET');
  assert.deepEqual(leads, [LEAD]);
  const item = inbox.leadItem(leads[0]);
  assert.deepEqual(item, { type: 'lead', source: 'crm', key: 'crm:L1', id: 'L1', reference: 'AH-001', name: 'Test Lead', phone: '+911234567890', email: 't@example.test', requirement: 'Office space', at: '2026-10-20T10:00:00Z' });
});

test('crm.newLeads throws on 401 and when not configured', async () => {
  const f = fakeFetch({ '/api/v1/leads': [401, { ok: false, error: 'invalid token' }] });
  await assert.rejects(crm.newLeads(CRM_ENV, f), /CRM 401: invalid token/);
  await assert.rejects(crm.newLeads({}, f), /CRM_READ_TOKEN/);
  assert.equal(f.calls.length, 1);
});

test('crm.leadPayload maps source, temperature and requirement', () => {
  const nri = crm.leadPayload({ id: 'q1', channel: 'instagram', lead: { name: 'A', nri: true, temperature: 'hot', project: 'FOUR·94', requirement: 'lease', email: 'A@X.TEST', phone: 9876 } });
  assert.equal(nri.source, 'NRI_DESK');
  assert.equal(nri.temperature, 'HOT');
  assert.equal(nri.requirement, 'FOUR·94 · lease');
  assert.equal(nri.email, 'a@x.test');
  assert.equal(nri.phone, '9876');
  assert.deepEqual(nri.customFields, { socialChannel: 'instagram', socialQueueId: 'q1' });

  const wa = crm.leadPayload({ id: 'q2', channel: 'whatsapp', lead: { temperature: 'lukewarm' } });
  assert.equal(wa.source, 'OTHER');
  assert.equal('temperature' in wa, false);
  assert.equal(wa.requirement, undefined);
  assert.equal(wa.name, 'Social lead');
  assert.equal(crm.leadPayload({ id: 'q3', channel: 'facebook', lead: {} }).source, 'CAMPAIGN');
  assert.equal(crm.leadPayload({ id: 'q4', channel: 'unknown' }).source, 'OTHER');
});

test('meta-read comments drop own-account comments and map fields', async () => {
  const f = fakeFetch({
    'ig1/media': [200, { data: [{ id: 'm1', permalink: 'https://ig.test/p/1', comments: { data: [
      { id: 'c1', text: 'Price?', username: 'buyer1', timestamp: '2026-10-20T01:00:00Z' },
      { id: 'c2', text: 'DM sent', username: 'ameyaheights', timestamp: '2026-10-20T02:00:00Z' },
    ] } }] }],
    'pg1/posts': [200, { data: [{ id: 'p1', permalink_url: 'https://fb.test/p1', comments: { data: [
      { id: 'f1', message: 'Location?', from: { id: 'u9', name: 'Fan' }, created_time: '2026-10-19T00:00:00Z' },
      { id: 'f2', message: 'Thanks', from: { id: 'pg1', name: 'Ameya' }, created_time: '2026-10-19T01:00:00Z' },
    ] } }] }],
  });
  const ig = await meta.instagramComments(META_ENV, f);
  assert.deepEqual(ig, [{ type: 'comment', channel: 'instagram', id: 'c1', post: 'https://ig.test/p/1', author: 'buyer1', text: 'Price?', at: '2026-10-20T01:00:00Z' }]);
  const fb = await meta.facebookComments(META_ENV, f);
  assert.deepEqual(fb, [{ type: 'comment', channel: 'facebook', id: 'f1', post: 'https://fb.test/p1', author: 'Fan', text: 'Location?', at: '2026-10-19T00:00:00Z' }]);
  assert.match(f.calls[0].url, /^https:\/\/graph\.facebook\.com\/v23\.0\/ig1\/media\?/);
  assert.match(f.calls[0].url, /access_token=ptok/);
  assert.equal(inbox.commentItem(ig[0]).key, 'instagram:c1');
});

test('insights map metrics and capture a per-media insights error', async () => {
  const f = fakeFetch({
    'ig1/media': [200, { data: [
      { id: 'm1', permalink: 'https://ig.test/1', timestamp: '2026-10-18T00:00:00Z', caption: 'Site update', like_count: 12, comments_count: 3 },
      { id: 'm2', permalink: 'https://ig.test/2', timestamp: '2026-10-17T00:00:00Z', caption: 'Old post', like_count: 4, comments_count: 0 },
    ] }],
    'm1/insights': [200, { data: [{ name: 'reach', values: [{ value: 500 }] }, { name: 'saved', values: [{ value: 7 }] }, { name: 'shares', values: [{ value: 2 }] }] }],
    'm2/insights': [400, { error: { message: 'unsupported metric' } }],
    'pg1/posts': [200, { data: [{ id: 'p1', permalink_url: 'https://fb.test/p1', created_time: '2026-10-19T00:00:00Z', message: 'Hello', shares: { count: 5 }, reactions: { summary: { total_count: 9 } }, comments: { summary: { total_count: 1 } } }] }],
  });
  const result = await insights.gather({ env: META_ENV, fetchImpl: f, now: new Date('2026-10-21T00:00:00Z') });
  assert.equal(result.generated_at, '2026-10-21T00:00:00.000Z');
  assert.deepEqual(result.instagram[0], { channel: 'instagram', id: 'm1', url: 'https://ig.test/1', at: '2026-10-18T00:00:00Z', caption: 'Site update', likes: 12, comments: 3, reach: 500, saved: 7, shares: 2 });
  assert.equal(result.instagram[1].insights_error, 'Meta API 400: unsupported metric');
  assert.deepEqual(result.facebook[0], { channel: 'facebook', id: 'p1', url: 'https://fb.test/p1', at: '2026-10-19T00:00:00Z', caption: 'Hello', reactions: 9, comments: 1, shares: 5 });
  assert.deepEqual(result.errors, [{ channel: 'instagram', id: 'm2', error: 'Meta API 400: unsupported metric' }]);
  const t = insights.table(result).split('\n');
  assert.match(t[0], /^date\s+channel\s+caption\s+reach/);
  assert.match(t[1], /^2026-10-19\s+facebook\s+Hello/);
  assert.equal(t.length, 4);
});

test('insights report unconfigured channels without calling the network', async () => {
  const f = fakeFetch({});
  const result = await insights.gather({ env: {}, fetchImpl: f });
  assert.equal(f.calls.length, 0);
  assert.deepEqual(result.errors.map((e) => e.channel), ['instagram', 'facebook']);
});

test('inbox newItems drops seen keys and in-batch repeats', () => {
  const items = [{ key: 'crm:1' }, { key: 'instagram:c1' }, { key: 'crm:1' }, { key: 'facebook:f1' }, {}];
  assert.deepEqual(inbox.newItems(items, ['instagram:c1']).map((i) => i.key), ['crm:1', 'facebook:f1']);
  assert.deepEqual(inbox.newItems([], ['x']), []);
});

test('inbox collect merges sources, dedupes and reports a failing source', async () => {
  const f = fakeFetch({
    '/api/v1/leads': [200, { ok: true, count: 1, data: [LEAD, { ...LEAD, id: 'L2' }] }],
    'ig1/media': [200, { data: [{ id: 'm1', permalink: 'https://ig.test/p/1', comments: { data: [{ id: 'c1', text: 'Hi', username: 'buyer1' }] } }] }],
    'pg1/posts': [500, { error: { message: 'boom' } }],
  });
  const { items, report } = await inbox.collect({ env: { ...CRM_ENV, ...META_ENV }, fetchImpl: f, seen: ['crm:L2'] });
  assert.deepEqual(items.map((i) => i.key), ['crm:L1', 'instagram:c1']);
  assert.deepEqual(report.crm, { status: 'ok', fetched: 2, new: 1 });
  assert.deepEqual(report.instagram, { status: 'ok', fetched: 1, new: 1 });
  assert.deepEqual(report.facebook, { status: 'error', error: 'Meta API 500: boom' });

  const none = await inbox.collect({ env: {}, fetchImpl: fakeFetch({}) });
  assert.deepEqual(none.items, []);
  assert.equal(none.report.crm.status, 'not configured');
});

test('npm run inbox with nothing configured says so and creates seen.json', () => {
  const r = spawnSync(process.execPath, [join(repo, 'scripts', 'inbox.mjs')], {
    env: { PATH: process.env.PATH, SMA_ROOT: root }, encoding: 'utf8', cwd: root,
  });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /nothing new/);
  assert.match(r.stdout, /not configured: crm, instagram, facebook/);
  assert.ok(existsSync(join(root, 'reports', 'inbox', 'seen.json')));
  assert.deepEqual(JSON.parse(readFileSync(join(root, 'reports', 'inbox', 'seen.json'), 'utf8')), []);
});

test('env.parseEnv handles comments, quotes and export', () => {
  const parsed = env.parseEnv([
    '# a comment',
    '  # indented comment',
    'export CRM_API_URL=https://crm.test',
    'TOKEN="quoted value"',
    "SINGLE='single'",
    'BARE = spaced  ',
    'MIXED="unbalanced\'',
    'not a line',
    '',
  ].join('\n'));
  assert.deepEqual(parsed, { CRM_API_URL: 'https://crm.test', TOKEN: 'quoted value', SINGLE: 'single', BARE: 'spaced', MIXED: '"unbalanced\'' });
});

test('env.parseEnv drops inline comments on unquoted values only', () => {
  const parsed = env.parseEnv(['A=x # note', 'B="has # inside" # note', 'C=no#space', "D='q' # c"].join('\n'));
  assert.deepEqual(parsed, { A: 'x', B: 'has # inside', C: 'no#space', D: 'q' });
});

test('env.loadEnv lets the environment win over .env', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sma-env-'));
  writeFileSync(join(dir, '.env'), 'A=from-file\nB=from-file\nC=\n');
  assert.deepEqual(env.loadEnv(dir, { A: 'from-shell' }), { A: 'from-shell', B: 'from-file' });
  assert.deepEqual(env.loadEnv(join(dir, 'missing'), { A: '1' }), { A: '1' });
});
