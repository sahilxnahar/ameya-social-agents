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

// Every field that can reach the public or a customer is linted: the caption or body, the link,
// a YouTube title and WhatsApp template parameters. The lead block is not: it records the
// customer's own words for the CRM and is never published.
export function lintText(item) {
  const c = item.content || {};
  const params = Array.isArray(c.template?.params) ? c.template.params.map(String).join(' ') : null;
  return [c.title, c.text, c.link, params]
    .filter((v) => typeof v === 'string' && v.trim()).join('\n');
}

export function lint(item, rules) {
  const text = lintText(item);
  // The channel length limit applies to the published body only, as before.
  const body = [item.content?.text, item.content?.link].filter(Boolean).join('\n');
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
  if (limit && body.length > limit) errors.push(`${item.channel} text is ${body.length} chars, limit ${limit}`);

  return { errors, warnings };
}
