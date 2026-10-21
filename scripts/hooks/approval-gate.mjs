#!/usr/bin/env node
// PreToolUse hook: the approval gate. Agents may research, draft and queue. They may not approve,
// publish live, message anyone, call platform APIs, read credentials, run code they wrote, install
// packages, or edit the rules that enforce this. Exit code 2 blocks the call.
// Maintainers editing the framework itself can launch with SMA_MAINTAINER=1; approving, live
// publishing, credentials and the Bash rules below stay blocked even then.
import { relative, resolve, isAbsolute, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

// facts.md is excluded: the brand-librarian proposes fact changes in reports/fact-changes.md.
const AGENT_WRITABLE = [/^drafts\//, /^reports\//, /^brand\/[^/]+\/(?!facts\.md$).*\.md$/, /^logs\/[^/]+\.md$/];
const MAINTAINER_WRITABLE = [/^scripts\/(?!hooks\/)/, /^\.claude\/(agents|commands)\//, /^tests\//, /^brand\//, /^[^/]+\.md$/, /^package\.json$/];

const OWNER_ONLY = 'batch review, scheduling and account sign-in are for the owner, in their own terminal';
const HUMAN_ONLY_COMMANDS = [
  [/queue\.mjs\s+(approve|reject)\b/, 'approving or rejecting is for the owner, in their own terminal'],
  [/npm\s+run\s+(approve|reject)\b/, 'approving or rejecting is for the owner, in their own terminal'],
  [/(publish\.mjs|npm\s+run\s+publish)\b.*(--live|\bposted\b)/, 'live publishing is for the owner or the scheduler'],
  [/\bSMA_(ROOT|MAINTAINER)=/, 'agents may not change the queue root or maintainer mode'],
  [/\b(script|expect|unbuffer|socat)\b.*(queue|publish)/, 'agents may not fake an interactive terminal'],
  [/\bnpm\s+run(-script)?\s+(review|youtube-auth|schedule[\w:-]*)(?![\w-])/, OWNER_ONLY],
  [/(^|[^\w.-])scripts\/(review\.mjs|schedule\/|auth\/)/, OWNER_ONLY],
  [/\b(launchctl|crontab)\b/, 'agents may not install or change scheduled jobs'],
];

// Text rules that apply to the whole command line, whatever runs it.
const TEXT_RULES = [
  [/(graph\.facebook\.com|googleapis\.com|accounts\.google\.com|api\.linkedin\.com|mybusiness|vercel-storage\.com|blob\.vercel)/i,
    'agents may not call platform APIs directly; use the queue'],
  [/(^|[^\w.])\.env(?![\w-])(?!\.example(?![\w.-]))/, 'agents may not read or write credentials (.env)'],
  [/\bprintenv\b|\b(export|declare|typeset)\s+-[a-zA-Z]*[px]\b/, 'agents may not list environment variables'],
  [/\$\{?[A-Z0-9_]*(TOKEN|SECRET|KEY|PASSWORD)[A-Z0-9_]*/, 'agents may not expand credential variables'],
  [/\bnpm\s+(-\S+\s+)*(install|i|add|ci|update|up|upgrade|exec|x)\b|\b(npx|pnpm|pnpx|bunx)\b|\byarn\s+(add|install|dlx)\b|\bbun\s+(add|install|i|x)\b|\bpip[\d.]*\s+install\b|\bbrew\s+(install|reinstall|upgrade)\b/,
    'agents may not install packages; ask the owner'],
  [/\bbase64\b[^|;&]*\s(-d|-D|--decode)\b|\bxxd\s+-r\b/, 'agents may not decode and run hidden commands'],
];

const PROTECTED = String.raw`(queue\/|config\/owner|logs\/(approvals|published)\.log|\.claude\/|scripts\/|tests\/|package\.json|compliance\.json|brand\/[^/\s]+\/facts\.md)`;
const PROTECTED_IN_BASH = new RegExp(PROTECTED);
// A redirect only counts when it points into a protected path, so "2>&1" stays allowed.
const REDIRECT_INTO_PROTECTED = new RegExp(String.raw`(>>?|\btee\b(\s+-a)?)\s*["']?[^\s"'&|;]*${PROTECTED}`);
// Anything that can create, change or remove a file, matched where a command starts (so a file
// called drafts/install.json is not mistaken for the install command).
const MUTATING = /((^|[;&|(`]|\$\()\s*(\w+=\S*\s+)*((sudo|env|command|nohup|time|xargs)\s+(-\S+\s+)*)*(mv|cp|rm|rmdir|ln|touch|truncate|dd|chmod|chown|install|rsync|ditto|patch|ed|ex|vi|vim|sponge|cpio|tar|unzip|gunzip|sed|awk|gawk|mawk|nawk|perl|curl|wget)(\s|$)|\bnode\s+-e|\bpython3?\s+-c|\bgit\s+(checkout|restore|reset|stash|clean|mv|rm|apply|am|pull|merge|rebase|cherry-pick|revert|worktree|switch)\b)/;
// Commands that change files without naming them, or run shell commands from inside a text tool.
const SHELL_IN_TEXT = 'agents may not run commands from inside awk, sed or find';
const HIDDEN_WRITES = [
  [/\bgit\s+(apply|am)\b|(^|[\s;&|(])patch(\s|$)/, 'agents may not apply patches; stage changes in drafts/maintainer for the owner'],
  [/\bgit\s+(-c\b|config\b)/, 'agents may not change git configuration'],
  [/\b[gnm]?awk\b[^|;&]*\b(system|getline)\b/, SHELL_IN_TEXT],
  [/\bsed\b[^|;&]*(\/[a-zA-Z0-9]*e[a-zA-Z0-9]*(\s|['";]|$)|(^|['"\s;{])e(\s|['";}]|$))/, SHELL_IN_TEXT],
  [/\bfind\b[^|;&]*\s-(exec|execdir|ok|okdir|delete|fprint\w*)\b/, SHELL_IN_TEXT],
];
// Wildcards in a file-changing command could reach a protected path by pattern (scr?pts/...).
const WILDCARD_OUTSIDE_DRAFTS = /(^|\s)(?!(\.\/)?(drafts|reports)\/)[^\s]*[*?[]/;

// What the shell will actually see once quotes, backslashes and ${IFS} are removed.
// $'...' strings are decoded first (\x2e, \056, . and \n style escapes).
const decodeAnsiC = (s) => s
  .replace(/\\x([0-9a-fA-F]{1,2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/\\u([0-9a-fA-F]{1,4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/\\([0-7]{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
  .replace(/\\n/g, '\n').replace(/\\t/g, '\t');
const flatten = (cmd) => cmd
  .replace(/\$'((?:[^'\\]|\\.)*)'/g, (_, s) => decodeAnsiC(s))
  .replace(/\$\{?IFS\}?/g, ' ')
  .replace(/[\\"']/g, '');

// MCP tools that change something anywhere. The tool name's verb decides: get_/list_/read_… stay
// allowed; create_/send_/run_… (or any of those words later in the name) are blocked.
const MCP_READ_VERBS = new Set(['get', 'list', 'read', 'search', 'fetch', 'query', 'describe', 'view', 'show', 'find', 'count',
  'check', 'analyze', 'aggregate', 'inspect', 'lookup', 'resolve', 'explain', 'whoami', 'help', 'status', 'download']);
const MCP_WRITE_VERBS = new Set(['create', 'update', 'delete', 'remove', 'send', 'post', 'publish', 'reply', 'upload', 'deploy',
  'write', 'set', 'add', 'edit', 'rename', 'move', 'copy', 'share', 'trash', 'schedule', 'boost', 'comment', 'message', 'execute',
  'exec', 'run', 'eval', 'invoke', 'trigger', 'purchase', 'buy', 'approve', 'merge', 'push', 'restart', 'stop', 'start', 'cancel',
  'patch', 'put', 'import', 'transfer', 'rotate', 'revoke', 'grant', 'apply', 'autofill', 'generate', 'resize', 'redeploy', 'store',
  'save', 'submit', 'accept', 'pause', 'unpause', 'promote', 'rollback', 'restore', 'invalidate', 'issue', 'buy', 'verify', 'record']);
function mcpWrites(tool) {
  const words = tool.split('__').pop().replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().split(/[_\-.]+/).filter(Boolean);
  if (MCP_READ_VERBS.has(words[0])) return false;
  return words.some((w) => MCP_WRITE_VERBS.has(w));
}
const PLATFORM_HOSTS = TEXT_RULES[0][0];
const BROWSER_ACTION = /^mcp__(claude-in-chrome|Claude_Browser|Control_Chrome|plugin_ecc_chrome-devtools)__(computer|form_input|javascript|javascript_tool|execute_javascript|click|fill|fill_form|type_text|press_key|upload_file|upload_image|drag|browser_batch)$/;

// Interpreters, the flags that make them run inline code, and flags that load another file first.
const INTERPRETERS = {
  node: { inline: /^(-[a-zA-Z]*[ep]|--eval|--print|--input-type)(=|$)/, preload: /^(-r|--require|--import|--loader|--experimental-loader)$/ },
  python: { inline: /^-[a-zA-Z]*c$/, stop: /^-m$/ },
  sh: { nested: /^-[a-zA-Z]*c$/ },
  bun: { inline: /^(-e|--eval|-p|--print)$/, sub: /^run$/ },
  deno: { inline: /^eval$/, sub: /^run$/ },
  tsx: { inline: /^(-e|--eval|-p|--print)$/ },
  perl: { inline: /^-[a-zA-Z]*[eE]$/ },
  ruby: { inline: /^-[a-zA-Z]*e$/ },
  php: { inline: /^-[a-zA-Z]*r$/ },
};
const interpreterOf = (p) =>
  /^node(js)?$/.test(p) ? 'node' : /^python[\d.]*$/.test(p) ? 'python' : /^(ba|z|da|k)?sh$/.test(p) ? 'sh'
    : /^(ts-node|tsx)$/.test(p) ? 'tsx' : /^perl[\d.]*$/.test(p) ? 'perl' : /^ruby$/.test(p) ? 'ruby'
      : ['bun', 'deno', 'php'].includes(p) ? p : null;
const WRAPPERS = new Set(['env', 'nohup', 'time', 'exec', 'command', 'builtin', 'xargs', 'sudo', 'nice', 'timeout', 'caffeinate', 'stdbuf']);
const AGENT_DIRS = /^(drafts|reports|outbox|brand)(\/|$)/;
const OWNER_FILES = /^scripts\/(review\.mjs$|schedule\/|auth\/)/;
const INLINE = 'agents may not run inline code; put the work in a draft or use the npm scripts';
const AGENT_FILE = 'agents may not run files under drafts/, reports/, outbox/ or brand/; the owner runs those';

function block(reason) {
  return { block: true, reason: `Approval gate: ${reason}. Put a draft in the queue with "npm run queue -- add" instead.` };
}

// Is this path something agents can write (agent) or an owner-only script (owner)?
function pathClass(token, cwd, root) {
  if (!token || token.startsWith('-') || token.includes('$')) return null;
  const rel = relative(root, resolve(cwd, token));
  if (rel.startsWith('..') || isAbsolute(rel)) return null;
  return AGENT_DIRS.test(rel) ? 'agent' : OWNER_FILES.test(rel) ? 'owner' : null;
}
const fileBlock = (cls) => (cls === 'agent' ? AGENT_FILE : cls === 'owner' ? OWNER_ONLY : null);

// A small shell reader: splits the command into simple commands, follows "cd", skips wrappers
// like env/nohup/xargs, and looks at what each interpreter is asked to run. Returns a reason or null.
function checkShell(cmd, cwd, root) {
  const parts = cmd.split(/(\|\||&&|[;&|()`\n]|\$\()/);
  for (let i = 0; i < parts.length; i += 2) {
    const fromPipe = parts[i - 1] === '|';
    const toks = parts[i].trim().split(/\s+/).filter(Boolean).map((t) => t.replace(/["'\\]/g, ''));
    let k = 0;
    let wrappedByEnv = false;
    while (k < toks.length && (/^\w+=/.test(toks[k]) || WRAPPERS.has(basename(toks[k])))) {
      const isWrapper = WRAPPERS.has(basename(toks[k]));
      if (basename(toks[k]) === 'env') wrappedByEnv = true;
      k++;
      while (isWrapper && k < toks.length && /^(-|\d)/.test(toks[k])) k++;
    }
    const prog = toks[k];
    if (!prog) {
      if (wrappedByEnv) return 'agents may not list environment variables';
      continue;
    }
    const args = toks.slice(k + 1);
    const name = basename(prog);
    if (prog.startsWith('$')) return 'agents may not run a command named by a variable';
    if (name === 'set' && args.length === 0) return 'agents may not list environment variables';
    if (name === 'eval' || name === 'osascript') return INLINE;
    if (name === 'cd' || name === 'pushd') { cwd = resolve(cwd, args[0] || root); continue; }
    if (name === 'source' || prog === '.') { const r = fileBlock(pathClass(args[0], cwd, root)); if (r) return r; continue; }
    if (prog.includes('/')) { const r = fileBlock(pathClass(prog, cwd, root)); if (r) return r; }
    const interp = interpreterOf(name);
    if (!interp) continue;
    const spec = INTERPRETERS[interp];
    let script = null;
    for (let j = 0; j < args.length; j++) {
      const t = args[j];
      if (t.startsWith('<') || t === '-' || /^\/dev\/(stdin|fd\/)/.test(t) || spec.inline?.test(t)) return INLINE;
      if (spec.nested?.test(t)) { const r = checkShell(args.slice(j + 1).join(' '), cwd, root); if (r) return r; script = '-c'; break; }
      if (spec.preload?.test(t)) { const r = fileBlock(pathClass(args[++j], cwd, root)); if (r) return r; continue; }
      if (spec.stop?.test(t)) { script = t; break; }
      if (t.startsWith('-') || (spec.sub?.test(t) && j === 0)) continue;
      script = t;
      break;
    }
    if (script) { const r = fileBlock(pathClass(script, cwd, root)); if (r) return r; }
    else if (fromPipe) return INLINE; // the interpreter would read code from the pipe
  }
  return null;
}

const isEnvFile = (p) => /^\.env(?!\.example$)(\..+)?$/.test(basename(String(p || '')));

export function decide(input, env = process.env) {
  const tool = input.tool_name || '';
  const ti = input.tool_input || {};
  const root = env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const cwd = input.cwd || root;
  const maintainer = env.SMA_MAINTAINER === '1';

  if (tool === 'Bash') {
    const raw = String(ti.command || '');
    const flat = flatten(raw);
    for (const cmd of [raw, flat]) {
      for (const [pattern, why] of [...HUMAN_ONLY_COMMANDS, ...TEXT_RULES, ...HIDDEN_WRITES]) if (pattern.test(cmd)) return block(why);
    }
    const why = checkShell(raw, cwd, root);
    if (why) return block(why);
    if (!maintainer) {
      const writes = MUTATING.test(flat) || /[^&0-9]>|^>/.test(flat);
      if (REDIRECT_INTO_PROTECTED.test(flat) || (writes && PROTECTED_IN_BASH.test(flat))) {
        return block('shell commands may not modify the queue, config, logs, facts, tests, hooks or scripts');
      }
      if (writes && WILDCARD_OUTSIDE_DRAFTS.test(flat)) return block('agents may not use wildcards in commands that change files outside drafts/ and reports/');
    }
    return { block: false };
  }

  // Any other tool that takes a URL (WebFetch and MCP fetchers) may not hit platform APIs.
  for (const key of ['url', 'uri', 'endpoint']) {
    if (typeof ti[key] === 'string' && PLATFORM_HOSTS.test(ti[key])) return block('agents may not call platform APIs directly; use the queue');
  }

  if (['Read', 'Grep'].includes(tool) && isEnvFile(ti.file_path || ti.path)) {
    return block('agents may not read credentials (.env)');
  }

  if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
    const target = ti.file_path || ti.notebook_path || '';
    const abs = isAbsolute(target) ? target : resolve(root, target);
    const rel = relative(root, abs);
    if (rel.startsWith('..') || isAbsolute(rel)) return { block: false };
    if (AGENT_WRITABLE.some((r) => r.test(rel))) return { block: false };
    if (maintainer && MAINTAINER_WRITABLE.some((r) => r.test(rel))) return { block: false };
    if (/^brand\/[^/]+\/facts\.md$/.test(rel)) return block('agents may not edit facts.md; propose the change in reports/fact-changes.md');
    return block(`agents may not write ${rel}`);
  }

  if (BROWSER_ACTION.test(tool)) return block('agents may not click or type in a browser');
  // The desktop app's own session controls (mcp__ccd_*) always ask the user, so they stay allowed.
  if (tool.startsWith('mcp__') && !tool.startsWith('mcp__ccd_') && mcpWrites(tool)) {
    return block(`${tool} would change something outside this repo; only reading tools are allowed`);
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
