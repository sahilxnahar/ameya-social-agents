---
description: Show what is waiting for the owner's approval, with warnings, in plain language.
---

1. Run `npm run queue -- list` and, for each item, `npm run queue -- show <id>` and
   `npm run publish -- <id>` (dry run).
2. Present each item: id, channel and kind, when it would go out, the full text, any lint warnings,
   any spend, and how it would be sent (live API or handoff to outbox).
3. End with the commands the owner runs in their own terminal:
   - `npm run approve -- <id>`
   - `npm run reject -- <id> <reason>`
   - `npm run publish -- due --live` to send approved items whose time has come

You cannot approve, reject or publish live. Do not try.
