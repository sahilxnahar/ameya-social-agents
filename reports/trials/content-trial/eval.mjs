// Confusion table for the current rules vs proposed rules; writes proposed compliance.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BAD } from './labels.mjs';
const R = '/private/tmp/claude-501/-Users-sah-Documents-GitHub-ameya-social-agents/682fd4a4-a567-4625-9995-c012d7ab4990/scratchpad/integration/repo';
const { lint } = await import(join(R, 'scripts/lib/claims.mjs'));
const here = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(readFileSync(join(here, 'corpus.json'), 'utf8'));
const current = JSON.parse(readFileSync(join(here, 'compliance.original.json'), 'utf8'));

// ---- proposed rules: a modified copy of the current rules ----
const p = structuredClone(current);
const byWhy = (w) => p.banned.find((r) => r.why.startsWith(w));
byWhy('banned FOUR·94 spec').pattern = "column[- ]?free|pillar[- ]?(less|free)|\\bA[- ]grade\\b|fire\\s+NOC|\\b(two|2|second|twin)\\s+lifts?\\b";
byWhy('the only approved wording').pattern = "RERA[^.\\n]{0,30}(in progress|applied|pending|soon|not yet granted)|(in progress|applied|pending)[^.\\n]{0,30}RERA|\\bK-?RERA\\s+portal\\b|\\bregistration\\s+(in progress|pending|applied)\\b";
byWhy('the phrase was retired').pattern = "built\\s+in\\s+the\\s+open|#builtintheopen|\\bin\\s+the\\s+open\\b|\\bbuil(t|d|ding)[- ]in[- ]public\\b";
byWhy('no hype').pattern = "\\b(best|safest|smartest)\\s+investment\\b|\\bonce[- ]in[- ]a[- ]lifetime\\b|\\bhurry\\b|\\blast few\\b|\\blimited[- ]period\\b|\\blast\\s+call\\b";
byWhy('the brand says').pattern = "(?<!\\b(don[’']?t|do not|never)\\s)\\btrust us\\b|\\btransparent\\b";
const added = [
  { pattern: "\\b(no|zero|without)\\s+(single\\s+)?(columns?|pillars?)\\b|\\bcolumns?\\b[^.\\n]{0,30}\\b(never|missing)\\b|\\bmissing\\W+columns\\b|\\bcolumn\\s+grid\\b|\\b(gaps\\s+between|includes\\s+the)\\s+pillars\\b|\\bnothing\\s+in\\s+the\\s+way\\b|\\busable\\s+carpet\\b|\\bnear[- ]100\\s?%", why: "column-free paraphrase: FOUR·94 may not be described as column- or pillar-free in any wording" },
  { pattern: "\\b(five|5|six|6)\\s+(levels?|floors|storeys?|stories)\\b|\\bG\\s?\\+\\s?4\\b|\\btotal\\s+(built[- ]up\\s+)?area\\b|\\bbuilt[- ]up\\s+area\\b|\\b\\d{1,3},?\\d{3}\\s?(sq\\.?\\s?ft|square\\s+feet)\\s+building\\b|\\b\\d+\\s+(bikes|two[- ]wheelers)\\b", why: "FOUR·94 is basement + ground + 3 floors; no total built-up area or unlisted parking figures" },
  { pattern: "\\b(no|any|a\\s+single|take)\\s+(bookings?|deposits?)\\b|\\bregistration\\s+number\\b", why: "implies a pending RERA registration and a sale; FOUR·94 is lease-only and the only approved RERA wording is Salavakkam's \"to follow\"" },
  { pattern: "\\b(papers?|documents?|drawings?|approvals?|pack)\\b[^.\\n]{0,40}\\b(are|is|stay|go|goes)\\s+public\\b|\\bpublic\\s+(document\\s+)?pack\\b|\\bpapers\\s+public\\b|\\bpublish(ed)?\\s+(ours|our\\s+(documents?|papers?|approvals?|title))\\b|\\bpublished\\s+documents?\\b|\\b(share|post)\\s+(all\\s+of\\s+)?(them|it|ours)\\s+publicly\\b", why: "approval documents are shared with a prospect's advocate on request, never posted publicly" },
  { pattern: "\\brar(e|est)\\b|\\bvery\\s+few\\s+(spaces|floors|units|plots|offices)\\b", why: "no scarcity or rarity claims" },
  { pattern: "\\b(land|property|plots?|values?|prices?)\\s+(appreciates?|rises?|grows?)\\b|\\b(will|to|set to|likely to)\\s+appreciate\\b|\\bappreciation\\b|\\bcapital\\s+gains?\\b", why: "no appreciation or return claims" },
  { pattern: "\\b(\\d+|twelve|forty[- ]four)[- ]?(metres?|meters?|m|foot|feet|ft)\\b[^.\\n]{0,20}\\broads?\\b|\\broads?\\b[^.\\n]{0,30}\\b\\d+\\s?(feet|ft|metres?|m)\\s+wide\\b|\\b\\w+[- ]minutes?\\s+(drive|walk)\\b", why: "road widths and travel times are not on the fact sheet; say \"two road frontages\" and the metro distances" },
  { pattern: "\\bmanaging\\s+director\\b|\\bMD\\b|\\bsanghvi\\b", why: "the founder is \"Sahil Nahar, Founder\" (formal: Founder & Designated Partner)" },
  { pattern: "\\b(reply|replies|response)\\b[^.\\n]{0,40}\\bminutes\\b", why: "the fact is \"enquiries are answered within a couple of hours\"; no unlisted reply-time metrics" },
  { pattern: "\\[[^\\]\\n]{1,40}\\]", why: "unfilled template placeholder" },
];
p.banned.push(...added);
const rendersRule = p.conditional.find((c) => c.message.startsWith('renders'));
rendersRule.if = "(?<!\\bshow\\s(a|our)\\s)\\b(renders?|rendering|3d view|visuali[sz]ation)\\b";
p.conditional.push({ if: "\\b(possession|handover|completion|ready by|complete by|completed by)\\b", then_require: "\\b(q1\\s+2028|february\\s+2028|feb\\s+2028)\\b", message: "the only completion date is \"target completion Q1 2028\" (website: target February 2028)" });
p.warn.push({ pattern: "post[- ]tensioned|\\bPT\\s+beams?\\b|\\blouv(re|er)s?\\b|\\bfa[cç]ade\\b", why: "structural and facade specs are not on the fact sheet" });
p._note = current._note + " Oct 2026 effectiveness pass: added column-free paraphrases, RERA/booking, public-documents, scarcity, appreciation, unlisted-fact, title, placeholder and completion-date rules.";

