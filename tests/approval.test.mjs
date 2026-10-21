// End-to-end queue tests in a temporary root, so real queue data is never touched.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = mkdtempSync(join(tmpdir(), 'sma-'));
process.env.SMA_ROOT = root;

let q;
let a;
let handoff;

before(async () => {
  cpSync(join(repo, 'brand'), join(root, 'brand'), { recursive: true });
  mkdirSync(join(root, 'config'));
  writeFileSync(join(root, 'config', 'owner.json'), JSON.stringify({ brand: 'ameya-heights', approver: 'Test Owner', monthly_spend_cap_inr: 5000 }));
  q = await import('../scripts/lib/queue.mjs');
  a = await import('../scripts/lib/approval.mjs');
  handoff = (await import('../scripts/adapters/handoff.mjs')).adapter;
});

function pending(overrides = {}) {
  const item = {
    id: q.newId(overrides.channel || 'instagram'),
    created_at: new Date().toISOString(),
    status: 'pending',
    channel: 'instagram',
    kind: 'post',
    content: { text: 'Ground floor done at FOUR·94. Target completion Q1 2028.' },
    spend_inr: 0,
    ...overrides,
  };
  q.write('pending', item);
  return item;
}

test('validate catches bad items', () => {
  assert.ok(q.validate({ channel: 'tiktok', kind: 'post', content: { text: 'x' } }).length);
  assert.ok(q.validate({ channel: 'whatsapp', kind: 'post', content: { text: 'x' } }).length);
  assert.ok(q.validate({ channel: 'gbp', kind: 'review_reply', content: { text: 'x' } }).some((e) => e.includes('target')));
  assert.deepEqual(q.validate({ channel: 'gbp', kind: 'post', content: { text: 'x' } }), []);
});

test('validate: youtube needs kind video, a title up to 100 characters and a video file', () => {
  const ok = { channel: 'youtube', kind: 'video', content: { text: 'desc', title: 'FOUR·94 site diary', media: ['~/v.mp4'] } };
  assert.deepEqual(q.validate(ok), []);
  assert.ok(q.validate({ ...ok, kind: 'post' }).some((e) => e.includes('kind "video"')));
  assert.ok(q.validate({ ...ok, content: { ...ok.content, title: undefined } }).some((e) => e.includes('title')));
  assert.ok(q.validate({ ...ok, content: { ...ok.content, title: 'x'.repeat(101) } }).some((e) => e.includes('title')));
  assert.deepEqual(q.validate({ ...ok, content: { ...ok.content, title: 'x'.repeat(100) } }), []);
  assert.ok(q.validate({ ...ok, content: { ...ok.content, media: [] } }).some((e) => e.includes('media[0]')));
  assert.ok(q.validate({ ...ok, content: { text: 'desc', title: 't' } }).some((e) => e.includes('media[0]')));
});

test('validate: WhatsApp templates need a name, params must be an array, and only on WhatsApp', () => {
  const ok = {
    channel: 'whatsapp',
    kind: 'dm',
    target: '+919876543210',
    content: { text: 'Hi Asha, following up', template: { name: 'follow_up', language: 'en', params: ['Asha'] } },
  };
  assert.deepEqual(q.validate(ok), []);
  assert.deepEqual(q.validate({ ...ok, content: { ...ok.content, template: { name: 'follow_up' } } }), []);
  assert.ok(q.validate({ ...ok, content: { ...ok.content, template: { language: 'en' } } }).some((e) => e.includes('template.name')));
  assert.ok(q.validate({ ...ok, content: { ...ok.content, template: { name: 'x', params: 'Asha' } } }).some((e) => e.includes('params')));
  const fb = { channel: 'facebook', kind: 'post', content: { text: 'x', template: { name: 'follow_up' } } };
  assert.ok(q.validate(fb).some((e) => e.includes('only for WhatsApp')));
});

test('validate: facebook cannot take a reel', () => {
  const reel = { channel: 'facebook', kind: 'reel', content: { text: 'x', media: ['~/v.mp4'] } };
  assert.ok(q.validate(reel).some((e) => e.includes('facebook cannot publish a reel')));
  assert.deepEqual(q.validate({ ...reel, kind: 'post' }), []);
  assert.deepEqual(q.validate({ ...reel, channel: 'instagram' }), []);
});

