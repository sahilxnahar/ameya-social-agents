# Owner decisions for the rebuild (21 Oct 2026, from chat)

1. Salavakkam: DTCP approval and RERA registration "to follow"; pricing on request; no booking language. (Chatbot's "approvals secured" and ₹2,000–2,100/sq ft are NOT to be used.)
2. "Built in the open" phrase: RETIRED. Keep the idea (dated progress, documents first, verify-us) but never use the phrase.
3. Palette: black, sand, brass per BRAND_CANON 13 Jul — Architect Black #100F0D, Sand #ECE7DF, Brass #C2A05B (deep brass #A07D34 for text), Ink #16140F, Stone #9A958C; Cormorant Garamond headlines, Inter body. Brass for marks/accents only.
4. Channels: all, moderate cadence — Instagram 4–5/wk, LinkedIn 3–4/wk, Facebook mirrors Instagram, YouTube 2/month, GBP weekly, WhatsApp replies to every lead.
5. Repo stays public (renamed sahilxnahar/ameya-social-agents, MIT). Internal knowledge goes in git-ignored brand/ameya-heights/private/ (add a nested .gitignore there).
6. Defaults kept from the Oct fact pass unless told otherwise: no "column-free"; completion "target February 2028" / "target Q1 2028"; FOUR·94 lease only.

## Rebuild to-do (maintainer mode)
- brand/ameya-heights: update voice.md (canon vocabulary + bans, no exclamation marks, taglines lockup rule, "enquiry", "channel partner", "joint development"), visuals.md (palette above), channels.md (cadence above, hashtags 5–8 IG), facts.md (Feb 2028, three upper floors, no "approvals secured"), audiences.md (+ HNIs/family offices, channel partners, landowners).
- brand/ameya-heights/private/: faq.md (FAQ bank + never-say list + objection replies), leads-playbook.md (CRM stages, SLAs, cal.com, 5-touch nurture), competitors.md, content-library.md (paths to ready copy/creatives), open-tasks.md.
- compliance.json: ban "built in the open", exclamation marks, luxury/iconic/world-class/stunning/unparalleled/opulent/majestic, "trust us", "transparent", "pillar-less", "approvals secured", "floors available", payment instructions; NRI → require "Subject to applicable law"; renders → warn "Artist's impression".
- Agents: leads (FAQ, SLAs, nurture, payment notice), reputation (review templates, "be among the first to review"), content-engine (series: Study, Ledger, Site Diary, Ask Ameya, Founder's Desk, Sunday Standard; content library), creative-studio (palette, kill list, real vs render vs stock assets), search-visibility (GBP rebuild, brand-search collisions, NAP), market-radar (competitor list, never named).
- README/package.json: rename to ameya-social-agents; Ameya-only wording.
- Tests for new compliance rules.
- Tell owner: a CRM credential rotation task (tracked offline); founder name spelling. (The website repo is out of scope for this project.)
