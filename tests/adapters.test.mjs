import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { facebook, instagram } from '../scripts/adapters/meta.mjs';
import { adapter as whatsapp, messageFor } from '../scripts/adapters/whatsapp.mjs';
import { adapter as youtube } from '../scripts/adapters/youtube.mjs';
import { pick } from '../scripts/adapters/index.mjs';
import { resolveMedia } from '../scripts/lib/media.mjs';

function fakeFetch(responses) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    const body = responses.shift();
    const headers = new Map(Object.entries(body.headers || {}));
    return { ok: !body.error, status: body.error ? 400 : 200, headers: { get: (k) => headers.get(k.toLowerCase()) ?? null }, json: async () => body };
  };
  return { calls, impl };
}

const env = { META_PAGE_ID: '123', META_PAGE_TOKEN: 'tok', IG_USER_ID: '456', WA_PHONE_NUMBER_ID: '789', WA_TOKEN: 'wat' };
const ytEnv = { YT_CLIENT_ID: 'cid', YT_CLIENT_SECRET: 'csec', YT_REFRESH_TOKEN: 'rtok' };
const tmp = mkdtempSync(join(tmpdir(), 'sma-adapters-'));

test('facebook posts text to the page feed', async () => {
  const f = fakeFetch([{ id: '123_1' }]);
  const out = await facebook.send({ kind: 'post', content: { text: 'hi', link: 'https://www.ameyaheights.com' } }, env, f.impl);
  assert.equal(out.ref, '123_1');
  assert.match(f.calls[0].url, /\/123\/feed$/);
  assert.equal(f.calls[0].init.body.get('link'), 'https://www.ameyaheights.com');
});

test('instagram creates a container then publishes it', async () => {
  const f = fakeFetch([{ id: 'c1' }, { id: 'm1' }]);
  const out = await instagram.send({ kind: 'post', content: { text: 'hi', media: ['https://x/img.jpg'] } }, env, f.impl);
  assert.equal(out.ref, 'm1');
  assert.match(f.calls[0].url, /\/456\/media$/);
  assert.match(f.calls[1].url, /\/456\/media_publish$/);
  assert.equal(f.calls[1].init.body.get('creation_id'), 'c1');
});

test('instagram refuses without a media URL', async () => {
  await assert.rejects(instagram.send({ kind: 'post', content: { text: 'hi' } }, env, async () => {}), /media URL/);
});

test('whatsapp sends a text message to the target number', async () => {
  const f = fakeFetch([{ messages: [{ id: 'wamid.1' }] }]);
  const out = await whatsapp.send({ target: '+91 98765 43210', content: { text: 'hello' } }, env, f.impl);
  assert.equal(out.ref, 'wamid.1');
  const body = JSON.parse(f.calls[0].init.body);
  assert.equal(body.to, '919876543210');
  assert.equal(body.type, 'text');
  assert.equal(body.text.body, 'hello');
  assert.equal(f.calls[0].init.headers.Authorization, 'Bearer wat');
});

test('whatsapp sends an approved template with its body parameters', async () => {
  const f = fakeFetch([{ messages: [{ id: 'wamid.2' }] }]);
  const item = { target: '+919876543210', content: { text: 'Hi Asha, following up on FOUR·94', template: { name: 'follow_up', language: 'en_US', params: ['Asha', 2] } } };
  const out = await whatsapp.send(item, env, f.impl);
  assert.equal(out.ref, 'wamid.2');
  const body = JSON.parse(f.calls[0].init.body);
  assert.equal(body.type, 'template');
  assert.equal(body.text, undefined);
  assert.equal(body.template.name, 'follow_up');
  assert.deepEqual(body.template.language, { code: 'en_US' });
  assert.deepEqual(body.template.components, [
    { type: 'body', parameters: [{ type: 'text', text: 'Asha' }, { type: 'text', text: '2' }] },
  ]);
});

test('whatsapp template without params has no components and defaults to English', () => {
  const msg = messageFor({ content: { text: 'hello', template: { name: 'hello_world' } } });
  assert.deepEqual(msg, { type: 'template', template: { name: 'hello_world', language: { code: 'en' } } });
  const empty = messageFor({ content: { text: 'hello', template: { name: 'hello_world', params: [] } } });
  assert.equal(empty.template.components, undefined);
});

test('API errors surface as exceptions', async () => {
  const f = fakeFetch([{ error: { message: 'Invalid token' } }]);
  await assert.rejects(facebook.send({ kind: 'post', content: { text: 'hi' } }, env, f.impl), /Invalid token/);
});

