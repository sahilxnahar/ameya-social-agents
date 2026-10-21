#!/usr/bin/env node
// Batch review for the owner: walks every pending item and asks approve, reject, skip or quit.
// Human only: refuses to run unless stdin and stdout are an interactive terminal.
import { createInterface } from 'node:readline/promises';

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error('review must be run by a person in an interactive terminal. Agents can only add drafts.');
  process.exit(1);
}

// Loaded after the terminal check so nothing else runs for a non-interactive caller.
const { list } = await import('./lib/queue.mjs');
const { approve, reject } = await import('./lib/approval.mjs');
const { loadEnv } = await import('./lib/env.mjs');
const { card } = await import('./lib/review.mjs');
const { pick } = await import('./adapters/index.mjs');

const env = loadEnv();
const items = list('pending');
if (!items.length) {
  console.log('no pending items');
  process.exit(0);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const counts = { approved: 0, rejected: 0, skipped: 0 };

for (const [i, item] of items.entries()) {
  let how;
  try {
    const adapter = pick(item.channel, env);
    how = adapter.fallbackFrom ? 'handoff (no API credentials)' : adapter.mode;
  } catch (e) {
    how = `unknown (${e.message})`;
  }
  console.log(card(item, i, items.length, how));
  const answer = (await rl.question('\n[a]pprove  [r]eject  [s]kip  [q]uit: ')).trim().toLowerCase();
  if (answer === 'q') break;
  if (answer === 'a') {
    try {
      approve(item.id);
      counts.approved++;
      console.log(`approved ${item.id}`);
    } catch (e) {
      console.error(e.message);
    }
  } else if (answer === 'r') {
    const reason = (await rl.question('Reason: ')).trim();
    try {
      reject(item.id, { reason });
      counts.rejected++;
      console.log(`rejected ${item.id}`);
    } catch (e) {
      console.error(e.message);
    }
  } else {
    counts.skipped++;
  }
}
rl.close();

console.log(`\n${counts.approved} approved, ${counts.rejected} rejected, ${counts.skipped} skipped`);
if (counts.approved) console.log('Send what is due now with: npm run publish -- due --live');
