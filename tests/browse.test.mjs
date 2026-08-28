// The browse surface of the Cards view: grouping, filtering, the backs toggle,
// and the one thing it must never touch, the order the print sheet is filled in.
// Run with `node tests/browse.test.mjs`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { useCards, DECKS } from '../js/data/cards.js';
import { state } from '../js/state.js';
import { SORTS, axis, groupCards, filterCards, printOrder, renderCards, onCardsAction } from '../js/views/cards.js';
import { backKind } from '../js/cards/sheet.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = JSON.parse(readFileSync(join(root, 'data/cards.json'), 'utf8'));
const data = useCards(JSON.parse(JSON.stringify(raw)));

// Every unique card in cards.json order, and the physical total the box holds.
const ALL = DECKS.flatMap((d) => data[d] || []);
const COPIES = ALL.reduce((a, c) => a + (c.copies || 1), 0);

// The browse defaults, read from state.js rather than restated here: this is
// what `reset` has to restore, and a default that moved should move the test.
const DEFAULTS = { ...state.browse };

/** A state stand-in with the real defaults. renderCards only reads, never writes. */
const S = (browse = {}, over = {}) => ({
  cards: data, deckFilter: 'all', paper: 'a4', withBacks: 'none',
  browse: { ...DEFAULTS, ...browse }, ...over,
});

// Queued and awaited (the pattern from tests/cards.test.mjs): a test that scores
// a pass for returning a Promise is worse than no test at all.
let passed = 0, failed = 0;
const queue = [];
const test = (name, fn) => queue.push([name, fn]);

const flat = (groups) => groups.flatMap((g) => g.cards);

test('every sort groups the whole catalogue: no card lost, none duplicated', () => {
  for (const sort of SORTS) {
    const groups = groupCards(ALL, sort);
    const ids = flat(groups).map((c) => c.id);
    assert.equal(ids.length, ALL.length, `${sort}: ${ids.length} cards grouped, ${ALL.length} exist`);
    assert.equal(new Set(ids).size, ids.length, `${sort}: a card appears twice`);
    assert.deepEqual([...new Set(ids)].sort(), ALL.map((c) => c.id).sort(), `${sort}: not the same set of cards`);
    assert.equal(groups.reduce((a, g) => a + g.copies, 0), COPIES, `${sort}: copies do not add up to the box`);
    assert.ok(groups.length > 1, `${sort}: grouping produced a single flat list`);
    assert.equal(new Set(groups.map((g) => g.key)).size, groups.length, `${sort}: two groups share a key`);
    for (const g of groups) assert.ok(g.cards.length > 0, `${sort}: empty group ${g.key}`);
  }
});

test('every group heading resolves to a real string (a miss renders the raw [key])', () => {
  for (const sort of SORTS) {
    for (const g of groupCards(ALL, sort)) {
      assert.ok(g.label && !g.label.includes('['), `${sort}/${g.key}: heading "${g.label}"`);
    }
  }
});

test('an axis that does not describe a card leaves it under its deck heading', () => {
  // A life card has no tier, a boss card has no check, a class card has no
  // element of its own. Those cards keep their deck heading rather than being
  // filed under a made-up value, and the heading sits after the keyed groups.
  for (const sort of ['element', 'tier', 'class', 'check', 'damage']) {
    const groups = groupCards(ALL, sort);
    const keyed = groups.filter((g) => g.key.startsWith(`${sort}:`));
    const residue = groups.filter((g) => g.key.startsWith('deck:'));
    assert.ok(keyed.length >= 2, `${sort}: expected real groups`);
    assert.ok(residue.length >= 1, `${sort}: expected a deck residue`);
    assert.ok(groups.indexOf(keyed[keyed.length - 1]) < groups.indexOf(residue[0]), `${sort}: residue must come last`);
    for (const g of residue) for (const c of g.cards) assert.equal(axis(c, sort), null, `${c.id} has a ${sort} and should be in a keyed group`);
  }
  assert.equal(axis(data.byId['life-fire'], 'tier'), null, 'a life card has no tier');
  assert.equal(axis(data.byId['boss-s'], 'check'), null, 'a boss card has no check');
  // A boss card DOES carry a damage number, but it is damage dealt to the
  // player: it is deliberately not grouped with an attack's damage.
  assert.equal(axis(data.byId['boss-s'], 'damage'), null, 'boss damage is a different quantity');
  assert.equal(axis(data.byId.strike, 'element'), 'none', 'a neutral attack plays as your element');
});

test('the element sort keeps the printed element order, and the risk sort keeps the ramp', () => {
  const els = groupCards(ALL, 'element').filter((g) => g.key.startsWith('element:')).map((g) => g.key);
  assert.deepEqual(els, ['element:fire', 'element:water', 'element:earth', 'element:wind', 'element:none']);
  const risk = groupCards(ALL, 'check').filter((g) => g.key.startsWith('check:')).map((g) => g.key);
  assert.deepEqual(risk, ['check:none', 'check:sure', 'check:even'], 'always lands first, then the ramp as far as the cards go');
  const dmg = groupCards(ALL, 'damage').filter((g) => g.key.startsWith('damage:')).map((g) => Number(g.key.slice(7)));
  const numeric = dmg.filter((n) => !Number.isNaN(n));
  assert.deepEqual(numeric, [...numeric].sort((a, b) => b - a), 'damage runs biggest hitter first');
  assert.ok(Number.isNaN(dmg[dmg.length - 1]), '4x bet has no fixed number, so it ranks last');
});

