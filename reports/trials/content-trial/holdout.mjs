// Held-out check: fresh texts written AFTER the rules were designed (not used to tune them).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const R = '/private/tmp/claude-501/-Users-sah-Documents-GitHub-ameya-social-agents/682fd4a4-a567-4625-9995-c012d7ab4990/scratchpad/integration/repo';
const { lint } = await import(join(R, 'scripts/lib/claims.mjs'));
const here = dirname(fileURLToPath(import.meta.url));
const sets = { CURRENT: 'compliance.original.json', PROPOSED: 'compliance.proposed.json' };
const good = [
  'First-floor shuttering is up at FOUR·94. Foundation, basement and ground floor are done. Target completion Q1 2028.',
  'Salavakkam update: land-use NOC COLKPM/3742/2025 is in hand. DTCP approval and RERA registration to follow. Register interest to hear when approvals land.',
  'FOUR·94 has one lift, DG backup provision and basement parking for 8 cars.',
  'About 1.2 km to Rajajinagar metro and about 1.7 km to Mahalakshmi.',
  'Ask for the document pack. We share approval documents with your advocate on request.',
  'Thank you for visiting, Priya. We appreciate the careful questions about the title.',
  'Ground floor about 1,808 sq ft; upper floors about 2,135 sq ft each. Leasing enquiries welcome.',
  'NRIs can lease a FOUR·94 floor without flying in. Subject to applicable law.',
  "Artist's impression: FOUR·94 at dusk.",
  'Don’t trust us. Verify us: book a site visit at FOUR·94.',
  'We never change payment instructions by email or chat.',
  'Basement + ground + 3 upper floors, on a corner plot with two road frontages.',
];
const bad = [
  'No pillars on any FOUR·94 floor.',
  'Open-plan floors with zero columns. #columnfree',
  'Five floors of office space at FOUR·94.',
  'Ready by December 2027, target.',
  'Target completion Q4 2027.',
  'RERA application pending for Salavakkam.',
  'Status: applied with TN RERA.',
  'Our approvals are public on our website.',
  'Plots near Chennai will appreciate fast.',
  'A rare chance to lease a corner.',
  'Just a five-minute walk from the metro.',
  'Call our MD directly.',
  'Built in public, every week.',
  'Average reply time: 9 minutes.',
  'Reserve your Salavakkam plot now.',
  'Hurry, limited period offer',
];
for (const [name, f] of Object.entries(sets)) {
  const rules = JSON.parse(readFileSync(join(here, f), 'utf8'));
  const run = (t) => lint({ channel: 'instagram', kind: 'post', content: { text: t } }, rules).errors;
  const fp = good.filter((t) => run(t).length).map((t) => `${t} => ${run(t)[0].slice(0, 60)}`);
  const fn = bad.filter((t) => !run(t).length);
  console.log(`\n== ${name}: good ${good.length} (FP ${fp.length}), bad ${bad.length} (caught ${bad.length - fn.length}, FN ${fn.length})`);
  fp.forEach((x) => console.log('  FP: ' + x)); fn.forEach((x) => console.log('  FN: ' + x));
}
