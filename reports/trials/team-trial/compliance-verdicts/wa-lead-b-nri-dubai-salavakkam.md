# compliance-reviewer: wa-lead-b-nri-dubai-salavakkam

Checked against facts.md, voice.md, visuals.md, compliance.json (21 Oct 2026, both versions), private/faq.md never-say list.

**PASS** (round 1, rejected by linter) -> **PASS** (round 2) (TEST DATA)

1. Round 1 used faq.md answers verbatim ('We aren't taking bookings until approvals are in place', 'pricing will be shared once approvals are in place') plus 'We won't take any advance'. Reviewer passed them as faq-approved; the linter blocked 'approvals are in place' (approval-claim rule) and the Salavakkam/advance combo. Both are false positives against refusal sentences.
2. Round 2 uses the leads.md prescribed line ('DTCP approval and RERA registration are to follow, and we aren't taking bookings until they're in place') and 'we don't accept any payment before then'.
3. 'Subject to applicable law', no tax/FEMA advice, payment notice included. NRI flagged in rationale. Video slots given in Dubai time and IST.
