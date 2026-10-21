// Approval and publish checks shared by the CLI, the publisher and the tests.
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, find, move, contentHash, validate } from './queue.mjs';
import { loadOwner, committedSpend } from './owner.mjs';
import { loadRules, lint } from './claims.mjs';

function log(line) {
  mkdirSync(join(ROOT, 'logs'), { recursive: true });
  appendFileSync(join(ROOT, 'logs', 'approvals.log'), `${line}\n`);
}

export function checkBudget(item, owner, now = new Date()) {
  const spend = item.spend_inr || 0;
  if (spend === 0) return null;
  const month = now.toISOString().slice(0, 7);
  const committed = committedSpend(month);
  if (committed + spend > owner.monthly_spend_cap_inr) {
    return `spend ₹${spend} would take ${month} to ₹${committed + spend}, over the cap of ₹${owner.monthly_spend_cap_inr}`;
  }
  return null;
}

export function approve(id, { by, now = new Date() } = {}) {
  const found = find(id);
  if (!found) throw new Error(`no queue item ${id}`);
  if (found.status !== 'pending') throw new Error(`${id} is ${found.status}, only pending items can be approved`);
  const owner = loadOwner();
  const problems = [...validate(found.item), ...lint(found.item, loadRules(owner.brand)).errors];
  const over = checkBudget(found.item, owner, now);
  if (over) problems.push(over);
  if (problems.length) throw new Error(`cannot approve ${id}:\n- ${problems.join('\n- ')}`);
  const approval = { by: by || owner.approver || 'owner', at: now.toISOString(), content_sha256: contentHash(found.item) };
  const item = move(id, 'approved', { approval });
  log(`${approval.at}\tAPPROVE\t${id}\t${approval.by}\t${approval.content_sha256}`);
  return item;
}

export function reject(id, { by, reason = '', now = new Date() } = {}) {
  const found = find(id);
  if (!found) throw new Error(`no queue item ${id}`);
  if (found.status !== 'pending') throw new Error(`${id} is ${found.status}, only pending items can be rejected`);
  const owner = loadOwner();
  const rejection = { by: by || owner.approver || 'owner', at: now.toISOString(), reason };
  const item = move(id, 'rejected', { rejection });
  log(`${rejection.at}\tREJECT\t${id}\t${rejection.by}\t${reason.replace(/\s+/g, ' ')}`);
  return item;
}

// Everything the publisher re-checks right before anything leaves the machine.
export function publishable(item, now = new Date()) {
  const problems = [];
  if (item.status !== 'approved') problems.push(`status is ${item.status}, not approved`);
  if (!item.approval?.content_sha256) problems.push('no approval record');
  else if (item.approval.content_sha256 !== contentHash(item)) problems.push('content changed after approval');
  if (item.scheduled_for && Date.parse(item.scheduled_for) > now.getTime()) problems.push(`scheduled for ${item.scheduled_for}`);
  return problems;
}
