// Extract caption/post/reply texts from the (read-only) source folders into corpus.json.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = '/Users/sah/Downloads/Ameya Heights';
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'corpus.json');
const items = [];
const seen = new Set();
const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const add = (src, text, channel = 'instagram', kind = 'post') => {
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length < 15) return;
  const k = norm(text);
  if (seen.has(k)) return;
  seen.add(k);
  items.push({ id: `T${String(items.length + 1).padStart(3, '0')}`, src, channel, kind, text });
};
const read = (p) => readFileSync(join(SRC, p), 'utf8');

// 1. posts.json
const pj = JSON.parse(read('Ameya Marketing Manus/docs/posts.json'));
for (const p of pj.posts) add(`posts.json d${p.day}`, p.caption);

// 2. week1 new direction
for (const line of read('Ameya Marketing Manus/working/week1/week1_new_direction_v2.md').split('\n')) {
  const m = line.match(/^\*\*Caption:\*\*\s*(.+)/);
  if (m) add('week1_v2', m[1]);
}

// 3. Launch playbook weeks
for (const w of ['01', '02', '03', '04', '05', '06']) {
  const p = `Launch_Playbook/Week_${w}_Ready_To_Post/CAPTIONS_AND_SCHEDULE.md`;
  if (!existsSync(join(SRC, p))) continue;
  for (const line of read(p).split('\n')) {
    let m = line.match(/^\*\*Caption[^*]*:\*\*\s*(.+)/);
    if (m) { add(`playbook W${w}`, m[1]); continue; }
    for (const mm of line.matchAll(/Caption(?: ready)?[^"]{0,40}:\s*"([^"]+)"/g)) add(`playbook W${w}`, mm[1]);
  }
}

// 4. GBP posts pack
for (const line of read('Marketing_Collateral_System/28_GBP_Local_Kit/GBP_Posts_Pack.md').split('\n')) {
  const m = line.match(/^\d+\s+\*\*[^*]+\*\*\s+—\s+(.+)$/);
  if (m) add('GBP pack', m[1].replace(/\[[^\]]*\]\s*$/, ''), 'gbp', 'post');
}

// 5. Review reply templates
for (const line of read('Marketing_Collateral_System/28_GBP_Local_Kit/Review_Reply_Templates.md').split('\n')) {
  const m = line.match(/^\*\*([^*]+):\*\*\s*"(.+)"/);
  if (m) add(`review ${m[1]}`, m[2], 'gbp', 'review_reply');
}

// 6. SOCIAL_SYSTEM: bios, reel scripts, hooks, CTA library, comment templates
const ss = read('Marketing_Collateral_System/06_Social_Media/SOCIAL_SYSTEM.md').split('\n');
for (const line of ss) {
  let m;
  if ((m = line.match(/^- ([A-Z][\w/ ]+ ask|Skeptic\/troll|Competitor comparison|Complaint)[^:]*:\s*"(.+?)"/))) add(`social ${m[1]}`, m[2], 'instagram', 'reply');
  else if ((m = line.match(/^\*\*"([^"]+)"\*\*\s+—\s+(.+)/))) add(`social reel ${m[1]}`, m[2].replace(/^[^"]*"/, '').replace(/"[^"]*$/, ''));
  else if ((m = line.match(/^- "(.+)"\s*$/))) add('social hook', m[1]);
  else if ((m = line.match(/^(Tagline|About):\s*"(.+)"/))) add(`social LinkedIn ${m[1]}`, m[2], 'linkedin', 'post');
  else if ((m = line.match(/^\*\*(Instagram|X):\*\*\s*"(.+?)"/))) add(`social bio ${m[1]}`, m[2]);
  else if ((m = line.match(/\*\*YouTube:\*\*\s*"(.+?)"/))) add('social bio YouTube', m[1], 'youtube', 'post');
  else if (line.startsWith('Soft:') || line.startsWith('Hard')) for (const mm of line.matchAll(/"([^"]+)"/g)) add('social CTA', mm[1]);
  else if (line.startsWith('**"Documents, explained"')) for (const mm of line.matchAll(/"([^"]{20,})"/g)) add('social carousel', mm[1]);
}

// 7. Creative captions
for (let i = 1; i <= 30; i++) {
  const p = `Creative_Production/Creative-${String(i).padStart(2, '0')}/Social-Caption.md`;
  if (!existsSync(join(SRC, p))) continue;
  const t = read(p);
  const m = t.match(/\*\*Primary:\*\*\s*(.+)/);
  if (m) add(`Creative-${i}`, m[1]);
  const fc = t.match(/\*\*First comment, always:\*\*\s*"(.+?)"/);
  if (fc) add(`Creative first comment`, fc[1], 'instagram', 'reply');
}

writeFileSync(OUT, JSON.stringify(items, null, 1));
console.log(`extracted ${items.length} unique texts -> ${OUT}`);
const bySrc = {};
for (const it of items) { const s = it.src.split(' ')[0]; bySrc[s] = (bySrc[s] || 0) + 1; }
console.log(bySrc);
