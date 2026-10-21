# Handover: ameya-social-agents

Written 21 October 2026 at the end of the build session, for whoever takes this over (the owner, from
another GitHub account). It covers what this is, how it is built, what was decided and why, what was
tested, and what is still open. Read this first, then `README.md` and `CLAUDE.md`.

> **Visibility note.** On the owner's instruction (21 Oct 2026) this repo is public and contains
> internal context: `brand/ameya-heights/private/`, `reports/research/`, `reports/trials/` and
> `reports/questions.md`. The owner intends to filter it later. Anything in those folders should be
> treated as internal to Ameya Heights LLP even though it is visible here. MIT licensed.

## 1. What this is

A Claude Code agent team that runs social media for **Ameya Heights LLP** (founder-led real-estate
developer; projects FOUR·94 in Basaveshwara Nagar, Bengaluru, Salavakkam near Chennai, and an early
Jodhpur site). Agents research, draft and queue. **Nothing posts, replies, messages or spends until
the owner approves it in their own terminal.** That rule is enforced in code, not just prompts.

It is the only place the social system lives. It does not touch the website repo
(`sahilxnahar/Ameyaheights`); the owner explicitly wants the two kept apart.

## 2. How it works

```
event (/daily-run, /inbox, /new-lead…) → orchestrator (CLAUDE.md) → department agent → draft JSON
  → compliance-reviewer (PASS/FIX) → npm run queue -- add (validate + claims lint + budget)
  → queue/pending → owner: npm run review (TTY only) → queue/approved (content hash recorded)
  → npm run publish -- due --live (owner or launchd scheduler; hash re-checked)
  → Meta / WhatsApp / YouTube API, or outbox/ hand-off pack for LinkedIn and Google Business Profile
  → lead recorded in the CRM after an approved send
```

- **Departments** (`.claude/agents/`): search-visibility, market-radar, content-engine, creative-studio,
  publishing, reputation, leads, results.
- **Support agents**: compliance-reviewer (checks every draft), nri-desk, journal-writer,
  video-producer, brand-librarian (keeps `facts.md` current by proposal, never edits it).
- **Commands** (`.claude/commands/`): /daily-run, /inbox, /new-lead, /new-review, /construction-update,
  /negative-mention, /weekly-plan, /weekly-report, /queue.
- **Scripts** (`scripts/`): queue CLI, review (owner batch approval), publish, inbox, insights,
  adapters (meta, whatsapp, youtube, handoff), lib (queue, approval, claims, owner, env, media, crm,
  meta-read, review), schedule (launchd install/run/uninstall), auth/youtube-token, hooks/approval-gate.

## 3. Safety layers (all tested)

1. **Approval gate hook** `scripts/hooks/approval-gate.mjs` (PreToolUse on every tool). Blocks: approve,
   reject, review, live publish, scheduler and sign-in scripts; editing the queue, config, scripts,
   tests, hooks, compliance rules, `facts.md`; reading `.env`; platform API hosts in Bash or any URL;
   inline code (`node -e`, heredocs, pipes into interpreters, awk/sed/find escapes); running files
   agents can write; package installs; patches and git config; quote/backslash/`$'..'`/`${IFS}`
   obfuscation; wildcards in file-changing commands; write-type MCP tools on any server.
2. **OS sandbox** (`.claude/settings.json` → `sandbox`): Bash can't write scripts/, config/, queue/,
   tests/, outbox/, package.json, compliance.json, facts.md, the logs, or read `.env`; no network.
   Exceptions run unsandboxed: `npm run queue -- add …`, `npm run inbox`, `npm run insights`.
3. **TTY-only approval**: `npm run approve` and `npm run review` refuse without an interactive terminal.
4. **Tamper-evident approvals**: SHA-256 of channel, kind, target, content, schedule, spend and lead;
   re-checked before publishing. Items approved before leads existed keep their old hash.
5. **Claims linter** `brand/ameya-heights/compliance.json`, checked on queue add and on approval, over
   text, link, YouTube title and WhatsApp template params (not the private lead block).
6. **Spend cap** `monthly_spend_cap_inr` in `config/owner.json` (git-ignored; copy the example).
7. **Private data** in drafts/, queue items, outbox/, logs and (normally) reports/ is git-ignored.

Known limit: the gate splits commands on `|` even inside quotes, so `grep "a|b" file` is wrongly
blocked (harmless false positive; fix in `checkShell`).

## 4. Owner decisions (21 Oct 2026)