test('the name sort is alphabetical within and between its groups', () => {
  const groups = groupCards(ALL, 'name');
  const names = flat(groups).map((c) => c.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  assert.equal(groups[0].label, groups[0].cards[0].name.charAt(0).toUpperCase());
});

test('each filter narrows, and two filters narrow further', () => {
  const all = filterCards(data, S()).length;
  assert.equal(all, ALL.length, 'no filter shows the whole catalogue');

  const fire = filterCards(data, S({ element: 'fire' }));
  assert.ok(fire.length > 0 && fire.length < all, `element=fire: ${fire.length} of ${all}`);
  for (const c of fire) assert.equal(c.element, 'fire', `${c.id} is not fire`);

  const tier4 = filterCards(data, S({ tier: '4' }));
  assert.ok(tier4.length > 0 && tier4.length < all);
  for (const c of tier4) assert.equal(c.tier, 4);

  const knight = filterCards(data, S({ klass: 'knight' }));
  assert.ok(knight.length > 0 && knight.length < all);
  for (const c of knight) assert.equal(c.class, 'knight');

  // AND, not OR: fire tier 4 is a subset of both, and strictly smaller.
  const both = filterCards(data, S({ element: 'fire', tier: '4' }));
  assert.ok(both.length > 0, 'fire tier 4 exists');
  assert.ok(both.length < fire.length && both.length < tier4.length, `${both.length} vs ${fire.length}/${tier4.length}`);
  const inFire = new Set(fire.map((c) => c.id));
  for (const c of both) assert.ok(inFire.has(c.id), `${c.id} is not in the fire set`);

  // The deck chips are one more filter and AND with the rest.
  const fireSkills = filterCards(data, S({ element: 'fire' }, { deckFilter: 'skill' }));
  assert.ok(fireSkills.length > 0 && fireSkills.length < fire.length);
  for (const c of fireSkills) assert.equal(c.deck, 'skill');

  // The 'none' buckets select the cards the axis leaves open, not everything.
  const open = filterCards(data, S({ klass: 'none' }));
  assert.ok(open.length > 0 && open.length < all);
  for (const c of open) assert.ok((c.deck === 'attack' || c.deck === 'skill') && !c.class, `${c.id} is not an unlocked playable card`);
});

test('an impossible combination shows the empty state, and does not crash any sort', () => {
  // There is no fire Knight skill in the deck, so this is a real dead end.
  const s = S({ element: 'fire', klass: 'knight' });
  assert.deepEqual(filterCards(data, s), []);
  assert.deepEqual(groupCards(filterCards(data, s), 'deck'), []);
  for (const sort of SORTS) {
    const html = renderCards(S({ element: 'fire', klass: 'knight', sort }));
    assert.ok(html.includes('No card matches those filters.'), `${sort}: no empty state`);
    assert.ok(!html.includes('class="deck-grid"'), `${sort}: an empty grid was rendered anyway`);
    assert.ok(html.includes('data-action="cards-reset"'), `${sort}: no way back out`);
  }
});

test('the grid renders one tappable card per visible card, under every sort', () => {
  for (const sort of SORTS) {
    const s = S({ sort });
    const html = renderCards(s);
    const cells = (html.match(/data-action="cards-detail"/g) || []).length;
    assert.equal(cells, filterCards(data, s).length, `${sort}: ${cells} cells`);
    const heads = (html.match(/<div class="deck-head">/g) || []).length;
    assert.equal(heads, groupCards(filterCards(data, s), sort).length, `${sort}: heading count`);
    assert.ok(!html.includes('[cards.'), `${sort}: an unresolved string key reached the page`);
  }
});

test('the backs toggle actually renders backs, and the detail back mirrors the print sheet', () => {
  const faces = renderCards(S({ backs: false }));
  const backs = renderCards(S({ backs: true }));
  assert.ok(!faces.includes('aria-label="card back"'), 'the faces grid shows no backs');
  const n = filterCards(data, S()).length;
  assert.equal((backs.match(/aria-label="card back"/g) || []).length, n, 'one back per card');
  assert.ok(!backs.includes('class="pip pip--bet"'), 'a back carries none of the face furniture');
  // Both grids scale the card the same way: 'sheet' is millimetres and would
  // print-size the back inside the grid.
  assert.ok(backs.includes('sk-card--browse'), 'backs use the browse size preset');
  // Which back a card takes is the printer's decision, so the grid imports
  // backKind from sheet.js rather than keeping a matching copy. The screen cannot
  // preview a back the printer will not produce, and there is nothing to drift.
  const src = readFileSync(join(root, 'js/views/cards.js'), 'utf8');
  assert.ok(/import \{[^}]*backKind[^}]*\} from '\.\.\/cards\/sheet\.js'/.test(src), 'the grid imports backKind, it does not redefine it');
  assert.equal(/const\s+FACE_KIND\s*=/.test(src), false, 'no second copy of the face-to-back map');
  assert.equal(backKind(data.byId['life-fire']), 'fire');
  assert.equal(backKind(data.byId['life-boss']), 'boss');
  assert.equal(backKind(data.byId['life-extra']), 'extra');
  assert.equal(backKind(data.byId.strike), 'skill', 'everything that is not a life card gets the pool back');
});

