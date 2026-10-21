// Cases from the October 2026 red-team pass on the approval gate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide } from '../scripts/hooks/approval-gate.mjs';

const env = { CLAUDE_PROJECT_DIR: '/repo' };
const bash = (command, e = env) => decide({ tool_name: 'Bash', tool_input: { command }, cwd: '/repo' }, e).block;
const tool = (tool_name, tool_input = {}) => decide({ tool_name, tool_input, cwd: '/repo' }, env).block;

test('quotes, backslashes and ${IFS} do not hide protected paths or .env', () => {
  assert.equal(bash(`echo x > que"ue"/approved/a.json`), true);
  assert.equal(bash(`echo x > qu\\eue/approved/a.json`), true);
  assert.equal(bash(`cp evil.mjs 'scr'ipts/hooks/approval-gate.mjs`), true);
  assert.equal(bash(`cat .e"nv"`), true);
  assert.equal(bash('cat${IFS}.env'), true);
  assert.equal(bash(`cat $'\\x2eenv'`), true);
  assert.equal(bash(`cat $'\\056env'`), true);
});

test('line editors are file-changing commands too', () => {
  assert.equal(bash(`printf '1,$d\\nw\\n' | ed scripts/hooks/approval-gate.mjs`), true);
  assert.equal(bash('ex -sc "wq" config/owner.json'), true);
  assert.equal(bash('cat drafts/ed.json'), false);
});

test('file-changing commands beyond cp/mv are caught', () => {
  for (const c of [
    'install -m 644 evil.mjs scripts/hooks/approval-gate.mjs',
    'rsync evil.json config/owner.json',
    'ditto x brand/ameya-heights/compliance.json',
    'tar -xf payload.tar -C scripts/',
    'sed -n 1p x > tests/x.test.mjs',
    'awk 1 x > package.json',
  ]) assert.equal(bash(c), true, c);
});

test('patches, git config and shell escapes in text tools are blocked', () => {
  for (const c of [
    'git apply drafts/x.patch',
    'git am < drafts/x.mbox',
    'patch -p1 < drafts/x.diff',
    'git -c alias.x=!sh x',
    'git config alias.ok "!npm run approve"',
    `awk 'BEGIN{system("id")}'`,
    `sed 's/x/id/e' file`,
    'find . -name "*.json" -exec cp {} queue/approved/ \\;',
    'find drafts -delete',
  ]) assert.equal(bash(c), true, c);
});

test('wildcards in file-changing commands outside drafts/ are blocked', () => {
  assert.equal(bash('cp evil.mjs scr?pts/hooks/approval-gate.mjs'), true);
  assert.equal(bash('mv x q*/approved/'), true);
  assert.equal(bash('rm drafts/content-engine/*.json'), false);
  assert.equal(bash('ls scr*'), false);
});

test('a file named like a command is not mistaken for one', () => {
  assert.equal(bash('node scripts/queue.mjs add drafts/install.json'), false);
  assert.equal(bash('npm run queue -- add drafts/leads/tar-reply.json'), false);
});

test('platform API hosts are blocked in any tool that takes a URL', () => {
  assert.equal(tool('WebFetch', { url: 'https://graph.facebook.com/v23.0/me/feed', prompt: 'x' }), true);
  assert.equal(tool('WebFetch', { url: 'https://mybusiness.googleapis.com/v4/accounts' }), true);
  assert.equal(tool('WebFetch', { url: 'https://www.thehindu.com/news/cities/bangalore/' }), false);
});

test('MCP tools that change things are blocked on any server, reading is not', () => {
  for (const t of ['mcp__drive__create_file', 'mcp__railway__create-deployment', 'mcp__instagram__POST_media',
    'mcp__context-mode__ctx_execute', 'mcp__vercel__update_project', 'mcp__neon__run_sql', 'mcp__x__sendMessage'])
    assert.equal(tool(t), true, t);
  for (const t of ['mcp__drive__read_file_content', 'mcp__vercel__get_deployment', 'mcp__instagram__get_insights',
    'mcp__neon__list_projects', 'mcp__ccd_session__start_session'])
    assert.equal(tool(t), false, t);
});

test('everyday agent commands still work', () => {
  for (const c of ['npm run queue -- add drafts/content-engine/a.json', 'npm run inbox', 'npm run insights', 'npm test',
    'node --test tests/', 'git status', 'git diff', 'cat drafts/x.json', 'node scripts/queue.mjs list 2>&1',
    'grep -n Salavakkam brand/ameya-heights/facts.md', 'mkdir -p drafts/leads'])
    assert.equal(bash(c), false, c);
});