test('youtube refreshes the token, starts a resumable upload, PUTs the file and returns the video', async () => {
  const video = join(tmp, 'site-diary.mp4');
  writeFileSync(video, Buffer.from('fake video bytes'));
  const upload = 'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=abc';
  const f = fakeFetch([{ access_token: 'acc' }, { headers: { location: upload } }, { id: 'vid123' }]);
  const item = { channel: 'youtube', kind: 'video', content: { text: 'Weekly site diary', title: 'FOUR·94 site diary', media: [video] } };
  const out = await youtube.send(item, ytEnv, f.impl);
  assert.deepEqual(out, { ref: 'vid123', url: 'https://youtu.be/vid123' });

  assert.equal(f.calls.length, 3);
  assert.equal(f.calls[0].url, 'https://oauth2.googleapis.com/token');
  const form = f.calls[0].init.body;
  assert.equal(form.get('grant_type'), 'refresh_token');
  assert.equal(form.get('refresh_token'), 'rtok');
  assert.equal(form.get('client_id'), 'cid');

  assert.match(f.calls[1].url, /uploadType=resumable/);
  assert.equal(f.calls[1].init.method, 'POST');
  assert.equal(f.calls[1].init.headers.Authorization, 'Bearer acc');
  assert.equal(f.calls[1].init.headers['X-Upload-Content-Length'], String(Buffer.byteLength('fake video bytes')));
  const meta = JSON.parse(f.calls[1].init.body);
  assert.equal(meta.snippet.title, 'FOUR·94 site diary');
  assert.equal(meta.snippet.description, 'Weekly site diary');
  assert.equal(meta.status.privacyStatus, 'public');

  assert.equal(f.calls[2].url, upload);
  assert.equal(f.calls[2].init.method, 'PUT');
  assert.equal(f.calls[2].init.body.toString(), 'fake video bytes');
});

test('youtube fails clearly when the upload URL is missing or the token is refused', async () => {
  const video = join(tmp, 'clip.mp4');
  writeFileSync(video, 'x');
  const item = { content: { text: 'd', title: 't', media: [video] } };
  await assert.rejects(youtube.send(item, ytEnv, fakeFetch([{ access_token: 'acc' }, {}]).impl), /upload URL/);
  await assert.rejects(youtube.send(item, ytEnv, fakeFetch([{ error: 'invalid_grant' }]).impl), /Google OAuth 400: invalid_grant/);
});

test('youtube needs a local video file and calls nothing without one', async () => {
  const f = fakeFetch([]);
  await assert.rejects(youtube.send({ content: { text: 'd', title: 't', media: [join(tmp, 'missing.mp4')] } }, ytEnv, f.impl), /video not found/);
  await assert.rejects(youtube.send({ content: { text: 'd', title: 't', media: ['https://x/v.mp4'] } }, ytEnv, f.impl), /local video file/);
  await assert.rejects(youtube.send({ content: { text: 'd', title: 't' } }, ytEnv, f.impl), /local video file/);
  assert.equal(f.calls.length, 0);
});

test('channels without credentials fall back to handoff', () => {
  assert.equal(pick('instagram', {}).mode, 'handoff');
  assert.equal(pick('instagram', env).mode, 'live');
  assert.equal(pick('gbp', env).mode, 'handoff');
});

test('youtube is live with OAuth credentials and hands off without them', () => {
  assert.equal(pick('youtube', ytEnv).mode, 'live');
  const fallback = pick('youtube', { YT_CLIENT_ID: 'cid' });
  assert.equal(fallback.mode, 'handoff');
  assert.equal(fallback.fallbackFrom, 'youtube');
});

test('resolveMedia uploads local files, leaves URLs alone and never changes the original item', async () => {
  const img = join(tmp, 'slab.jpg');
  writeFileSync(img, 'jpg');
  const uploads = [];
  const upload = async (path, name, e) => {
    uploads.push({ path, name, token: e.BLOB_READ_WRITE_TOKEN });
    return `https://blob.example/${name}`;
  };
  const item = { id: '2026-10-21-instagram-abc123', content: { text: 'hi', media: ['https://x/a.jpg', img] } };
  const before = JSON.stringify(item);
  const out = await resolveMedia(item, { env: { BLOB_READ_WRITE_TOKEN: 'b' }, upload });
  assert.deepEqual(out.content.media, ['https://x/a.jpg', 'https://blob.example/2026-10-21-instagram-abc123-slab.jpg']);
  assert.deepEqual(uploads, [{ path: img, name: '2026-10-21-instagram-abc123-slab.jpg', token: 'b' }]);
  assert.equal(JSON.stringify(item), before);
  assert.notEqual(out, item);
});

test('resolveMedia returns remote-only items untouched and throws on a missing file', async () => {
  const upload = async () => assert.fail('should not upload');
  const remote = { id: 'x', content: { text: 'hi', media: ['https://x/a.jpg'] } };
  assert.equal(await resolveMedia(remote, { env: {}, upload }), remote);
  const none = { id: 'y', content: { text: 'hi' } };
  assert.equal(await resolveMedia(none, { env: {}, upload }), none);
  const missing = { id: 'z', content: { text: 'hi', media: [join(tmp, 'nope.jpg')] } };
  await assert.rejects(resolveMedia(missing, { env: {}, upload }), /media file not found/);
});

test('resolveMedia without a blob token says what to set', async () => {
  const img = join(tmp, 'nokey.jpg');
  writeFileSync(img, 'jpg');
  await assert.rejects(resolveMedia({ id: 'k', content: { text: 'hi', media: [img] } }, { env: {} }), /BLOB_READ_WRITE_TOKEN/);
});
