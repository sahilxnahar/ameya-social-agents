// Turns local media paths into public URLs at publish time (Instagram and Facebook fetch media by
// URL). Works on a copy, so the approved item and its hash never change.
import { readFileSync, existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { homedir } from 'node:os';

export const isRemote = (m) => /^https?:\/\//i.test(m);
export const expand = (p) => (p.startsWith('~/') ? resolve(homedir(), p.slice(2)) : resolve(p));

async function blobUpload(path, name, env) {
  if (!env.BLOB_READ_WRITE_TOKEN) throw new Error('local media needs BLOB_READ_WRITE_TOKEN in .env to upload to Vercel Blob');
  let put;
  try {
    ({ put } = await import('@vercel/blob'));
  } catch {
    throw new Error('run "npm install" to add @vercel/blob for media uploads');
  }
  const res = await put(`social/${name}`, readFileSync(path), { access: 'public', addRandomSuffix: true, token: env.BLOB_READ_WRITE_TOKEN });
  return res.url;
}

export async function resolveMedia(item, { env = process.env, upload = blobUpload } = {}) {
  const media = item.content.media || [];
  if (media.every(isRemote)) return item;
  const out = [];
  for (const m of media) {
    if (isRemote(m)) {
      out.push(m);
      continue;
    }
    const path = expand(m);
    if (!existsSync(path)) throw new Error(`media file not found: ${m}`);
    out.push(await upload(path, `${item.id}-${basename(path)}`, env));
  }
  return { ...item, content: { ...item.content, media: out } };
}
