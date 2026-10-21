---
description: Morning sweep. Check signals, draft today's planned items, and leave a short list for the owner to approve.
---

Run the daily sweep for the brand in `config/owner.json` (fall back to `config/owner.example.json`).

1. `npm run queue -- list` and `npm run queue -- list approved`. Note anything pending for more than
   two days and anything approved but not yet handed off or published.
2. Ask `market-radar` for anything new in the last 24 hours. Skip if nothing material.
3. Check `drafts/content-engine/plan-*.md` for today's items. For each one not yet drafted, ask
   `content-engine` to draft it, `creative-studio` for a brief if it needs visuals, and `publishing`
   to schedule and queue it.
4. If the owner pasted new reviews, comments or messages in $ARGUMENTS, route them to `reputation` or
   `leads`.
5. Finish with a summary of at most 10 lines: what was queued (ids), warnings, questions for the owner,
   and the approve command: `npm run approve -- <id>`.