test('PRINTING IS NOT AFFECTED: the sheet keeps the boxed order under any browse state', () => {
  // The expected order is rebuilt from the raw JSON here rather than read from
  // data.physical, so this compares the print seam against the file itself.
  const expected = [];
  for (const deck of DECKS) for (const c of raw[deck] || []) for (let i = 0; i < (c.copies || 1); i++) expected.push(c.id);
  assert.equal(expected.length, COPIES);

  const exotic = S({ sort: 'damage', element: 'water', tier: '3', klass: 'mage', backs: true }, { deckFilter: 'skill' });
  assert.deepEqual(printOrder(exotic).map((c) => c.id), expected, 'browse state leaked into the print order');
  assert.deepEqual(printOrder(S()).map((c) => c.id), expected);
  for (const sort of SORTS) {
    assert.deepEqual(printOrder(S({ sort })).map((c) => c.id), expected, `${sort} reordered the sheet`);
  }
  // Print this deck narrows the sheet and keeps cards.json order inside it.
  assert.deepEqual(
    printOrder(exotic, 'life').map((c) => c.id),
    expected.filter((id) => data.byId[id].deck === 'life'),
  );
  // And the sorted screen really is a different order, or this proves nothing.
  const onScreen = groupCards(filterCards(data, S({ sort: 'damage' })), 'damage').flatMap((g) => g.cards).map((c) => c.id);
  assert.notDeepEqual(onScreen, [...new Set(expected)], 'the damage sort should not match the boxed order');
});

test('onCardsAction moves state.browse, and reset restores the defaults', () => {
  const s = S();
  const el = (dataset, value) => ({ dataset, value });

  assert.equal(onCardsAction(s, 'sort', el({}, 'element')), true, 'a select hands over el.value');
  assert.equal(s.browse.sort, 'element');
  onCardsAction(s, 'sort', el({ sort: 'tier' }));
  assert.equal(s.browse.sort, 'tier', 'a button hands over data-sort');
  onCardsAction(s, 'sort', el({}, 'nonsense'));
  assert.equal(s.browse.sort, 'deck', 'an unknown key falls back to the boxed order');

  onCardsAction(s, 'element', el({ element: 'water' }));
  onCardsAction(s, 'tier', el({ tier: '2' }));
  onCardsAction(s, 'class', el({ class: 'mage' }));
  assert.deepEqual([s.browse.element, s.browse.tier, s.browse.klass], ['water', '2', 'mage']);

  assert.equal(s.browse.backs, false);
  onCardsAction(s, 'backs', el({}));
  assert.equal(s.browse.backs, true, 'the backs toggle flips');
  onCardsAction(s, 'backs', el({}));
  assert.equal(s.browse.backs, false);

  s.deckFilter = 'boss';
  s.browse.sort = 'name';
  assert.equal(onCardsAction(s, 'reset', el({})), true);
  assert.deepEqual(s.browse, DEFAULTS, 'reset restores the state.js defaults');
  assert.equal(s.deckFilter, 'all', 'the deck chips are a filter row, so Clear clears them too');

  assert.equal(onCardsAction(s, 'not-an-action', el({})), false, 'an unclaimed action re-renders nothing');
});

test('the toolbar offers every sort, both toggles and the print-order note', () => {
  const html = renderCards(S());
  for (const sort of SORTS) assert.ok(html.includes(`<option value="${sort}"`), `no option for ${sort}`);
  assert.ok(html.includes('data-change="cards-sort"'), 'the sort control is a labelled select');
  assert.ok(html.includes('data-action="cards-backs"'), 'no backs toggle');
  for (const el of ['fire', 'water', 'earth', 'wind']) assert.ok(html.includes(`data-element="${el}"`), `no ${el} chip`);
  assert.ok(html.includes('data-tier="4"') && html.includes('data-class="knight"'), 'tier and class chips');
  assert.ok(/aria-pressed="(true|false)"/.test(html), 'chips carry aria-pressed');
  // The note used to be a line of prose beside the button. It is now the button's
  // own tooltip: the page lost a sentence, the guarantee did not move.
  assert.ok(/data-action="cards-print" title="Printing always uses the boxed order/.test(html),
    'the print button still states that sorting cannot reach the sheet');
  assert.ok(!html.includes('cards-print__note'), 'and the standalone line is gone');
  // Clear appears only when there is something to clear.
  assert.ok(!html.includes('data-action="cards-reset"'), 'nothing to clear on a fresh view');
  assert.ok(renderCards(S({ tier: '2' })).includes('data-action="cards-reset"'), 'a filtered view offers Clear');
});

for (const [name, fn] of queue) {
  try { await fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
