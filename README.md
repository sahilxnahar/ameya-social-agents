# Social Media Agent

A [Claude Code](https://claude.com/claude-code) agent team that runs a brand's social media the safe
way: eight departments research, draft and queue. **Nothing posts, replies, messages or spends until
the owner approves it**, and that rule is enforced in code, not just in a prompt.

Built for and configured with [Ameya Heights](https://www.ameyaheights.com), a founder-led real-estate
developer in Bengaluru and Chennai. Swap the `brand/` folder to use it for any business.

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
                                                    Meta / WhatsApp API  or  outbox/ hand-off pack
```

| Department | Does |
|---|---|
| `search-visibility` | Google Business Profile updates and Q&A, search demand |
| `market-radar` | Locality news, competitor moves, policy, with sources |
| `content-engine` | Posts, captions, scripts, the weekly plan |
| `creative-studio` | Image and video briefs, site-photo shot lists |
| `publishing` | Schedules and queues items, dry-runs them for the owner |
| `reputation` | Review and comment replies, negative-mention triage |
| `leads` | WhatsApp and DM replies that lead to a site visit |
| `results` | Weekly numbers and what to change |

Slash commands: `/daily-run`, `/new-lead`, `/new-review`, `/construction-update`, `/negative-mention`,
`/weekly-plan`, `/weekly-report`, `/queue`.

## Why you can trust it with your accounts

Prompts can be ignored. These checks cannot:

1. **Approval gate hook** (`scripts/hooks/approval-gate.mjs`, wired in `.claude/settings.json`). Before
   every tool call it blocks: approving or rejecting, live publishing, editing anything in `queue/`,
   `config/`, `scripts/`, `.claude/` or the compliance rules, posting or messaging through any social
   MCP tool, and clicking or typing in a browser. Agents can only write to `drafts/`, `reports/`,
   brand notes and `logs/results.md`.
2. **Approval needs a human at a keyboard.** `npm run approve` refuses to run without an interactive
   terminal and makes you type the item id.
3. **Approvals are tamper-evident.** Approving records a SHA-256 of exactly what you saw (channel, kind,
   target, text, media, link, time, spend). The publisher re-checks it and refuses anything changed.
4. **Claims are linted.** `brand/<brand>/compliance.json` blocks banned claims before a draft can even
   enter the queue, and again at approval. For Ameya Heights that includes guaranteed returns, prices,
   RERA or DTCP claims the projects don't have, booking language for unregistered projects (RERA s.3),
   promised dates and banned spec claims.
5. **Spend is capped.** `monthly_spend_cap_inr` in `config/owner.json` is checked when queueing and
   approving.
6. **Private data stays private.** Drafts, queue items, outbox, reports and logs are git-ignored
   because they can hold customer names and numbers.

## Setup

Requires Node 20+ and Claude Code.

```bash
git clone https://github.com/sahilxnahar/Social-Media-Agent.git
cd Social-Media-Agent
cp config/owner.example.json config/owner.json   # set approver name and spend cap
npm test
claude
```

Then try `/weekly-plan` or `/new-lead whatsapp +91XXXXXXXXXX "Is FOUR·94 available for a clinic?"`.

Review and approve in **your own terminal**:

```bash
npm run queue -- list
npm run approve -- <id>
npm run reject -- <id> "reason"
npm run publish -- due            # dry run
npm run publish -- due --live     # send approved items whose time has come
npm run publish -- posted <id> <url>   # after posting a hand-off item by hand
```

## Channels

| Channel | How approved items go out | Credentials (`.env`, never committed) |
|---|---|---|
| Facebook Page | Meta Graph API | `META_PAGE_ID`, `META_PAGE_TOKEN` |
| Instagram (professional) | Meta Graph API, needs a public media URL | `IG_USER_ID`, `META_PAGE_TOKEN` |
| WhatsApp | WhatsApp Cloud API, inside the 24-hour customer window | `WA_PHONE_NUMBER_ID`, `WA_TOKEN` |
| Google Business Profile | Hand-off pack in `outbox/gbp/` | none yet |
| LinkedIn | Hand-off pack in `outbox/linkedin/` | none yet |
| YouTube | Hand-off pack in `outbox/youtube/` | none yet |

Any live channel without credentials falls back to a hand-off pack. Load credentials into your shell
before publishing, for example `set -a; source .env; set +a`.

## Use it for your brand

1. Copy `brand/ameya-heights/` to `brand/<your-brand>/` and rewrite `facts.md`, `voice.md`,
   `audiences.md`, `channels.md`, `visuals.md` and `compliance.json`.
2. Set `"brand": "<your-brand>"` in `config/owner.json`.
3. Add tests for your compliance rules in `tests/claims.test.mjs`.

## Developing the framework

The gate also blocks Claude from editing the framework. To work on scripts, agents or commands,
launch `SMA_MAINTAINER=1 claude`. Approving and live publishing stay blocked even then, and the gate
itself and the owner config can only be edited by hand.

## Limits

- The gate matches commands and tool names with patterns. It stops an agent following instructions,
  not a determined human with shell access.
- Google Business Profile, LinkedIn and YouTube need OAuth apps before they can publish live.
- WhatsApp free-form replies only work within 24 hours of the customer's last message; templates
  are not implemented.

## Credits

Inspired by the "AI Native Social Media Agent Team" concept by OneGTMLab. This is an independent
implementation.

## License

MIT
