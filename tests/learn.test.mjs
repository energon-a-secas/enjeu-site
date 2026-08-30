// The Learn deck: the slide-count contract, the two handlers that move it, the
// deep-link slugs, and the markup of every slide. There is no DOM here, so what
// is checked is what renderLearn() returns as a string: that each slide draws
// something, that none of them smuggles in an inline onclick, and that the
// teaching visuals speak the card vocabulary (riskDots for a check, the printed
// BACK for a Broken card) rather than approximating it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { useCards, DECKS } from '../js/data/cards.js';
import { t } from '../js/strings.js';
import { STEPS, COPY } from '../js/data/walkthrough.js';
import {
  SLIDE_PLAY, SLIDE_DICE, SLIDE_RULEBOOK, SLIDE_COUNT, SLIDE_SLUGS, SLIDE_CHAPTERS, LAST_BASIC,
  clampSlide, slideForSlug, renderLearn, onLearnAction, onLearnKey,
} from '../js/views/learn.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = useCards(JSON.parse(readFileSync(join(root, 'data/cards.json'), 'utf8')));

// A state stand-in: the deck reads only these five fields.
const S = (over = {}) => ({ cards: data, element: 'fire', die: 'd20', learnStep: 0, param: null, ...over });
// The four ramp colours face.js prints on a card (RISK in js/cards/face.js).
const RAMP = ['#16a34a', '#eab308', '#f97316', '#dc2626'];

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}

test('the slide count is derived from STEPS: steps, the play-now invitation, dice bridge, rulebook last', () => {
  assert.equal(SLIDE_PLAY, STEPS.length, 'the invitation follows the lessons');
  assert.equal(SLIDE_DICE, STEPS.length + 1);
  assert.equal(SLIDE_RULEBOOK, STEPS.length + 2);
  assert.equal(SLIDE_COUNT, STEPS.length + 3);
  assert.equal(SLIDE_RULEBOOK, SLIDE_COUNT - 1, 'the rulebook is the last slide');
});

test('clampSlide holds both ends and treats junk as the first slide', () => {
  assert.equal(clampSlide(-1), 0);
  assert.equal(clampSlide(-999), 0);
  assert.equal(clampSlide(0), 0);
  assert.equal(clampSlide(SLIDE_COUNT), SLIDE_COUNT - 1);
  assert.equal(clampSlide(SLIDE_COUNT - 1), SLIDE_COUNT - 1);
  assert.equal(clampSlide('3'), 3, 'a data-step attribute arrives as a string');
  assert.equal(clampSlide('nope'), 0);
  assert.equal(clampSlide(undefined), 0);
});

test('one deep-link slug per slide, all unique, and an unknown slug resolves to nothing', () => {
  assert.equal(SLIDE_SLUGS.length, SLIDE_COUNT);
  assert.equal(new Set(SLIDE_SLUGS).size, SLIDE_COUNT);
  for (const [i, slug] of SLIDE_SLUGS.entries()) assert.equal(slideForSlug(slug), i, slug);
  assert.equal(slideForSlug('dice'), SLIDE_DICE);
  assert.equal(slideForSlug('rulebook'), SLIDE_RULEBOOK);
  assert.equal(slideForSlug('not-a-slide'), -1);
  assert.equal(slideForSlug(null), -1);
});

test('#/learn/<slug> opens that slide once, and the param is consumed so Next is not snapped back', () => {
  const s = S({ param: 'rulebook', learnStep: 0 });
  renderLearn(s);
  assert.equal(s.learnStep, SLIDE_RULEBOOK);
  assert.equal(s.param, null, 'a param left set would re-open the linked slide on every render');
  // An unknown slug leaves the saved slide alone.
  const other = S({ param: 'not-a-slide', learnStep: 2 });
  renderLearn(other);
  assert.equal(other.learnStep, 2);
  assert.equal(other.param, null);
});

