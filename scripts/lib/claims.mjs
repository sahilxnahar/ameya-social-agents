// Claims linter: checks draft text against the brand's compliance rules.
// Errors block an item from entering the queue; warnings are shown to the approver.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './queue.mjs';

export function loadRules(brand) {
  const path = join(ROOT, 'brand', brand, 'compliance.json');
  if (!existsSync(path)) throw new Error(`missing compliance rules: brand/${brand}/compliance.json`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

const rx = (pattern) => new RegExp(pattern, 'i');

export function lint(item, rules) {
  const text = [item.content?.text, item.content?.link].filter(Boolean).join('\n');
  const errors = [];
  const warnings = [];

  for (const rule of rules.banned || []) {
    const m = text.match(rx(rule.pattern));
    if (m) errors.push(`banned phrase "${m[0]}": ${rule.why}`);
  }

  for (const rule of rules.conditional || []) {
    if (rx(rule.if).test(text) && !rx(rule.then_require).test(text)) errors.push(rule.message);
  }

  // A combo fires when every pattern appears somewhere in the text, e.g. a project name plus "book now".
  for (const rule of rules.combos || []) {
    if (rule.all.every((p) => rx(p).test(text))) errors.push(rule.message);
  }

  for (const rule of rules.promo_footer || []) {
    const kinds = rule.applies_to_kinds || [];
    const channels = rule.applies_to_channels || [];
    const applies = kinds.includes(item.kind) && (channels.length === 0 || channels.includes(item.channel));
    if (applies && !rx(rule.require).test(text)) errors.push(rule.message);
  }

  for (const rule of rules.warn || []) {
    const m = text.match(rx(rule.pattern));
    if (m) warnings.push(`"${m[0]}": ${rule.why}`);
  }

  const limit = rules.max_length?.[item.channel];
  if (limit && text.length > limit) errors.push(`${item.channel} text is ${text.length} chars, limit ${limit}`);

  return { errors, warnings };
}
