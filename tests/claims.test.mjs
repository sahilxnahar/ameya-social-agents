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

test('blocks guaranteed returns, yields, ROI and prices', () => {
  assert.ok(errorsFor('Assured rental income from day one').length);
  assert.ok(errorsFor('Expect 8% rental yield').length);
  assert.ok(errorsFor('Strong ROI in West Bengaluru').length);
  assert.ok(errorsFor('Starting at ₹45 lakhs').length);
  assert.ok(errorsFor('Only 1.2 Cr for the ground floor').length);
});

test('blocks RERA, DTCP and approval claims', () => {
  assert.ok(errorsFor('A RERA registered project in Bengaluru').length);
  assert.ok(errorsFor('RERA approval in progress').length);
  assert.ok(errorsFor('DTCP approved plots near Chennai').length);
  assert.ok(errorsFor('All approvals secured.').length);
});

test('Salavakkam may share progress but not invite booking', () => {
  assert.deepEqual(errorsFor('Salavakkam update: land-use NOC received. DTCP approval and RERA registration to follow.'), []);
  assert.ok(errorsFor('Book your plot at Salavakkam today').length);
  assert.ok(errorsFor('Salavakkam pre-launch EOI open').length);
  assert.ok(errorsFor('Salavakkam: RERA registration expected next month').length, 'approvals must say "to follow"');
});

test('FOUR·94 is for lease, not sale, and has no scarcity', () => {
  assert.ok(errorsFor('FOUR·94 office floors for sale').length);
  assert.ok(errorsFor('Only 2 floors left at FOUR·94').length);
  assert.ok(errorsFor('Floors available now').length);
  assert.deepEqual(errorsFor('FOUR·94 floors offered for lease or build-to-suit.'), []);
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
  assert.ok(errorsFor('Pillar-less floors').length);
  assert.ok(errorsFor('Two lifts and fire NOC in place').length);
  assert.ok(errorsFor('Hurry, last few units, best investment in Bengaluru').length);
  assert.ok(errorsFor('Trusted by 500 happy families').length);
  assert.ok(errorsFor('Our completed projects speak for themselves').length);
});

test('Brand Canon voice rules', () => {
  assert.ok(errorsFor('Built in the open, floor by floor.').length, 'retired phrase');
  assert.ok(errorsFor('First floor done.').length === 0);
  assert.ok(errorsFor('First floor done!').length, 'no exclamation marks');
  assert.ok(errorsFor('A luxury address').length);
  assert.ok(errorsFor('An iconic corner').length);
  assert.ok(errorsFor('Trust us on this').length);
  assert.ok(errorsFor('A transparent process').length);
  assert.ok(errorsFor('New slab 🔥').length);
});

test('never name other developers', () => {
  assert.ok(errorsFor('Better than Prestige').length);
  assert.ok(errorsFor('Like a Godrej office').length);
});

test('never share payment instructions', () => {
  assert.ok(errorsFor('Pay via UPI to confirm').length);
  assert.ok(errorsFor('Transfer the advance into our account').length);
  assert.deepEqual(errorsFor('We never change payment instructions by email or chat.'), []);
});

test('NRI content needs "Subject to applicable law"', () => {
  assert.ok(errorsFor('NRIs can lease FOUR·94 floors remotely.').length);
  assert.deepEqual(errorsFor('NRIs can lease FOUR·94 floors remotely. Subject to applicable law.'), []);
});

test('renders need "Artist\'s impression"', () => {
  assert.ok(errorsFor('The new façade render.').length);
  assert.deepEqual(errorsFor("Artist's impression: the new façade render."), []);
});

test('warnings flag puffery and house style without blocking', () => {
  const { errors, warnings } = lint(post('A premium address near the metro. Send your inquiry.'), rules);
  assert.deepEqual(errors, []);
  assert.equal(warnings.length, 3);
});

test('enforces channel length limits', () => {
  const long = 'Dated progress, every month. '.repeat(60);
  assert.ok(lint({ channel: 'gbp', kind: 'post', content: { text: long } }, rules).errors.some((e) => e.includes('limit')));
});

// Added by the Oct 2026 effectiveness pass (118 real captions + held-out set).
test('column-free in any wording is blocked', () => {
  for (const t of ['No columns anywhere on any floor.', 'Zero columns on every floor.', '#FOUR94 #ColumnFree',
    'so no column ever interrupts your floor', "Notice what's missing — columns.", 'Your rent includes the pillars.',
    'Retail with nothing in the way.', 'near-100% usable carpet area']) assert.ok(errorsFor(t).length, t);
});

