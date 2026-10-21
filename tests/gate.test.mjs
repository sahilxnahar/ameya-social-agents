import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide } from '../scripts/hooks/approval-gate.mjs';

const root = '/repo';
const env = { CLAUDE_PROJECT_DIR: root };
const bash = (command, e = env) => decide({ tool_name: 'Bash', tool_input: { command } }, e).block;
const write = (file_path, e = env) => decide({ tool_name: 'Write', tool_input: { file_path } }, e).block;

test('agents can draft, queue, list and dry-run', () => {
  assert.equal(bash('npm run queue -- add drafts/content-engine/a.json'), false);
  assert.equal(bash('node scripts/queue.mjs add drafts/x.json 2>&1'), false);
  assert.equal(bash('npm run queue -- list'), false);
  assert.equal(bash('npm run publish -- 2026-10-21-gbp-abc123'), false);
  assert.equal(bash('cat queue/approved/x.json'), false);
});

test('agents cannot approve, reject or publish live', () => {
  assert.equal(bash('npm run approve -- abc'), true);
  assert.equal(bash('node scripts/queue.mjs approve abc'), true);
  assert.equal(bash('npm run reject -- abc nope'), true);
  assert.equal(bash('npm run publish -- due --live'), true);
  assert.equal(bash('node scripts/publish.mjs posted abc https://x'), true);
  assert.equal(bash('script -q /dev/null node scripts/queue.mjs approve abc'), true);
  assert.equal(bash('SMA_ROOT=/tmp/x node scripts/queue.mjs list'), true);
});

test('approve and live publish stay blocked in maintainer mode', () => {
  const m = { ...env, SMA_MAINTAINER: '1' };
  assert.equal(bash('npm run approve -- abc', m), true);
  assert.equal(bash('npm run publish -- due --live', m), true);
});

test('agents cannot modify the queue, config, logs, hooks or scripts from the shell', () => {
  assert.equal(bash('mv queue/pending/a.json queue/approved/'), true);
  assert.equal(bash('echo {} > queue/approved/a.json'), true);
  assert.equal(bash('sed -i "" s/a/b/ config/owner.json'), true);
  assert.equal(bash('rm logs/approvals.log'), true);
  assert.equal(bash('cat x >> brand/ameya-heights/compliance.json'), true);
  assert.equal(bash('cp evil.mjs scripts/hooks/approval-gate.mjs'), true);
});

test('file writes are limited to drafts, reports, brand notes and results', () => {
  assert.equal(write('/repo/drafts/content-engine/a.json'), false);
  assert.equal(write('/repo/reports/leads.md'), false);
  assert.equal(write('/repo/brand/ameya-heights/facts.md'), false);
  assert.equal(write('/repo/logs/results.md'), false);
  assert.equal(write('/repo/queue/approved/a.json'), true);
  assert.equal(write('/repo/queue/pending/a.json'), true);
  assert.equal(write('/repo/brand/ameya-heights/compliance.json'), true);
  assert.equal(write('/repo/config/owner.json'), true);
  assert.equal(write('/repo/.claude/settings.json'), true);
  assert.equal(write('/repo/scripts/lib/claims.mjs'), true);
  assert.equal(write('/repo/CLAUDE.md'), true);
});

test('maintainers can edit framework code but not the gate or the rules files', () => {
  const m = { ...env, SMA_MAINTAINER: '1' };
  assert.equal(write('/repo/scripts/lib/claims.mjs', m), false);
  assert.equal(write('/repo/scripts/hooks/approval-gate.mjs', m), true);
  assert.equal(write('/repo/config/owner.json', m), true);
  assert.equal(write('/repo/.claude/settings.json', m), true);
});

test('live-account MCP tools and browser actions are blocked, reading is not', () => {
  const tool = (tool_name) => decide({ tool_name, tool_input: {} }, env).block;
  assert.equal(tool('mcp__instagram__create_post'), true);
  assert.equal(tool('mcp__whatsapp__send_message'), true);
  assert.equal(tool('mcp__metricool__schedule_post'), true);
  assert.equal(tool('mcp__instagram__get_insights'), false);
  assert.equal(tool('mcp__claude-in-chrome__computer'), true);
  assert.equal(tool('mcp__Claude_Browser__form_input'), true);
  assert.equal(tool('mcp__Claude_Browser__get_page_text'), false);
  assert.equal(tool('WebSearch'), false);
});