test('learn-next / learn-prev walk one slide and refuse to move past either end', () => {
  const s = S({ learnStep: 0 });
  assert.equal(onLearnAction(s, 'prev'), false, 'no re-render at the first slide');
  assert.equal(s.learnStep, 0);
  assert.equal(onLearnAction(s, 'next'), true);
  assert.equal(s.learnStep, 1);
  s.learnStep = SLIDE_COUNT - 1;
  assert.equal(onLearnAction(s, 'next'), false, 'no re-render at the last slide');
  assert.equal(s.learnStep, SLIDE_COUNT - 1);
  assert.equal(onLearnAction(s, 'prev'), true);
  assert.equal(s.learnStep, SLIDE_COUNT - 2);
  assert.equal(onLearnAction(s, 'nonsense'), false);
});

test('learn-step jumps to any slide from the rail, clamped', () => {
  const s = S({ learnStep: 0 });
  assert.equal(onLearnAction(s, 'step', { dataset: { step: String(SLIDE_DICE) } }), true);
  assert.equal(s.learnStep, SLIDE_DICE);
  assert.equal(onLearnAction(s, 'step', { dataset: { step: '99' } }), true);
  assert.equal(s.learnStep, SLIDE_COUNT - 1);
  assert.equal(onLearnAction(s, 'step', { dataset: { step: '99' } }), false, 'the slide it is already on is not a re-render');
});

test('arrows, PageUp/PageDown, Home and End walk the deck', () => {
  const key = (k) => { let stopped = false; return { key: k, preventDefault() { stopped = true; }, get stopped() { return stopped; } }; };
  const s = S({ learnStep: 0 });
  const right = key('ArrowRight');
  assert.equal(onLearnKey(s, right), true);
  assert.equal(s.learnStep, 1);
  assert.equal(right.stopped, true, 'a claimed key must not also scroll the page');
  assert.equal(onLearnKey(s, key('ArrowLeft')), true);
  assert.equal(s.learnStep, 0);
  assert.equal(onLearnKey(s, key('PageDown')), true);
  assert.equal(s.learnStep, 1);
  assert.equal(onLearnKey(s, key('PageUp')), true);
  assert.equal(s.learnStep, 0);
  assert.equal(onLearnKey(s, key('End')), true);
  assert.equal(s.learnStep, SLIDE_COUNT - 1);
  s.learnStep = 3;
  assert.equal(onLearnKey(s, key('Home')), true);
  assert.equal(s.learnStep, 0);
  assert.equal(onLearnKey(s, key('a')), false, 'an unclaimed key is left to the page');
});

test('the guard: on the rulebook slide only the horizontal arrows move the deck', () => {
  // The rulebook scrolls inside its own slide, so PageDown, PageUp, Home and End
  // belong to the reader there. This is the assertion that trips that guard.
  const key = (k) => ({ key: k, preventDefault() { throw new Error(`${k} was claimed on the rulebook slide`); } });
  for (const k of ['PageDown', 'PageUp', 'Home', 'End']) {
    const s = S({ learnStep: SLIDE_RULEBOOK });
    assert.equal(onLearnKey(s, key(k)), false, k);
    assert.equal(s.learnStep, SLIDE_RULEBOOK, k);
  }
  const s = S({ learnStep: SLIDE_RULEBOOK });
  assert.equal(onLearnKey(s, { key: 'ArrowLeft', preventDefault() {} }), true, 'Left still leaves the rulebook');
  assert.equal(s.learnStep, SLIDE_RULEBOOK - 1);
});

