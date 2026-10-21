// YouTube Data API v3 resumable upload, authorised by an OAuth refresh token
// (get one with `npm run youtube-auth`). content.media[0] is a local video file.
// Videos from an unverified Google Cloud project are forced to private until Google audits it.
import { readFileSync, statSync, existsSync } from 'node:fs';
import { expand } from '../lib/media.mjs';

async function accessToken(env, fetchImpl) {
  const res = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: env.YT_CLIENT_ID,
      client_secret: env.YT_CLIENT_SECRET,
      refresh_token: env.YT_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(`Google OAuth ${res.status}: ${body.error_description || body.error || 'no access token'}`);
  return body.access_token;
}

export const adapter = {
  mode: 'live',
  missing: (env) => ['YT_CLIENT_ID', 'YT_CLIENT_SECRET', 'YT_REFRESH_TOKEN'].filter((k) => !env[k]),
  async send(item, env = process.env, fetchImpl = fetch) {
    const file = item.content.media?.[0];
    if (!file || /^https?:/i.test(file)) throw new Error('youtube needs a local video file in content.media[0]');
    const path = expand(file);
    if (!existsSync(path)) throw new Error(`video not found: ${file}`);
    const token = await accessToken(env, fetchImpl);
    const meta = {
      snippet: { title: item.content.title, description: item.content.text, categoryId: '22' },
      status: { privacyStatus: item.content.privacy || 'public', selfDeclaredMadeForKids: false },
    };
    const start = await fetchImpl('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'video/*',
        'X-Upload-Content-Length': String(statSync(path).size),
      },
      body: JSON.stringify(meta),
    });
    if (!start.ok) {
      const b = await start.json().catch(() => ({}));
      throw new Error(`YouTube ${start.status}: ${b.error?.message || 'could not start upload'}`);
    }
    const location = start.headers.get('location');
    if (!location) throw new Error('YouTube did not return an upload URL');
    const done = await fetchImpl(location, { method: 'PUT', headers: { 'Content-Type': 'video/*' }, body: readFileSync(path) });
    const body = await done.json().catch(() => ({}));
    if (!done.ok || !body.id) throw new Error(`YouTube upload ${done.status}: ${body.error?.message || 'failed'}`);
    return { ref: body.id, url: `https://youtu.be/${body.id}` };
  },
};
