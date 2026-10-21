import { test } from 'node:test';
import assert from 'node:assert/strict';
import { facebook, instagram } from '../scripts/adapters/meta.mjs';
import { adapter as whatsapp } from '../scripts/adapters/whatsapp.mjs';
import { pick } from '../scripts/adapters/index.mjs';

function fakeFetch(responses) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    const body = responses.shift();
    return { ok: !body.error, status: body.error ? 400 : 200, json: async () => body };
  };
  return { calls, impl };
}

const env = { META_PAGE_ID: '123', META_PAGE_TOKEN: 'tok', IG_USER_ID: '456', WA_PHONE_NUMBER_ID: '789', WA_TOKEN: 'wat' };

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
  assert.equal(f.calls[0].init.headers.Authorization, 'Bearer wat');
});

test('API errors surface as exceptions', async () => {
  const f = fakeFetch([{ error: { message: 'Invalid token' } }]);
  await assert.rejects(facebook.send({ kind: 'post', content: { text: 'hi' } }, env, f.impl), /Invalid token/);
});

test('channels without credentials fall back to handoff', () => {
  assert.equal(pick('instagram', {}).mode, 'handoff');
  assert.equal(pick('instagram', env).mode, 'live');
  assert.equal(pick('gbp', env).mode, 'handoff');
});