test('validate: instagram and facebook take one media item, so carousels must be split', () => {
  for (const channel of ['instagram', 'facebook']) {
    const one = { channel, kind: 'post', content: { text: 'x', media: ['https://example.com/1.jpg'] } };
    assert.deepEqual(q.validate(one), []);
    assert.deepEqual(q.validate({ ...one, content: { text: 'x' } }), []);
    const two = { ...one, content: { text: 'x', media: ['https://example.com/1.jpg', '~/2.jpg'] } };
    assert.ok(q.validate(two).some((e) => e.includes('one image or video per item') && e.includes('split carousels')));
  }
  assert.ok(q.validate({ channel: 'instagram', kind: 'reel', content: { text: 'x', media: ['~/a.mp4', '~/b.mp4'] } })
    .some((e) => e.includes('one image or video per item')));
  // Other channels are not limited by this rule.
  assert.deepEqual(q.validate({ channel: 'linkedin', kind: 'post', content: { text: 'x', media: ['~/1.jpg', '~/2.jpg'] } }), []);
});

test('validate: a lead needs a phone or an email', () => {
  const base = { channel: 'whatsapp', kind: 'dm', target: '+919876543210', content: { text: 'hello' } };
  assert.deepEqual(q.validate({ ...base, lead: { name: 'Asha', phone: '+919876543210' } }), []);
  assert.deepEqual(q.validate({ ...base, lead: { name: 'Asha', email: 'asha@example.com' } }), []);
  assert.deepEqual(q.validate({ ...base, lead: null }), []);
  assert.ok(q.validate({ ...base, lead: { name: 'Asha' } }).some((e) => e.includes('lead')));
  assert.ok(q.validate({ ...base, lead: 'Asha' }).some((e) => e.includes('lead')));
});

test('the hash covers what the owner approves and nothing else', () => {
  const item = { channel: 'instagram', kind: 'post', content: { text: 'a' }, rationale: 'x' };
  assert.equal(q.contentHash(item), q.contentHash({ ...item, rationale: 'changed' }));
  assert.notEqual(q.contentHash(item), q.contentHash({ ...item, content: { text: 'b' } }));
  assert.notEqual(q.contentHash(item), q.contentHash({ ...item, spend_inr: 100 }));
});

test('the hash changes when the lead changes, because the lead goes to the CRM', () => {
  const item = { channel: 'whatsapp', kind: 'dm', target: '+919876543210', content: { text: 'a' } };
  const withLead = { ...item, lead: { name: 'Asha', phone: '+919876543210', temperature: 'WARM' } };
  assert.notEqual(q.contentHash(item), q.contentHash(withLead));
  assert.notEqual(q.contentHash(withLead), q.contentHash({ ...withLead, lead: { ...withLead.lead, temperature: 'HOT' } }));
  assert.notEqual(q.contentHash(withLead), q.contentHash({ ...withLead, lead: { ...withLead.lead, phone: '+919999999999' } }));
  assert.equal(q.contentHash(withLead), q.contentHash({ ...withLead, rationale: 'edited' }));
  assert.deepEqual(q.approvedPayload(withLead).lead, withLead.lead);
});

test('items without a lead keep the hash they had before leads existed', () => {
  // v0.2 hashed exactly these six fields, keys sorted; an item approved then must still match.
  const item = { channel: 'instagram', kind: 'post', content: { text: 'a' } };
  const v02 = '{"channel":"instagram","content":{"text":"a"},"kind":"post","scheduled_for":null,"spend_inr":0,"target":null}';
  assert.equal(q.contentHash(item), createHash('sha256').update(v02).digest('hex'));
  assert.equal(q.contentHash(item), q.contentHash({ ...item, lead: null }));
  assert.equal(q.approvedPayload(item).lead, undefined);
});

test('approve moves the item and records who, when and the hash', () => {
  const item = pending();
  const approved = a.approve(item.id);
  assert.equal(approved.status, 'approved');
  assert.equal(approved.approval.by, 'Test Owner');
  assert.equal(approved.approval.content_sha256, q.contentHash(item));
  assert.equal(q.find(item.id).status, 'approved');
  assert.ok(existsSync(join(root, 'logs', 'approvals.log')));
  assert.deepEqual(a.publishable(approved), []);
});