test('FOUR·94 shape: no five levels or total built-up area', () => {
  assert.ok(errorsFor('All five levels above the basement.').length);
  assert.ok(errorsFor('A 15,000 sq ft building.').length);
  assert.deepEqual(errorsFor('Basement + ground + 3 upper floors, on a corner plot with two road frontages.'), []);
});

test('the only completion date is Q1 2028', () => {
  assert.ok(errorsFor('Expected completion 2027.').length);
  assert.ok(errorsFor('Target completion Q4 2027.').length);
});

test('RERA status: no "in progress" in any order, no bookings promise', () => {
  assert.ok(errorsFor('Honest answer: in progress with Karnataka RERA, not yet granted.').length);
  assert.ok(errorsFor('Verify status anytime on the K-RERA portal.').length);
  assert.ok(errorsFor('Until the registration number is granted, we take no bookings and no deposits.').length);
  assert.deepEqual(errorsFor('Book a site visit at FOUR·94.'), []);
});

test('documents are shared on request, never "public"', () => {
  for (const t of ['The pack is public.', 'Our document pack is public before any sales conversation.',
    'The exact drawing is in the public pack.', 'We publish ours before you sign.', 'Papers public, progress dated.'])
    assert.ok(errorsFor(t).length, t);
  assert.deepEqual(errorsFor('Ask for the document pack. We share approval documents with your advocate on request.'), []);
});

test('retired phrase variants, pressure and scarcity', () => {
  for (const t of ['Construction in the open.', 'Built in public, every week.', 'Last call for the priority list.',
    'The rarest retail geometry.', 'We just have very few spaces.', 'Land appreciates.']) assert.ok(errorsFor(t).length, t);
  assert.deepEqual(errorsFor('Thank you for visiting, Priya. We appreciate the careful questions.'), []);
});

test('unlisted facts, titles and placeholders', () => {
  for (const t of ['Two 44-ft roads meet here.', 'A ten-minute drive from Rajajinagar Metro.', "That's the Managing Director's line.",
    'Average first reply [XX] minutes.', 'Average reply time: 9 minutes.']) assert.ok(errorsFor(t).length, t);
});

test('false positives fixed: "don\'t trust us — verify us" and render policy talk', () => {
  assert.deepEqual(errorsFor("We're a new developer. Don't trust us — verify us."), []);
  assert.ok(errorsFor('Trust us on this').length);
  assert.deepEqual(errorsFor("When we show a render, it's ours; when we show progress, it's dated."), []);
  assert.ok(errorsFor('The new façade render.').length);
});

test('approved FAQ answers pass', () => {
  for (const t of [
    // Kept in step with brand/ameya-heights/private/faq.md (Salavakkam, price and NRI answers).
    "DTCP approval and RERA registration are to follow, and we aren't taking bookings until they're in place.",
    'Salavakkam: DTCP approval and RERA registration are to follow, and we aren\'t taking bookings until they\'re in place. We\'d be glad to keep you posted.',
    "Correct. DTCP approval and RERA registration are to follow, and we aren't taking bookings until they're in place.",
    'A planned plotted development near Chennai in Kanchipuram district, about 2.9 acres. Land-use NOC received March 2026; DTCP approval and RERA registration to follow.',
    "Salavakkam: DTCP approval and RERA registration are to follow; we'll share pricing once they're in place.",
    "Terms depend on how you'll use the space. A ten-minute call lets us give you a real answer instead of a teaser.",
    "Yes. We can walk you through the site on video and share documents with your advocate. Subject to applicable law; we don't give tax or legal advice.",
    'NRIs are welcome. Subject to applicable law; we don\'t give tax or legal advice.',
    'Terms are shared once we understand your requirement. Could we call you, or would you like to see the site?',
    'Yes. We share approval documents with your advocate on request.',
  ]) assert.deepEqual(errorsFor(t), [], t);
});

// Added after the 21 Oct 2026 team trial.
test('refusals before a sale or booking word pass', () => {
  for (const t of [
    'FOUR·94 is offered for lease or build-to-suit. It is not for sale.',
    "FOUR·94 isn't for sale.",
    'FOUR·94 is offered for lease, not for sale.',
    "We aren't taking bookings until approvals are in place.",
    "Salavakkam: we aren't taking bookings until approvals are in place.",
    "Salavakkam: we won't take any advance.",
    "We won't take any advance or token.",
    'Salavakkam: no booking until approvals are in place.',
    'Jodhpur is in early planning and not for sale.',
  ]) assert.deepEqual(errorsFor(t), [], t);
});

