// Queue storage: one JSON file per item, moved between status folders.
// pending -> approved -> published, or pending -> rejected.
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(process.env.SMA_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..'));
export const STATUSES = ['pending', 'approved', 'rejected', 'published'];
export const CHANNELS = ['instagram', 'facebook', 'gbp', 'whatsapp', 'linkedin', 'youtube'];
export const KINDS = ['post', 'story', 'reel', 'video', 'reply', 'review_reply', 'dm', 'ad'];

export const dirFor = (status) => join(ROOT, 'queue', status);

// The fields a human approves. Changing any of them after approval voids the approval.
// `lead` is included because the publisher writes it to the CRM. It is only added when present, so
// items approved before leads existed keep the same hash and stay publishable after an upgrade.
export function approvedPayload(item) {
  const { channel, kind, target = null, content, scheduled_for = null, spend_inr = 0, lead = null } = item;
  return { channel, kind, target, content, scheduled_for, spend_inr, ...(lead != null ? { lead } : {}) };
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export const contentHash = (item) => createHash('sha256').update(canonical(approvedPayload(item))).digest('hex');

export function validate(item) {
  const errors = [];
  if (!item || typeof item !== 'object') return ['item must be an object'];
  if (!CHANNELS.includes(item.channel)) errors.push(`channel must be one of ${CHANNELS.join(', ')}`);
  if (!KINDS.includes(item.kind)) errors.push(`kind must be one of ${KINDS.join(', ')}`);
  const c = item.content;
  if (!c || typeof c.text !== 'string' || !c.text.trim()) errors.push('content.text is required');
  if (c?.media && !Array.isArray(c.media)) errors.push('content.media must be an array');
  if (item.spend_inr !== undefined && !(Number.isFinite(item.spend_inr) && item.spend_inr >= 0)) {
    errors.push('spend_inr must be a non-negative number');
  }
  if (item.scheduled_for && Number.isNaN(Date.parse(item.scheduled_for))) errors.push('scheduled_for must be an ISO date');
  if (['reply', 'review_reply', 'dm'].includes(item.kind) && !item.target) errors.push(`${item.kind} needs a target`);
  if (item.channel === 'whatsapp' && item.kind !== 'dm') errors.push('whatsapp items must be kind "dm"');
  // The Facebook adapter cannot publish reels, and the Instagram and Facebook adapters publish only
  // media[0]. Catch both here so a draft fails at queue time, not silently at publish time.
  if (item.channel === 'facebook' && item.kind === 'reel') {
    errors.push('facebook cannot publish a reel: queue it as a facebook post with one video or image, or post it by hand');
  }
  if (['instagram', 'facebook'].includes(item.channel) && Array.isArray(c?.media) && c.media.length > 1) {
    errors.push('instagram/facebook publish one image or video per item; split carousels into separate items or post them by hand');
  }
  if (item.channel === 'youtube') {
    if (item.kind !== 'video') errors.push('youtube items must be kind "video"');
    if (!c?.title || c.title.length > 100) errors.push('youtube needs content.title (up to 100 characters)');
    if (!c?.media?.[0]) errors.push('youtube needs the video file in content.media[0]');
  }
  if (c?.template !== undefined) {
    if (item.channel !== 'whatsapp') errors.push('content.template is only for WhatsApp');
    if (!c.template?.name || typeof c.template.name !== 'string') errors.push('content.template.name is required');
    if (c.template?.params && !Array.isArray(c.template.params)) errors.push('content.template.params must be an array');
  }
  if (item.lead !== undefined && item.lead !== null) {
    if (typeof item.lead !== 'object' || (!item.lead.phone && !item.lead.email)) errors.push('lead needs a phone or email');
  }
  return errors;
}

export function newId(channel) {
  const day = new Date().toISOString().slice(0, 10);
  return `${day}-${channel}-${randomBytes(3).toString('hex')}`;
}

const SAFE_ID = /^[a-z0-9-]+$/;

export function find(id) {
  if (!SAFE_ID.test(id)) throw new Error(`invalid id: ${id}`);
  for (const status of STATUSES) {
    const path = join(dirFor(status), `${id}.json`);
    if (existsSync(path)) return { status, path, item: JSON.parse(readFileSync(path, 'utf8')) };
  }
  return null;
}

export function list(status) {
  const dir = dirFor(status);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
}

export function write(status, item) {
  mkdirSync(dirFor(status), { recursive: true });
  const path = join(dirFor(status), `${item.id}.json`);
  writeFileSync(path, `${JSON.stringify(item, null, 2)}\n`);
  return path;
}

// Writes the item into its new status folder, then removes the old copy.
export function move(id, toStatus, update = {}) {
  const found = find(id);
  if (!found) throw new Error(`no queue item ${id}`);
  const item = { ...found.item, ...update, status: toStatus };
  const dest = write(toStatus, item);
  if (found.path !== dest) unlinkSync(found.path);
  return item;
}
