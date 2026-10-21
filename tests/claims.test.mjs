import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRules, lint } from '../scripts/lib/claims.mjs';

const rules = loadRules('ameya-heights');
const post = (text, extra = {}) => ({ channel: 'instagram', kind: 'post', content: { text }, ...extra });
const errorsFor = (text, extra) => lint(post(text, extra), rules).errors;

test('a plain progress update passes', () => {
  const text = 'First-floor shuttering is up at FOUR·94. Foundation, basement and ground floor are done. Target completion is Q1 2028. Leasing enquiries: WhatsApp +91 99629 65000.';
  assert.deepEqual(errorsFor(text), []);
});

test('blocks guaranteed returns, yields and prices', () => {
  assert.ok(errorsFor('Assured rental income from day one').length);
  assert.ok(errorsFor('Expect 8% rental yield').length);
  assert.ok(errorsFor('Starting at ₹45 lakhs').length);
  assert.ok(errorsFor('Only 1.2 Cr for the ground floor').length);
});

test('blocks RERA and DTCP approval claims', () => {
  assert.ok(errorsFor('A RERA registered project in Bengaluru').length);
  assert.ok(errorsFor('RERA approval in progress').length);
  assert.ok(errorsFor('DTCP approved plots near Chennai').length);
});

test('Salavakkam may share progress but not invite booking', () => {
  assert.deepEqual(errorsFor('Salavakkam update: land-use NOC received. DTCP approval and RERA registration to follow.'), []);
  assert.ok(errorsFor('Book your plot at Salavakkam today').length);
  assert.ok(errorsFor('Salavakkam pre-launch EOI open').length);
  assert.ok(errorsFor('Salavakkam: RERA registration expected next month').length, 'approvals must say "to follow"');
});

test('FOUR·94 is for lease, not sale', () => {
  assert.ok(errorsFor('FOUR·94 office floors for sale').length);
  assert.deepEqual(errorsFor('FOUR·94 floors available for lease or build-to-suit.'), []);
});

test('Jodhpur is not offered', () => {
  assert.ok(errorsFor('Jodhpur villas now available, enquire').length);
});

test('dates must be targets', () => {
  assert.ok(errorsFor('Possession in March 2028').length);
  assert.deepEqual(errorsFor('Target completion Q1 2028, subject to approvals.'), []);
});

test('banned FOUR·94 specs and hype', () => {
  assert.ok(errorsFor('Column-free floor plates').length);
  assert.ok(errorsFor('Two lifts and fire NOC in place').length);
  assert.ok(errorsFor('Hurry, last few units, best investment in Bengaluru').length);
  assert.ok(errorsFor('Trusted by 500 happy families').length);
});

test('warnings flag puffery, NRI and renders without blocking', () => {
  const { errors, warnings } = lint(post('A premium address for NRI families. Render shown.'), rules);
  assert.deepEqual(errors, []);
  assert.equal(warnings.length, 3);
});

test('enforces channel length limits', () => {
  const long = 'Built in the open. '.repeat(100);
  assert.ok(lint({ channel: 'gbp', kind: 'post', content: { text: long } }, rules).errors.some((e) => e.includes('limit')));
});