test('a refusal does not excuse an invitation, a promise or a pending registration', () => {
  for (const t of [
    'Until the registration number is granted, we take no bookings and no deposits.',
    'No bookings until the registration number is issued.',
    'Buy a floor at FOUR·94.',
    'No need to wait, buy at FOUR·94 today.',
    "It's never been easier to book at Salavakkam.",
    "Don't wait, book your Salavakkam plot.",
    'We are taking bookings now.',
    'We accept tokens for the priority list.',
    'All approvals are in place.',
    'Our approvals are in place.',
  ]) assert.ok(errorsFor(t).length, t);
});

test('plural booking and price words are caught', () => {
  for (const t of ['Bookings open soon at Salavakkam.', 'Salavakkam bookings start Monday.', 'Salavakkam prices will rise after approval.',
    'Salavakkam prices on request.', 'Jodhpur bookings soon.', 'Jodhpur prices shared on request.', 'Bookings are now open.'])
    assert.ok(errorsFor(t).length, t);
});

test('return, scarcity, approval, date and social-proof misses are blocked', () => {
  for (const t of [
    'Investors earn returns of 12% a year.', 'A 12% annual yield.', 'Expect a 10% annual yield on your lease.', 'Yields of up to 9%.',
    '8% p.a. on your money.', 'Rent of 90 a square foot, all inclusive.',
    'Secure your plot at Salavakkam.', 'Reserve your floor at FOUR·94.', 'Be first in line.', 'Be the first to own a plot.',
    'Few plots remain.', 'Only a few floors left.', 'Floors are going fast.', 'Demand is high in Basaveshwara Nagar.',
    'Our layout is approved by DTCP.', 'Sanctioned by the DTCP.',
    'Handing over in March 2028.', 'Handing over keys in March 2028.', 'Ready to move in by 2027.', 'Ready-to-occupy floors.',
    'Many families have chosen Ameya Heights.', 'Hundreds of buyers trust this address.', 'Investors have already chosen us.',
  ]) assert.ok(errorsFor(t).length, t);
});

test('near-misses on the new rules still pass', () => {
  for (const t of [
    'Third-floor slab is 60% complete. Target completion Q1 2028.',
    'Book a site visit at FOUR·94.',
    'Reserve a time for your site visit on WhatsApp.',
    'A few questions we hear often.',
    'The site team is handing over to the night shift.',
    'Leasing enquiries: WhatsApp +91 99629 65000.',
  ]) assert.deepEqual(errorsFor(t), [], t);
});

test('Brigade Road is a street; Brigade the developer is still blocked', () => {
  assert.deepEqual(errorsFor('A short metro ride from Brigade Road.'), []);
  assert.deepEqual(errorsFor('Shops on Brigade Rd and Commercial Street.'), []);
  assert.ok(errorsFor('Better than Brigade.').length);
  assert.ok(errorsFor('A Brigade-style tech park.').length);
  assert.ok(errorsFor('Brigade Group launched nearby.').length);
});

test('title and template params are linted; the private lead block is not', () => {
  const yt = { channel: 'youtube', kind: 'video', content: { title: 'Assured 12% returns, last few plots', text: 'A walk around FOUR·94. Target completion Q1 2028.' } };
  assert.ok(lint(yt, rules).errors.length, 'youtube title');
  assert.deepEqual(lint({ ...yt, content: { ...yt.content, title: 'FOUR·94 walkaround, October 2026' } }, rules).errors, []);
  const dm = (extra) => ({ channel: 'whatsapp', kind: 'dm', target: '+919876543210', content: { text: 'Hello Asha, thank you for your enquiry.' }, ...extra });
  assert.ok(lint(dm({ content: { text: 'Hello', template: { name: 'x', language: 'en', params: ['Asha', 'assured returns'] } } }), rules).errors.length, 'template params');
  // A customer asking about returns must not block a compliant reply to them.
  assert.deepEqual(lint(dm({ lead: { name: 'Asha', phone: '+919876543210', requirement: 'Asked about 12% assured returns' } }), rules).errors, [], 'lead requirement is private');
  assert.deepEqual(lint(dm({ content: { text: 'Hello', template: { name: 'x', language: 'en', params: ['Asha'] } },
    lead: { name: 'Asha', phone: '+919876543210', requirement: 'Ground floor for a clinic, FOUR·94' } }), rules).errors, []);
  // the channel length limit still measures the published body, not the title
  assert.deepEqual(lint({ channel: 'gbp', kind: 'post', content: { title: 'x'.repeat(100), text: 'y'.repeat(1450) } }, rules).errors, []);
});
