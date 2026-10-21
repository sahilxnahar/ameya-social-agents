#!/usr/bin/env node
// Queue CLI.
//   add <file.json | ->   agents: lint + validate a draft and put it in queue/pending
//   list [status]         show items (default: pending)
//   show <id>             print one item
//   approve <id>          human only: needs an interactive terminal and a typed confirmation
//   reject <id> [reason]  human only
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { STATUSES, find, list, newId, validate, write } from './lib/queue.mjs';
import { loadOwner } from './lib/owner.mjs';
import { loadRules, lint } from './lib/claims.mjs';
import { approve, reject, checkBudget } from './lib/approval.mjs';

const [cmd, ...args] = process.argv.slice(2);

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function readInput(src) {
  if (!src) fail('usage: queue add <file.json | ->');
  const raw = src === '-' ? readFileSync(0, 'utf8') : readFileSync(src, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    fail(`not valid JSON: ${e.message}`);
  }
}

function summary(i) {
  const spend = i.spend_inr ? `  ₹${i.spend_inr}` : '';
  const when = i.scheduled_for ? `  @ ${i.scheduled_for}` : '';
  const flags = i.lint_warnings?.length ? `  ⚠ ${i.lint_warnings.length}` : '';
  const text = i.content.text.replace(/\s+/g, ' ');
  return `${i.id}  ${i.channel}/${i.kind}${when}${spend}${flags}\n    ${text.length > 110 ? `${text.slice(0, 110)}…` : text}`;
}

function requireHuman(action) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    fail(`${action} must be run by a person in an interactive terminal. Agents can only add drafts.`);
  }
}

async function confirm(item, verb) {
  console.log(JSON.stringify(item, null, 2));
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const typed = await rl.question(`\nType the id to ${verb} it: `);
  rl.close();
  if (typed.trim() !== item.id) fail('id did not match, nothing changed.');
}

switch (cmd) {
  case 'add': {
    const draft = readInput(args[0]);
    const owner = loadOwner();
    const item = {
      ...draft,
      id: newId(draft.channel || 'x'),
      created_at: new Date().toISOString(),
      status: 'pending',
      spend_inr: draft.spend_inr ?? 0,
    };
    delete item.approval;
    delete item.rejection;
    const errors = validate(item);
    const { errors: claimErrors, warnings } = errors.length ? { errors: [], warnings: [] } : lint(item, loadRules(owner.brand));
    const over = errors.length ? null : checkBudget(item, owner);
    const all = [...errors, ...claimErrors, ...(over ? [over] : [])];
    if (all.length) fail(`rejected by checks, fix and resubmit:\n- ${all.join('\n- ')}`);
    item.lint_warnings = warnings;
    write('pending', item);
    console.log(`queued ${item.id}${warnings.length ? ` with ${warnings.length} warning(s) for the approver` : ''}`);
    break;
  }
  case 'list': {
    const status = args[0] || 'pending';
    if (!STATUSES.includes(status)) fail(`status must be one of ${STATUSES.join(', ')}`);
    const items = list(status);
    console.log(items.length ? items.map(summary).join('\n') : `no ${status} items`);
    break;
  }
  case 'show': {
    const found = args[0] && find(args[0]);
    if (!found) fail(`no queue item ${args[0]}`);
    console.log(JSON.stringify(found.item, null, 2));
    break;
  }
  case 'approve':
  case 'reject': {
    requireHuman(cmd);
    const found = args[0] && find(args[0]);
    if (!found) fail(`no queue item ${args[0]}`);
    await confirm(found.item, cmd);
    try {
      const result = cmd === 'approve' ? approve(found.item.id) : reject(found.item.id, { reason: args.slice(1).join(' ') });
      console.log(`${cmd === 'approve' ? 'approved' : 'rejected'} ${result.id}`);
    } catch (e) {
      fail(e.message);
    }
    break;
  }
  default:
    fail('usage: queue <add|list|show|approve|reject> ...');
}
