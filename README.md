# Ameya Social Agents

The [Claude Code](https://claude.com/claude-code) agent team that runs social media for
[Ameya Heights](https://www.ameyaheights.com), a founder-led real-estate developer in Bengaluru and
Chennai. Eight departments research, draft and queue. **Nothing posts, replies, messages or spends
until the owner approves it**, and that rule is enforced in code, not just in a prompt.

## How it works

```
 event ──▶ orchestrator ──▶ department agent ──▶ draft JSON ──▶ npm run queue -- add
 (/new-lead,   (CLAUDE.md)     (.claude/agents)      (drafts/)        │  validate + claims lint + budget
  /daily-run…)                                                          ▼
                                                                 queue/pending
                                                                        │  owner, in their own terminal:
                                                                        ▼  npm run approve -- <id>
                                                                 queue/approved  (content hash recorded)
                                                                        │  npm run publish -- due --live
                                                                        ▼  hash re-checked
                                       Meta / WhatsApp / YouTube API  or  outbox/ hand-off pack
```

| Department | Does |
|---|---|
| `search-visibility` | Google Business Profile, brand search, listings, micro-market demand |
| `market-radar` | Locality, infrastructure and policy signals, with sources |
| `content-engine` | Posts, captions, scripts, the weekly plan (Site Diary, Study, Ledger, Ask Ameya, Founder's Desk, Sunday Standard) |
| `creative-studio` | Image and video briefs, site-photo shot lists |
| `publishing` | Schedules and queues items, dry-runs them for the owner |
| `reputation` | Review and comment replies, negative-mention triage |
| `leads` | WhatsApp and DM replies that lead to a site visit |
| `results` | Weekly numbers and what to change |

Support agents: `compliance-reviewer` (checks every draft before it is queued), `nri-desk`,
`journal-writer`, `video-producer` and `brand-librarian` (keeps the fact sheet current).

Slash commands: `/daily-run`, `/inbox`, `/new-lead`, `/new-review`, `/construction-update`, `/negative-mention`,
`/weekly-plan`, `/weekly-report`, `/queue`.

## Why it is safe to point at real accounts

1. **Approval gate hook** (`scripts/hooks/approval-gate.mjs`, wired in `.claude/settings.json`) blocks
   approving, live publishing, editing the queue, config, scripts, hooks or compliance rules, posting
   through any social MCP tool, and clicking or typing in a browser.
2. **Approval needs a human at a keyboard.** `npm run approve` refuses to run without an interactive
   terminal and makes you type the item id.
3. **Approvals are tamper-evident.** A SHA-256 of exactly what was approved is re-checked before
   publishing.
4. **Claims are linted** against `brand/ameya-heights/compliance.json`: no prices, returns, RERA or
   approval claims, booking language for Salavakkam, promised dates, banned brand words, competitor
   names or payment instructions.
5. **Spend is capped** by `monthly_spend_cap_inr` in `config/owner.json`.
6. **Private data stays private.** Drafts, queue items, outbox, reports, logs and the internal
   knowledge in `brand/ameya-heights/private/` are git-ignored.

## Setup

Requires Node 20+ and Claude Code.

```bash
git clone https://github.com/sahilxnahar/ameya-social-agents.git
cd ameya-social-agents
cp config/owner.example.json config/owner.json   # approver name and spend cap
cp .env.example .env                              # fill in only the channels you use
npm install                                       # optional: adds @vercel/blob for image uploads
npm test
claude
```

The internal knowledge folder `brand/ameya-heights/private/` is not in the repo. Without it the agents
still work from the public brand files.

Review and approve in **your own terminal**:

```bash
npm run review                    # walk every pending item: approve, reject or skip
npm run queue -- list
npm run approve -- <id>
npm run reject -- <id> "reason"
npm run publish -- due            # dry run
npm run publish -- due --live     # send approved items whose time has come
npm run publish -- posted <id> <url>   # after posting a hand-off item by hand
```

## Daily use

1. `npm run inbox` picks up new CRM leads and Instagram and Facebook comments (read-only). Then run
   `/inbox` in Claude to route them to `leads` or `reputation` for draft replies.
2. `npm run review` in your own terminal to approve or reject what was drafted.
3. Install the scheduler once (`npm run schedule:install`) and approved items go out on time.

## Scheduler

`npm run schedule:install` adds a macOS launchd job that runs `npm run publish -- due --live` every
15 minutes. Only items you approved whose time has come can leave; the approval hash is re-checked
each time. Output goes to `logs/scheduler.log` (errors to `logs/scheduler.err`), and you get a macOS
notification when something is published, handed off or fails.

The repo lives in `~/Documents`, so macOS may block the job until you give `node` Full Disk Access
(or Documents access) in System Settings > Privacy & Security. If the log stays empty, check that.

Remove it with `npm run schedule:uninstall`.

## Leads into the CRM

A reply to a person can carry a `lead` block (name, phone or email, project, requirement,
temperature, NRI). It is part of what you approve, so changing it after approval blocks the send.
After the reply is sent, or after you record a hand-off with `publish -- posted`, the publisher creates
or updates the lead in the CRM with `CRM_WRITE_TOKEN`. The inbox only ever uses the read-only
`CRM_READ_TOKEN`. A CRM failure is logged in `logs/published.log` and never undoes the send.

## Images

Instagram and Facebook fetch media by public URL. Drafts may use local paths (`~/Downloads/...`);
at publish time they are uploaded to Vercel Blob and the URLs are used for the send only. The queue
item and its hash are not changed. Needs `BLOB_READ_WRITE_TOKEN` in `.env` and `npm install` (which
adds the optional `@vercel/blob`).

## YouTube

Create an OAuth client (Desktop app) in Google Cloud with the YouTube Data API enabled, put
`YT_CLIENT_ID` and `YT_CLIENT_SECRET` in `.env`, then run `npm run youtube-auth` and sign in. It
prints `YT_REFRESH_TOKEN` for you to add to `.env`. Drafts use `kind: "video"`, `content.title` (up to
100 characters), `content.text` as the description and a local video file in `content.media[0]`.
Until Google verifies the project, uploads from it are forced to private, so publish them by hand in
YouTube Studio.

## WhatsApp templates

Free-form WhatsApp replies only work within 24 hours of the customer's last message. Outside that
window, use a template approved in WhatsApp Manager: `content.template` = `{ "name", "language",
"params": [] }`, with the rendered message in `content.text` so you can see what you approve.

## Insights

`npm run insights` reads Instagram and Facebook numbers (read-only) and writes
`reports/data/insights-<date>.json`. The `results` department uses it for `/weekly-report`.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs `npm test` on every push and pull request. Tests use
temporary folders and fake network calls, so they need no credentials.

## Channels

| Channel | How approved items go out | Credentials (`.env`, never committed) |
|---|---|---|
| Facebook Page | Meta Graph API | `META_PAGE_ID`, `META_PAGE_TOKEN` |
| Instagram (professional) | Meta Graph API, local images uploaded to Vercel Blob | `IG_USER_ID`, `META_PAGE_TOKEN`, `BLOB_READ_WRITE_TOKEN` |
| WhatsApp | WhatsApp Cloud API; templates outside the 24-hour window | `WA_PHONE_NUMBER_ID`, `WA_TOKEN` |
| YouTube | YouTube Data API resumable upload | `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN` |
| Google Business Profile | Hand-off pack in `outbox/gbp/` | none yet |
| LinkedIn | Hand-off pack in `outbox/linkedin/` | none yet |

Any live channel without credentials falls back to a hand-off pack.

## Developing

The gate also blocks Claude from editing the framework. To work on scripts, agents or commands,
launch `SMA_MAINTAINER=1 claude`. Approving and live publishing stay blocked even then, and the gate
itself and the owner config can only be edited by hand.

## Limits

- The gate matches commands and tool names with patterns. It stops an agent following instructions,
  not a determined human with shell access.
- Google Business Profile and LinkedIn need API access that Google and LinkedIn grant only after
  review, so they stay hand-off for now.
- YouTube uploads stay private until Google verifies the OAuth project.
- WhatsApp free-form replies only work within 24 hours of the customer's last message; use a template
  after that.
- The scheduler is macOS only (launchd) and runs only while the Mac is awake.

## Credits and license

Inspired by the "AI Native Social Media Agent Team" concept by OneGTMLab; this is an independent
implementation. MIT licensed.
