// Tests for the owner's batch review screen, its terminal guard and the YouTube sign-in helpers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = mkdtempSync(join(tmpdir(), 'sma-review-'));
process.env.SMA_ROOT = root;

const { card } = await import('../scripts/lib/review.mjs');
const yt = await import('../scripts/auth/youtube-token.mjs');

const item = {
  id: '2026-10-21-whatsapp-abc123',
  channel: 'whatsapp',
  kind: 'dm',
  target: '+919800000000',
  content: { text: 'Hello, thanks for asking about FOUR·94.', template: { name: 'site_visit_followup' } },
  scheduled_for: '2026-10-23T13:30:00+05:30',
  spend_inr: 1500,
  lead: { name: 'Test Lead' },
  lint_warnings: ['mentions a date, check it'],
  rationale: 'Follow-up after enquiry',
};

test('card shows id, position, channel/kind and how it goes out', () => {
  const out = card(item, 1, 3, 'live');
  assert.match(out, /2 of 3/);
  assert.match(out, /2026-10-21-whatsapp-abc123/);
  assert.match(out, /whatsapp \/ dm/);
  assert.match(out, /via live/);
  assert.match(out, /to: \+919800000000/);
  assert.match(out, /Hello, thanks for asking/);
});

test('card shows warnings, spend, lead line and template name', () => {
  const out = card(item, 0, 1, 'handoff (no API credentials)');
  assert.match(out, /⚠ mentions a date, check it/);
  assert.match(out, /SPEND: ₹1500/);
  assert.match(out, /CRM: records Test Lead/);
  assert.match(out, /WhatsApp template: site_visit_followup/);
  assert.match(out, /via handoff \(no API credentials\)/);
});

test('card leaves out empty optional lines', () => {
  const out = card({ id: 'x-1', channel: 'instagram', kind: 'post', content: { text: 'Hi' } }, 0, 1, 'live');
  assert.doesNotMatch(out, /SPEND|CRM:|⚠|template|to:/);
  assert.match(out, /goes out when published/);
});

test('review refuses to run without an interactive terminal', () => {
  const r = spawnSync(process.execPath, [join(repo, 'scripts', 'review.mjs')], {
    input: 'a\n',
    encoding: 'utf8',
    env: { ...process.env, SMA_ROOT: root },
  });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /interactive terminal/);
});

test('authUrl asks Google for offline upload access with the loopback callback and state', () => {
  const u = new URL(yt.authUrl({ clientId: 'cid.apps.googleusercontent.com', port: 8723, state: 's123' }));
  assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  const p = u.searchParams;
  assert.equal(p.get('client_id'), 'cid.apps.googleusercontent.com');
  assert.equal(p.get('redirect_uri'), 'http://127.0.0.1:8723/callback');
  assert.equal(p.get('response_type'), 'code');
  assert.equal(p.get('scope'), 'https://www.googleapis.com/auth/youtube.upload');
  assert.equal(p.get('access_type'), 'offline');
  assert.equal(p.get('prompt'), 'consent');
  assert.equal(p.get('state'), 's123');
});

test('tokenRequestBody uses the authorization_code grant and the same redirect', () => {
  const p = new URLSearchParams(yt.tokenRequestBody({ code: 'c1', clientId: 'id', clientSecret: 'sec', port: 9000 }));
  assert.equal(p.get('grant_type'), 'authorization_code');
  assert.equal(p.get('code'), 'c1');
  assert.equal(p.get('redirect_uri'), 'http://127.0.0.1:9000/callback');
});

test('parseCallback checks path, state and errors', () => {
  assert.deepEqual(yt.parseCallback('/callback?code=abc&state=s1', 's1'), { code: 'abc' });
  assert.ok(yt.parseCallback('/callback?code=abc&state=bad', 's1').error);
  assert.ok(yt.parseCallback('/callback?code=abc', 's1').error);
  assert.ok(yt.parseCallback('/favicon.ico', 's1').error);
  assert.match(yt.parseCallback('/callback?error=access_denied&state=s1', 's1').error, /access_denied/);
});
