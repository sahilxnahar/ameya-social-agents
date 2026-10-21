# Ameya Heights strategy, FAQ and lead-handling digest (research, 21 Oct 2026)

Private: git-ignored. Source root: ~/Downloads/Ameya Heights/. Key sources: Ameya-Decisions-and-Context.md (DEC, 21 Jul), Ameya-Audit-Resolution-Ledger.md (LEDGER, 21 Jul), Executive Action Plan (EXEC, 13 Aug), Reconciled Action Plan (RECON, 13 Aug, newest of these), Competitive & SEO Deep-Dive (SEO, 13 Aug), Competitive-Analysis.pdf (COMP, 16 Jul), Chatbot Testing (20 Jul), Ask-Ameya-QA (17 Jul), CRM/ameyacrm-v16.17.

## Owner decisions / open questions
- DEC: chatbot may quote Salavakkam ₹2,000–2,100/sq ft with caveat; FOUR·94 rates fully blocked; no RERA numbers or testimonials anywhere; focus organic visibility/authority; working mode "build it, I'll deploy".
- RECON (13 Aug): "built in the open" tagline RETIRED in the July repositioning. CONFLICT: Oct PRODUCT.md (website repo) still uses "built in the open". OWNER DECISION.
- LEDGER: completion unified to "target February 2028"; FOUR·94 has three upper floors.
- Waiting on owner (RECON P0): publish K-RERA application number and DTCP/CMDA refs?; freeze/reframe Salavakkam price (RERA s.3 risk); named Grievance Officer; Hindi/Arabic toggle.
- Agents' default until ruled: pricing on request everywhere, including Salavakkam.

## FAQ bank (what the live bot says, 20 Jul) — reconcile with facts.md before use
- FOUR·94: B+G+3, ~15,000 sq ft built-up (fact sheet bans total built-up), GF 1,808, upper ~2,135, PT "column-free" (fact sheet bans), parking, whole standalone building, leased directly to tenants.
- Salavakkam: ~3 acres, 68 plots, bot says "approvals secured" (CONFLICT: fact sheet says DTCP + RERA to follow), gated, Vastu-aligned; no clubhouse/pool/school.
- Jodhpur: upcoming, indicative only.
- NRIs can buy under FEMA via NRE/NRO, remotely or by PoA (add "Subject to applicable law"; no advice).
- Reply promise: "within a couple of hours"; hours: enquiries 7 days, calls Mon–Sat (EXEC C9 suggestion).
- Lead prompts: site visit, callback, brochure, founder contact, channel partner, landowner joint development, co-investment.
- Never say: totals/payment schedules; FOUR·94 rate/rent; RERA numbers; returns/yield/"doubling"; Salavakkam possession date; bank approvals; architect; revenue; headcount; testimonials; buyer list; projects in Mumbai/Dubai/Hyderabad (none); competitor praise/criticism; financial/legal advice; payment instructions; "floors available"/scarcity.
- Bot lines NOT to reuse: "We don't pursue awards"; "relationship with several leading financial institutions"; "generally meet eligibility of major lenders"; "founder leads design".
- Standing notice to add: "We never change payment instructions by email or chat."
- FOUR·94 sale language exists in EXEC C2/C23, Roadmap-1, Brand_Kit plan — treat FOUR·94 as lease-only.

## Lead handling (INTERNAL)
- Today: website form → Vercel → Apps Script → Google Sheet (owner email + hi@ ack). RECON P0-4: Sheet is a DPDP risk; migrate leads to CRM.
- WhatsApp: human click-to-chat on +91 99629 65000; CRM WhatsApp webhook disabled (503) by owner choice. Planned CRO-05 5-touch nurture (brochure → progress proof → corridor data → visit invite → check-in), consent/DND compliant.
- CRM stages: NEW → CONTACTED → QUALIFIED → SITE_VISIT → NEGOTIATION → BOOKED → WON/LOST; temp HOT/WARM/COLD; sources WEBSITE, REFERRAL, WALK_IN, CAMPAIGN, PORTAL, NRI_DESK, BROKER, OTHER; consent MARKETING, WHATSAPP, CALLS, DATA_PROCESSING.
- CRM ingest endpoints incl. /api/ingest/social-email (parses platform notification emails into lead/DM/comment/mention/review) — a future intake for the agents.
- SLAs (starter-automations.ts): new lead call task ≤1 day; website/portal lead same-day URGENT; ≥₹1 Cr budget → senior call within the hour; NRI → dept heads; broker → same-day ack; site visit → prep task day before.
- Site visits via cal.com (CRO-01: primary CTA).

## Competitors (INTERNAL — never name in posts)
- Chennai plots: G Square, HiLiving (closest peer), Royal Land, VGN, Casagrand, Radiance, TVS Emerald, Alliance.
- Bengaluru: Sobha, Prestige, Brigade, Godrej, Puravankara, Emaar; bangaloreoffice.com wins micro-market search via GBP + local content. DEC benchmark: DLF, Godrej, Lodha, Oberoi.
- Name collisions: Ameya Heights Kalyan East, Ameya Eastern Heights, KG Ameya, Ameya Group.
- Positioning: approvals before you pay; named accountable founder; dated unedited progress photos; no fake renders/proof; win micro-market keywords (Basaveshwara Nagar commercial, Salavakkam plots, NRI), not aggregator terms.

## Accounts and reputation
- Handles: instagram/facebook/x .com/ameyaheights; linkedin company/ameyaheights (= /company/132874001); founder linkedin.com/in/sahilxnahar; YouTube @ameyaheights. No follower data found.
- GBP: current profile "Four94 by Ameya", miscategorised as construction company; four different Google links split reviews; plan to rebuild under LLP legal name at Sowcarpet address.
- Reviews: effectively none. Don't link an empty reviews panel; use "Be among the first to review us after your visit". No AggregateRating until real reviews.
- Portals: none contacted; listing pack ready (Real Estate Portal Listing Documents/).

## Open tasks a social team can own
1. Monthly dated, unedited FOUR·94 progress photos (/four94/progress page has none yet) — core pillar.
2. GBP rebuild/consolidation (owner), then weekly posts + post-visit review loop.
3. Founder LinkedIn 2–3/week + Journal reshares.
4. Journal 2/month, repurposed to carousels/reels.
5. Video: FOUR·94 walkaround, founder intro, WebGL walkthrough screen-record (no Salavakkam drone until real footage).
6. Brand search: own page one for "Ameya Heights" vs name collisions; consistent NAP on Justdial, Sulekha, Bing Places, IndiaMART.
7. Close the loop: post → landing page → lead; lead magnets (occupier leasing pack, NRI guide, corridor report); LinkedIn occupier outreach for FOUR·94 (MKT-07).
8. Measurement before paid: GA4 conversions (CRO-02).

## Approvals on file (names/dates only)
- FOUR·94: Official Building Licence and Sanctioned Building Plan, 04-04-2026; fee receipts Mar–Apr 2026; property documents (E-katha, sale deed, etc.). No RERA certificate anywhere.
- Salavakkam: Collector NOC COLKPM/3742/2025/4.

## Owner to-dos
- A credential rotation task for the CRM is tracked offline (details deliberately kept out of this repo).
- Founder name variants: "Sahil Nahar" vs "Sanghvi/Sangvi Sahil Nahar" — pick one.