test('approve re-checks claims, so an edited pending item cannot slip through', () => {
  const item = pending({ content: { text: 'Assured returns at FOUR·94' } });
  assert.throws(() => a.approve(item.id), /banned phrase/);
  assert.equal(q.find(item.id).status, 'pending');
});

test('content edited after approval cannot be published', () => {
  const item = pending();
  a.approve(item.id);
  const path = join(root, 'queue', 'approved', `${item.id}.json`);
  const tampered = JSON.parse(readFileSync(path, 'utf8'));
  tampered.content.text = 'Something the owner never saw';
  writeFileSync(path, JSON.stringify(tampered));
  assert.ok(a.publishable(q.find(item.id).item).includes('content changed after approval'));
});

test('a lead edited after approval cannot be published', () => {
  const item = pending({
    channel: 'whatsapp',
    kind: 'dm',
    target: '+919876543210',
    content: { text: 'Thanks for writing in about FOUR·94.' },
    lead: { name: 'Asha', phone: '+919876543210', temperature: 'WARM' },
  });
  const approved = a.approve(item.id);
  assert.deepEqual(a.publishable(approved), []);
  const path = join(root, 'queue', 'approved', `${item.id}.json`);
  const tampered = JSON.parse(readFileSync(path, 'utf8'));
  tampered.lead.phone = '+919999999999';
  writeFileSync(path, JSON.stringify(tampered));
  assert.ok(a.publishable(q.find(item.id).item).includes('content changed after approval'));
});

test('publishable is unchanged for items without a lead, a template or a title', () => {
  const approved = a.approve(pending({ channel: 'facebook' }).id);
  assert.equal(approved.lead, undefined);
  assert.deepEqual(a.publishable(approved), []);
  assert.ok(a.publishable({ ...approved, status: 'pending' }).some((e) => e.includes('not approved')));
  assert.ok(a.publishable({ ...approved, approval: undefined }).includes('no approval record'));
  const yt = a.approve(pending({ channel: 'youtube', kind: 'video', content: { text: 'Site diary', title: 'FOUR·94 site diary', media: ['~/v.mp4'] } }).id);
  assert.deepEqual(a.publishable(yt), []);
});

test('pending, rejected and future items are not publishable', () => {
  const p = pending();
  assert.ok(a.publishable(p).some((e) => e.includes('not approved')));
  const r = a.reject(pending().id, { reason: 'off voice' });
  assert.equal(r.rejection.reason, 'off voice');
  assert.ok(a.publishable(r).length);
  const later = pending({ scheduled_for: '2099-01-01T00:00:00Z' });
  assert.ok(a.publishable(a.approve(later.id)).some((e) => e.includes('scheduled')));
});

test('spend is capped per month', () => {
  a.approve(pending({ kind: 'ad', spend_inr: 4000 }).id);
  const over = pending({ kind: 'ad', spend_inr: 1500 });
  assert.throws(() => a.approve(over.id), /over the cap/);
});

test('handoff writes a copy-ready pack to the outbox', async () => {
  const item = a.approve(pending({ channel: 'gbp' }).id);
  const result = await handoff.send(item);
  const text = readFileSync(join(root, result.handoff), 'utf8');
  assert.match(text, /Ground floor done/);
  assert.match(text, /npm run publish -- posted/);
});

test('the CLI refuses to approve without an interactive terminal', () => {
  const item = pending();
  const run = spawnSync(process.execPath, [join(repo, 'scripts', 'queue.mjs'), 'approve', item.id], {
    env: { ...process.env, SMA_ROOT: root },
    input: `${item.id}\n`,
    encoding: 'utf8',
  });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /interactive terminal/);
  assert.equal(q.find(item.id).status, 'pending');
});

test('the CLI add command lints drafts before queueing', () => {
  const run = (text) => spawnSync(process.execPath, [join(repo, 'scripts', 'queue.mjs'), 'add', '-'], {
    env: { ...process.env, SMA_ROOT: root },
    input: JSON.stringify({ channel: 'facebook', kind: 'post', content: { text } }),
    encoding: 'utf8',
  });
  assert.notEqual(run('Book your Salavakkam plot now').status, 0);
  const ok = run('FOUR·94 update: first-floor shuttering in progress.');
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /queued/);
});
