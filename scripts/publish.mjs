#!/usr/bin/env node
// Publisher. Only approved items whose content still matches the approved hash can leave.
//   <id> [--live]         dry run by default; --live sends (human or scheduler only)
//   due [--live]          every approved item whose scheduled time has passed
//   posted <id> <url>     record that a handed-off item was posted by hand
// Credentials come from .env. Local media for Instagram and Facebook is uploaded to Vercel Blob
// first. Items with a `lead` are recorded in the CRM after they are sent.
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, find, list, move } from './lib/queue.mjs';
import { publishable } from './lib/approval.mjs';
import { loadEnv } from './lib/env.mjs';
import { resolveMedia } from './lib/media.mjs';
import { canWrite, recordLead } from './lib/crm.mjs';
import { pick } from './adapters/index.mjs';

const args = process.argv.slice(2);
const live = args.includes('--live');
const [cmd, ...rest] = args.filter((a) => a !== '--live');
const env = loadEnv();
const NEEDS_URL = ['instagram', 'facebook'];

function log(line) {
  mkdirSync(join(ROOT, 'logs'), { recursive: true });
  appendFileSync(join(ROOT, 'logs', 'published.log'), `${line}\n`);
}

async function toCrm(item) {
  if (!item.lead || !canWrite(env)) return;
  try {
    const r = await recordLead(item, env);
    log(`${new Date().toISOString()}\tCRM\t${item.id}\t${r.action || 'ok'}\t${r.reference || r.id || ''}`);
    console.log(`  CRM: ${r.action || 'recorded'} ${r.reference || ''}`);
  } catch (e) {
    log(`${new Date().toISOString()}\tCRM_FAILED\t${item.id}\t${e.message}`);
    console.error(`  CRM failed for ${item.id}: ${e.message}`);
  }
}

async function publishOne(item) {
  const problems = publishable(item);
  if (problems.length) return console.log(`skip ${item.id}: ${problems.join('; ')}`);
  const adapter = pick(item.channel, env);
  const how = adapter.fallbackFrom ? 'handoff (no API credentials)' : adapter.mode;
  if (!live) return console.log(`dry run ${item.id}: would send via ${how}\n    ${item.content.text.slice(0, 140)}`);
  try {
    const sendable = adapter.mode === 'live' && NEEDS_URL.includes(item.channel) ? await resolveMedia(item, { env }) : item;
    const result = await adapter.send(sendable, env);
    const at = new Date().toISOString();
    if (adapter.mode === 'handoff') {
      move(item.id, 'approved', { handoff: { at, file: result.handoff } });
      log(`${at}\tHANDOFF\t${item.id}\t${result.handoff}`);
      console.log(`handed off ${item.id} -> ${result.handoff}`);
    } else {
      move(item.id, 'published', { published: { at, via: item.channel, ref: result.ref, url: result.url || null } });
      log(`${at}\tPUBLISHED\t${item.id}\t${result.ref || ''}`);
      console.log(`published ${item.id} (${result.ref || 'no ref'})`);
      await toCrm(item);
    }
  } catch (e) {
    log(`${new Date().toISOString()}\tFAILED\t${item.id}\t${e.message}`);
    console.error(`failed ${item.id}: ${e.message}`);
    process.exitCode = 1;
  }
}

if (cmd === 'due') {
  const due = list('approved').filter((i) => !i.handoff && publishable(i).length === 0);
  if (!due.length) console.log('nothing due');
  for (const item of due) await publishOne(item);
} else if (cmd === 'posted') {
  const [id, url] = rest;
  const found = id && find(id);
  if (!found || found.status !== 'approved' || !found.item.handoff) {
    console.error(`${id} is not an approved, handed-off item`);
    process.exit(1);
  }
  const at = new Date().toISOString();
  move(id, 'published', { published: { at, via: 'manual', ref: url || null } });
  log(`${at}\tPOSTED\t${id}\t${url || ''}`);
  console.log(`recorded ${id} as posted`);
  await toCrm(found.item);
} else if (cmd) {
  const found = find(cmd);
  if (!found) {
    console.error(`no queue item ${cmd}`);
    process.exit(1);
  }
  await publishOne(found.item);
} else {
  console.error('usage: publish <id|due> [--live] | publish posted <id> <url>');
  process.exit(1);
}
