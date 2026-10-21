#!/usr/bin/env node
// One-time YouTube sign-in for the owner: `npm run youtube-auth`.
// Needs YT_CLIENT_ID and YT_CLIENT_SECRET in .env (a Google Cloud OAuth client of type "Desktop app").
// Opens a local callback on 127.0.0.1, prints the Google consent link, swaps the returned code for a
// refresh token and prints it. It never writes .env: you paste YT_REFRESH_TOKEN=... in yourself.
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const SCOPE = 'https://www.googleapis.com/auth/youtube.upload';
export const DEFAULT_PORT = 8723;

export const redirectUri = (port) => `http://127.0.0.1:${port}/callback`;

export function authUrl({ clientId, port, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(port),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${AUTH_ENDPOINT}?${params}`;
}

// Body for the code-for-token exchange.
export function tokenRequestBody({ code, clientId, clientSecret, port }) {
  return new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri(port),
    grant_type: 'authorization_code',
  }).toString();
}

// Checks a callback URL. Returns { code } or { error }.
export function parseCallback(url, expectedState) {
  const u = new URL(url, 'http://127.0.0.1');
  if (u.pathname !== '/callback') return { error: 'not the callback path' };
  if (u.searchParams.get('error')) return { error: `Google returned: ${u.searchParams.get('error')}` };
  if (!expectedState || u.searchParams.get('state') !== expectedState) return { error: 'state did not match, ignoring' };
  const code = u.searchParams.get('code');
  return code ? { code } : { error: 'no code in callback' };
}

async function main() {
  const { loadEnv } = await import('../lib/env.mjs');
  const env = loadEnv();
  const clientId = env.YT_CLIENT_ID;
  const clientSecret = env.YT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('Add YT_CLIENT_ID and YT_CLIENT_SECRET to .env first (Google Cloud > APIs & Services > Credentials > OAuth client, type Desktop app).');
    process.exit(1);
  }
  const port = Number(env.YT_AUTH_PORT) || DEFAULT_PORT;
  const state = randomBytes(16).toString('hex');

  const server = createServer(async (req, res) => {
    const result = parseCallback(req.url, state);
    if (result.error) {
      res.writeHead(400, { 'content-type': 'text/plain' }).end(result.error);
      if (result.error.startsWith('Google returned')) {
        console.error(result.error);
        server.close();
        process.exitCode = 1;
      }
      return;
    }
    try {
      const r = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: tokenRequestBody({ code: result.code, clientId, clientSecret, port }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok || !body.refresh_token) {
        throw new Error(body.error_description || body.error || `token exchange failed (HTTP ${r.status}), no refresh token returned`);
      }
      res.writeHead(200, { 'content-type': 'text/plain' }).end('YouTube connected. You can close this tab and go back to the terminal.');
      console.log('\nRefresh token received. Add this line to .env yourself, then keep .env private:\n');
      console.log(`YT_REFRESH_TOKEN=${body.refresh_token}\n`);
    } catch (e) {
      res.writeHead(500, { 'content-type': 'text/plain' }).end('Token exchange failed, see the terminal.');
      console.error(e.message);
      process.exitCode = 1;
    }
    server.close();
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`Waiting on ${redirectUri(port)}`);
    console.log('Open this link, sign in with the channel owner account and allow upload access:\n');
    console.log(authUrl({ clientId, port, state }));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
