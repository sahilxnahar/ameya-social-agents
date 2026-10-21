#!/usr/bin/env node
// PreToolUse hook: the approval gate. Agents may research, draft and queue. They may not approve,
// publish live, message anyone, or edit the rules that enforce this. Exit code 2 blocks the call.
// Maintainers editing the framework itself can launch with SMA_MAINTAINER=1; approving and live
// publishing stay blocked even then.
import { relative, resolve, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

const AGENT_WRITABLE = [/^drafts\//, /^reports\//, /^brand\/[^/]+\/.*\.md$/, /^logs\/[^/]+\.md$/];
const MAINTAINER_WRITABLE = [/^scripts\/(?!hooks\/)/, /^\.claude\/(agents|commands)\//, /^tests\//, /^brand\//, /^[^/]+\.md$/, /^package\.json$/];

const HUMAN_ONLY_COMMANDS = [
  [/queue\.mjs\s+(approve|reject)\b/, 'approving or rejecting is for the owner, in their own terminal'],
  [/npm\s+run\s+(approve|reject)\b/, 'approving or rejecting is for the owner, in their own terminal'],
  [/(publish\.mjs|npm\s+run\s+publish)\b.*(--live|\bposted\b)/, 'live publishing is for the owner or the scheduler'],
  [/\bSMA_(ROOT|MAINTAINER)=/, 'agents may not change the queue root or maintainer mode'],
  [/\b(script|expect|unbuffer|socat)\b.*(queue|publish)/, 'agents may not fake an interactive terminal'],
];

const PROTECTED = String.raw`(queue\/|config\/owner|logs\/(approvals|published)\.log|\.claude\/|scripts\/|compliance\.json)`;
const PROTECTED_IN_BASH = new RegExp(PROTECTED);
// A redirect only counts when it points into a protected path, so "2>&1" stays allowed.
const REDIRECT_INTO_PROTECTED = new RegExp(String.raw`(>>?|\btee\b(\s+-a)?)\s*["']?[^\s"'&|;]*${PROTECTED}`);
const MUTATING = /(\bmv\b|\bcp\b|\brm\b|\bsed\s+-i|\bperl\s+-i|\bchmod\b|\bln\b|\btouch\b|\btruncate\b|\bdd\b|\bnode\s+-e|\bpython3?\s+-c|git\s+(checkout|restore|reset|stash))/;

const SOCIAL = /(instagram|facebook|meta|whatsapp|linkedin|youtube|google.?business|gbp|metricool|buffer|hootsuite|manychat|sprout|later)/i;
const WRITE_VERB = /(post|publish|send|reply|create|update|delete|schedule|boost|comment|message|upload|campaign)/i;
const BROWSER_ACTION = /^mcp__(claude-in-chrome|Claude_Browser|Control_Chrome|plugin_ecc_chrome-devtools)__(computer|form_input|javascript|javascript_tool|execute_javascript|click|fill|fill_form|type_text|press_key|upload_file|upload_image|drag|browser_batch)$/;

function block(reason) {
  return { block: true, reason: `Approval gate: ${reason}. Put a draft in the queue with "npm run queue -- add" instead.` };
}

export function decide(input, env = process.env) {
  const tool = input.tool_name || '';
  const ti = input.tool_input || {};
  const root = env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const maintainer = env.SMA_MAINTAINER === '1';

  if (tool === 'Bash') {
    const cmd = String(ti.command || '');
    for (const [pattern, why] of HUMAN_ONLY_COMMANDS) if (pattern.test(cmd)) return block(why);
    if (!maintainer && (REDIRECT_INTO_PROTECTED.test(cmd) || (PROTECTED_IN_BASH.test(cmd) && MUTATING.test(cmd)))) {
      return block('shell commands may not modify the queue, config, logs, hooks or scripts');
    }
    return { block: false };
  }

  if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
    const target = ti.file_path || ti.notebook_path || '';
    const abs = isAbsolute(target) ? target : resolve(root, target);
    const rel = relative(root, abs);
    if (rel.startsWith('..') || isAbsolute(rel)) return { block: false };
    if (AGENT_WRITABLE.some((r) => r.test(rel))) return { block: false };
    if (maintainer && MAINTAINER_WRITABLE.some((r) => r.test(rel))) return { block: false };
    return block(`agents may not write ${rel}`);
  }

  if (BROWSER_ACTION.test(tool)) return block('agents may not click or type in a browser');
  if (tool.startsWith('mcp__') && SOCIAL.test(tool) && WRITE_VERB.test(tool.split('__').pop())) {
    return block(`${tool} would act on a live account`);
  }
  return { block: false };
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    console.error('Approval gate: could not read hook input, blocking to be safe.');
    process.exit(2);
  }
  const result = decide(input);
  if (result.block) {
    console.error(result.reason);
    process.exit(2);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
