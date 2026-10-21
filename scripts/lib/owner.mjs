// Owner levers: brand, budget cap and approver name. Machine-readable so scripts enforce them.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, list } from './queue.mjs';

export function loadOwner() {
  const path = join(ROOT, 'config', 'owner.json');
  const fallback = join(ROOT, 'config', 'owner.example.json');
  const file = existsSync(path) ? path : fallback;
  const owner = JSON.parse(readFileSync(file, 'utf8'));
  if (!owner.brand) throw new Error(`${file} must set "brand"`);
  if (!Number.isFinite(owner.monthly_spend_cap_inr)) throw new Error(`${file} must set monthly_spend_cap_inr`);
  return { ...owner, _file: file };
}

// Spend already approved or published in the given month (YYYY-MM).
export function committedSpend(month) {
  return ['approved', 'published']
    .flatMap((s) => list(s))
    .filter((i) => (i.approval?.at || '').startsWith(month))
    .reduce((sum, i) => sum + (i.spend_inr || 0), 0);
}