// ---- evaluation ----
const evaluate = (rules, label) => {
  const c = { TP: 0, FP: 0, FN: 0, TN: 0 }; const fp = []; const fn = [];
  for (const it of corpus) {
    let text = it.text;
    if (it.kind !== 'post') text = text.replace(/\[[^\]]+\]/g, 'Asha'); // templates: placeholders treated as filled
    const res = lint({ channel: it.channel, kind: it.kind, target: it.kind === 'post' ? null : 'https://example.invalid/x', content: { text } }, rules);
    const blocked = res.errors.length > 0; const bad = it.id in BAD;
    const k = blocked ? (bad ? 'TP' : 'FP') : (bad ? 'FN' : 'TN'); c[k]++;
    if (k === 'FP') fp.push(`${it.id}: ${text.slice(0, 90)} => ${res.errors[0].slice(0, 70)}`);
    if (k === 'FN') fn.push(`${it.id}: [${BAD[it.id]}] ${text.slice(0, 80)}`);
  }
  const prec = (c.TP / (c.TP + c.FP)).toFixed(2), rec = (c.TP / (c.TP + c.FN)).toFixed(2);
  console.log(`\n== ${label}: n=${corpus.length} TP=${c.TP} FP=${c.FP} FN=${c.FN} TN=${c.TN} precision=${prec} recall=${rec}`);
  if (fp.length) console.log('FP:\n  ' + fp.join('\n  '));
  if (fn.length) console.log('FN:\n  ' + fn.join('\n  '));
};
evaluate(current, 'CURRENT rules');
evaluate(p, 'PROPOSED rules');
writeFileSync(join(here, 'compliance.proposed.json'), JSON.stringify(p, null, 2) + '\n');
console.log('\nwrote compliance.proposed.json');