| Topic | Decision |
|---|---|
| Salavakkam | DTCP approval and RERA registration **"to follow"**; pricing on request; no booking language (RERA s.3). Do not use the chatbot's "approvals secured" or ₹2,000–2,100/sq ft |
| Tagline | "Built in the open" is **retired** (keep the idea: dated progress, documents first, "verify us") |
| Visuals | Brand Canon black / sand / brass: #100F0D, #ECE7DF, #C2A05B (text #A07D34), #16140F, #9A958C; Cormorant Garamond + Inter |
| Channels | All, moderate: Instagram 4–5/wk, LinkedIn 3–4/wk, Facebook mirrors Instagram, YouTube 2/month, GBP weekly, every WhatsApp lead answered |
| Defaults kept from the Oct 2026 fact pass | No "column-free"; completion "target Q1 2028" (website: "target February 2028"); FOUR·94 lease only; pricing on request everywhere |
| Repo | Public, MIT, named `ameya-social-agents`; local folder `~/Documents/GitHub/ameya-social-agents` |
| Approval policy | Everything needs the owner's OK |

Source material: `~/Downloads/Ameya Heights/` on the owner's Mac (Brand Canon 13 Jul, Messaging
Master, Launch Playbook, Manus 30-day plan 14 Aug, Reconciled Action Plan 13 Aug, CRM v16.17, chatbot
tests). Digests: `reports/research/marketing-digest.md`, `strategy-digest.md`, `owner-decisions.md`.
Where those sources conflict with the October fact pass, October wins (see the conflict table in the
marketing digest).

## 5. What was tested

- **Unit and integration:** 107 tests, all passing (`npm test`).
- **Real-caption trial** (`reports/trials/content-trial/`): 118 captions from the owner's ready-made
  copy. The first rules caught 37% of the bad ones; the current rules catch 62/62 with 0 false
  positives (in-sample; a held-out set found 3 more, now fixed).
- **Team trial** (`reports/trials/team-trial/`): a simulated week (21 drafts, 3 leads incl. a prompt
  injection, 2 reviews). Average 4.4/5; injection handled; weak spot is usefulness (needs real site
  photos and more facts). Fixes applied: refusals pass, missed phrasings blocked, carousels split,
  suspicious-message branch, posting slots, "#494" hashtag trap.
- **Red team** (`reports/trials/red-team/harness.mjs`, run with `node`): 123 attempts; 35 bypasses at
  first, **0** now. Remaining defence beyond the gate is the OS sandbox.

## 6. Status

- v0.3 committed and pushed (all code applied). Live credentials are **not** configured, so every
  channel currently hands off to `outbox/` for manual posting.
- `drafts/maintainer/` on the owner's Mac is the staging area used to apply framework changes while the
  gate was active; it is git-ignored and already applied.

## 7. Open items

**Setup (owner):**
1. `cp config/owner.example.json config/owner.json`; set approver and a spend cap (0 to start).
2. `cp .env.example .env` when connecting channels: Meta (Page id, token, IG user id), WhatsApp Cloud
   API, CRM read and write tokens, Vercel Blob token, YouTube OAuth (`npm run youtube-auth`).
3. Optional auto-publishing: `npm run schedule:install` (may need Documents access for node).
4. In a new Claude session in the repo, `/sandbox` should show the sandbox enabled.

**Decisions waiting on the owner** (also in `reports/questions.md`, 12 questions from the team trial):
- Site-visit booking link; second road name at the corner; what is in the document pack; the
  channel-partner process; which Google Business Profile to post on.
- Hindi/Arabic; founder-name spelling ("Sahil Nahar" in use); whether to publish the K-RERA application
  number; a named Grievance Officer.

**Business, not code:** rebuild the Google Business Profile under the LLP name; a CRM credential
rotation task (tracked offline); shoot monthly dated FOUR·94 site photos (the main content gap).

**Not possible yet:** live posting to Google Business Profile and LinkedIn needs API approval from
Google and LinkedIn; until then those channels stay as hand-off packs.

## 8. How to continue development

- Changes to scripts, agents, rules or the gate: launch `SMA_MAINTAINER=1 claude` in the repo, or stage
  files and copy them in by hand. Agents can never approve or publish live, even in maintainer mode.
- Keep every rule change paired with a test in `tests/` and re-run `reports/trials/red-team/harness.mjs`
  after gate changes.
- Always run `npm test` before committing; CI (`.github/workflows/ci.yml`) runs tests on Node 20 and
  22, a gitleaks secret scan, and a check that private/working folders are not tracked. **That last
  check will now fail**, because this handover commit tracks `brand/ameya-heights/private/` and
  `reports/` on purpose; update or remove that step when you decide what stays public.