test('every slide renders, carries the deck chrome, and holds no inline handler', () => {
  for (let i = 0; i < SLIDE_COUNT; i++) {
    const s = S({ learnStep: i });
    const html = renderLearn(s);
    assert.ok(html.length > 400, `slide ${i} rendered ${html.length} characters`);
    assert.equal(/onclick=|onchange=|onkeydown=/i.test(html), false, `slide ${i} carries an inline handler`);
    assert.ok(html.includes(`data-slide="${i}"`), `slide ${i} is not the one drawn`);
    assert.ok(html.includes('data-action="learn-prev"'), `slide ${i} has no Back`);
    assert.ok(html.includes('data-action="learn-next"'), `slide ${i} has no Next`);
    // The rail: one numbered jump per slide, and the current one marked.
    const dots = (html.match(/data-action="learn-step" data-step="/g) || []).length;
    assert.ok(dots >= SLIDE_COUNT, `slide ${i} rail has ${dots} of ${SLIDE_COUNT} entries`);
    assert.equal((html.match(/aria-current="true"/g) || []).length, 1, `slide ${i} marks one current rail entry`);
    assert.ok(html.includes(`${i + 1} of ${SLIDE_COUNT}`), `slide ${i} counter`);
  }
});

test('Back is dead on the first slide and Next on the last, so neither can walk off the deck', () => {
  const first = renderLearn(S({ learnStep: 0 }));
  assert.match(first, /data-action="learn-prev" disabled/);
  assert.equal(/data-action="learn-next" disabled/.test(first), false);
  const last = renderLearn(S({ learnStep: SLIDE_COUNT - 1 }));
  assert.match(last, /data-action="learn-next" disabled/);
  assert.equal(/data-action="learn-prev" disabled/.test(last), false);
});

test('every step cites a rulebook section, and the citation is a jump to the rulebook slide', () => {
  for (const st of STEPS) {
    assert.ok(/^[\d, ]+$/.test(st.rule), `${st.id}: "${st.rule}" is not a section list`);
    assert.ok(st.id && /^[a-z][a-z0-9-]*$/.test(st.id), `${st.id} is not usable as a deep-link slug`);
  }
  const html = renderLearn(S({ learnStep: 1 }));
  assert.match(html, new RegExp(`class="slide__rule" data-action="learn-step" data-step="${SLIDE_RULEBOOK}"`));
  assert.ok(html.includes(`Rule ${STEPS[1].rule}`));
});

test('every step draws its visual: a renamed visual key cannot fail quietly', () => {
  // The step names its drawing by key ('states', 'levels'), and the view looks
  // that key up. A typo used to render an empty box beside copy long enough that
  // the length check above still passed, so the emptiness is what is asserted.
  for (const [i, st] of STEPS.entries()) {
    if (st.cover) continue;
    const html = renderLearn(S({ learnStep: i }));
    assert.equal(html.includes('<div class="slide__visual"></div>'), false, `${st.id}: visual "${st.visual}" drew nothing`);
  }
});

test('the components slide counts every printed deck, and its cells add up to its caption', () => {
  // The first version listed the eight decks it remembered, left the Gentle mode
  // card out, and printed nine cells summing to 91 under a line saying 92. Two
  // numbers on one slide that disagree teach the reader to trust neither, so the
  // cells come from DECKS and this is what holds them to it.
  const html = renderLearn(S({ learnStep: SLIDE_SLUGS.indexOf('what-you-need') }));
  const cells = [...html.matchAll(/<div class="strip__cell"><b>(\d+)<\/b>/g)].map((m) => Number(m[1]));
  assert.equal(cells.length, DECKS.length, `${cells.length} deck counts for ${DECKS.length} printed decks`);
  assert.equal(cells.reduce((a, b) => a + b, 0), data.physical.length, 'the cells do not add up to the box');
  assert.ok(html.includes(`${data.physical.length} cards in all`), 'the caption states a different total');
  for (const d of DECKS) assert.ok(html.includes(`>${t(`cards.deck.${d}`)}<`), `no cell labelled ${d}`);
});

test('the badge on a slide, the rail entry and the counter all say the same number', () => {
  // The badge rendered the 0-based index while the counter and the rail were
  // 1-based, so slide seven was headed "6" beside a counter reading "7 of 12".
  // Three numbers on one slide, two of them agreeing, is worse than none.
  for (let i = 0; i < SLIDE_COUNT; i++) {
    const html = renderLearn(S({ learnStep: i }));
    const badge = html.match(/<span class="slide__n" aria-hidden="true">(\d+)<\/span>/);
    if (!badge) continue;                        // the cover, the dice bridge and the rulebook carry none
    assert.equal(badge[1], String(i + 1), `slide ${i} badge`);
    assert.ok(html.includes(`${i + 1} of ${SLIDE_COUNT}`), `slide ${i} counter`);
  }
});

test('two chapters, Basics first, and nothing interleaved', () => {
  // The rail draws one labelled group per run of equal chapters, so a basics step
  // filed after an advanced one would silently produce three groups and a reader
  // would be told the basics end twice.
  assert.equal(SLIDE_CHAPTERS.length, SLIDE_COUNT);
  for (const st of STEPS) assert.ok(st.chapter === 'basics' || st.chapter === 'advanced', `${st.id}: ${st.chapter}`);
  assert.equal(SLIDE_CHAPTERS.indexOf('advanced'), LAST_BASIC + 1, 'each chapter is one unbroken run');
  assert.ok(LAST_BASIC > 0, 'Basics is not empty');
  assert.ok(SLIDE_CHAPTERS.includes('advanced'), 'Advanced is not empty');
  // The invitation sits between the lessons and the reference: a fresh visitor
  // used to reach the end believing the site was a manual for a physical
  // product, so the deck now closes its teaching with "play it right now".
  assert.equal(SLIDE_CHAPTERS[SLIDE_PLAY], 'try');
  // The dice bridge and the rulebook are reference, and neither is needed to
  // finish a first fight.
  assert.equal(SLIDE_CHAPTERS[SLIDE_DICE], 'reference');
  assert.equal(SLIDE_CHAPTERS[SLIDE_RULEBOOK], 'reference');
  assert.equal(SLIDE_SLUGS[LAST_BASIC], 'what-you-need', 'Basics ends on what you need to own');
});

test('every slide names its chapter, and only the last basics slide says the basics are over', () => {
  for (let i = 0; i < SLIDE_COUNT; i++) {
    const html = renderLearn(S({ learnStep: i }));
    const label = COPY.chapter[SLIDE_CHAPTERS[i]];
    assert.ok(html.includes(`<b class="deck__chapter">${label}</b>`), `slide ${i} counter omits ${label}`);
    // Four groups, four labels, each chapter one unbroken run: the breaks are
    // drawn, not just stated.
    assert.equal((html.match(/class="rail__group"/g) || []).length, 4, `slide ${i} rail groups`);
    for (const ch of ['basics', 'advanced', 'try', 'reference']) {
      assert.ok(html.includes(`<span class="rail__label" aria-hidden="true">${COPY.chapter[ch]}</span>`), `slide ${i} ${ch} label`);
    }
    assert.equal(html.includes('slide__handoff'), i === LAST_BASIC, `slide ${i} handoff line`);
  }
});

test('the Damage Track slide draws all three snapshots, and each one marks what its sentence says', () => {
  const html = renderLearn(S({ learnStep: SLIDE_SLUGS.indexOf('keeping-count') }));
  const snaps = [...html.matchAll(/<svg class="track__snap"[\s\S]*?<\/svg>/g)].map((m) => m[0]);
  assert.equal(snaps.length, COPY.track.length, `${snaps.length} snapshots for ${COPY.track.length} steps`);
  COPY.track.forEach((st, i) => {
    assert.ok(html.includes(st.note), `step ${i}: the note is on the slide`);
    // The brick is a filled band, so the marked total is the one drawn in gold.
    const gold = [...snaps[i].matchAll(/<rect x="(\d+)"[^>]*fill="#eab308"/g)];
    assert.equal(gold.length, 1, `step ${i}: exactly one band carries the brick`);
    const bands = [...snaps[i].matchAll(/<text x="\d+"[^>]*>(\d+)<\/text>/g)].map((m) => m[1]);
    assert.deepEqual(bands, ['25', '50', '75', '100'].concat(st.hundreds ? [String(st.hundreds)] : []), `step ${i}: bands and the hundreds die`);
  });
});

test('Broken is the printed card BACK, not a mirrored face', () => {
  const html = renderLearn(S({ learnStep: SLIDE_SLUGS.indexOf('one-rule') }));
  assert.ok(html.includes('state--broken'), 'the states visual is on this slide');
  assert.ok(html.includes('aria-label="card back"'), 'Broken must render cardBack() from js/cards/face.js');
  assert.equal(/rotateY/.test(html), false, 'a mirrored face is not a card back');
});

test('a check is always the card\'s own traffic light, from riskDots', () => {
  for (const slide of [SLIDE_SLUGS.indexOf('the-check'), SLIDE_DICE]) {
    const html = renderLearn(S({ learnStep: slide }));
    assert.ok(html.includes('pips pips--risk'), `slide ${slide} draws its own dots instead of riskDots()`);
    for (const colour of RAMP) assert.ok(html.includes(`--risk:${colour}`), `slide ${slide} is missing ${colour}`);
  }
});

/**
 * The slide that says "your first fight is five cards" must draw five. It drew
 * three, from a hardcoded ['strike','focus','all-in'], while the copy beside it
 * had already been corrected: a caption disagreeing with its own picture is the
 * exact defect this deck's comments record twice before.
 */
test('the attack slide draws every card in the Attack deck, not a hardcoded list', () => {
  const html = renderLearn({ cards: data, learnStep: 2, view: 'learn' });
  for (const c of data.attack) {
    assert.ok(html.includes(`data-id="${c.id}"`) || html.includes(`>${c.name}<`),
      `${c.name} is in the Attack deck but not on the slide that teaches it`);
  }
  const shown = (html.match(/class="action-card"/g) || []).length;
  assert.equal(shown, data.attack.length, `the slide draws ${shown} cards for a deck of ${data.attack.length}`);
});

/**
 * The tactics slide is the answer to a question asked at a real table ("does the
 * order of my actions matter?"), and the answer is one rule: while you are
 * Hidden every attack you make is halved. A slide that keeps its title and loses
 * that sentence would still render, still draw a visual and still pass every
 * loop above, so the two named plays and the rule itself are asserted by name.
 *
 * The arithmetic is checked against data/cards.json rather than against the
 * literals in walkthrough.js: 25 a Strike, 100 for each card an All In bets, and
 * the halving rounded down to a whole 25. Two rows spending the same cards in
 * opposite orders and NOT differing by half would be the slide teaching the
 * thing it exists to correct.
 */
test('the tactics slide names both plays, states the halving, and its drawing pays what cards.json says', () => {
  const i = SLIDE_SLUGS.indexOf('tactics');
  assert.notEqual(i, -1, 'the tactics slide is not in the deck');
  const html = renderLearn(S({ learnStep: i }));
  const prose = STEPS[i].body.join(' ');

  for (const name of ['Hit and run', 'Bet and hide']) {
    assert.ok(prose.includes(name), `the copy never names the "${name}" tactic`);
  }
  assert.match(prose, /Hidden/, 'the copy never says what Run leaves you as');
  assert.match(prose, /halved/, 'the copy never states the halving');
  assert.match(prose, /whole 25/, 'the halving must say what it rounds to');
  assert.match(prose, /free/, 'movement being free is half the answer to the question');

  const { plans } = COPY.tactics;
  assert.equal(plans.length, 3, 'two plays and the order that costs');
  for (const p of plans) {
    assert.ok(html.includes(p.name), `the drawing drops "${p.name}"`);
    assert.ok(html.includes(`<b>${p.dealt}</b>`), `${p.name}: ${p.dealt} is not on the slide`);
    for (const id of p.cards) assert.ok(data.byId[id], `${p.name} plays a card that is not in the deck: ${id}`);
    assert.ok(p.cards.includes('run'), `${p.name} is not about where Run sits`);
  }
  // Every card in the plain play prices itself out of cards.json.
  const plain = plans.find((p) => p.cards.every((id) => typeof data.byId[id].damage === 'number'));
  assert.equal(plain.dealt, plain.cards.reduce((n, id) => n + data.byId[id].damage, 0), 'the drawing does not add up its own cards');
  // The two All In rows: same cards, opposite orders, and the halving between.
  const full = plans.find((p) => p.cards.includes('all-in') && !p.costly);
  const cut = plans.find((p) => p.costly);
  assert.equal(full.dealt, 4 * full.bet * 25, 'All In pays 100 for every card it bets');
  assert.deepEqual([...cut.cards].sort(), [...full.cards].sort(), 'the two orders must spend the same cards');
  assert.notDeepEqual(cut.cards, full.cards, 'and they must be in opposite orders');
  assert.equal(cut.dealt, Math.floor(full.dealt / 2 / 25) * 25, 'hiding first halves the bet, down to a whole 25');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
