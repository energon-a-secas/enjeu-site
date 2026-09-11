// Preparation (docs/EXPANSIONS.md M2, RULES.prep.md): spend this turn on the
// next one.
//
// The whole module rests on one clause, so most of this file is about that
// clause. Prepare MUST be the last action of the turn. A Charge worth 50 that
// could be cashed on the turn it was bought would simply be a Strike that deals
// 50, collected free by the safest player at the table, and it measures at
// turtle level 1 going 47.6% to 100.0% (tools/checks/prepare.mjs). Made last, it
// is a bet on surviving a round, and measures at +0.2.
//
// The second thing guarded here is that a level has ONE object and ONE use
// however many modules are on. The props deliberately share Terrain's
// `objectUsed` slot rather than opening a second one.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { useCards } from '../js/data/cards.js';
import { useExpansions, moduleOf, moduleCards, objectFor, drawProp, props } from '../js/data/expansions.js';
import {
  newFight, legalAttacks, attack, take, startRound, endTurn, bossRoll, resolveBoss,
  useObject, canUseObject, hasMark, attackDamage, ready, broken,
} from '../js/game/engine.js';
import { hasGlyph } from '../js/cards/glyphs.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = useCards(JSON.parse(readFileSync(join(root, 'data/cards.json'), 'utf8')));
const mods = useExpansions(JSON.parse(readFileSync(join(root, 'data/expansions.json'), 'utf8')));
const L1 = data.boss.find((b) => b.size === 'M');
const PREPARE = { ...moduleOf(mods, 'prep').attack[0], deck: 'attack', module: 'prep' };
const prop = (id) => props(mods).find((p) => p.id === id);

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}

const fight = (over = {}) => newFight(data, {
  level: 1, boss: L1, noSignatures: true,
  hero: { element: 'fire', klass: null, pool: ['fire', 'fire', 'fire', 'fire'], attacks: [...data.attack, PREPARE] },
  die: 'd20', mode: 'standard', ...over,
});
const card = (f, id) => legalAttacks(f).find((a) => a.id === id);

// ── The clause the module rests on ───────────────────────────

test('Prepare is refused until it is the last action of the turn', () => {
  const f = fight();
  assert.equal(f.actionsLeft, 3);
  assert.equal(card(f, 'prepare').canAfford, false, 'not with three actions left');
  assert.equal(card(f, 'prepare').barred, true, 'and the hand can say why');
  assert.throws(() => attack(f, { ...card(f, 'prepare'), canAfford: true }, {}), /last thing you do/);

  attack(f, card(f, 'strike'), { target: 'body' });
  assert.equal(card(f, 'prepare').canAfford, false, 'not with two');
  attack(f, card(f, 'strike'), { target: 'body' });
  assert.equal(card(f, 'prepare').canAfford, true, 'with one, yes');
  attack(f, card(f, 'prepare'), {});
  assert.equal(hasMark(f.hero, 'charged'), true);
  assert.equal(f.actionsLeft, 0);
});

test('Prepare charges YOU, not the thing you are looking at', () => {
  const f = fight();
  f.actionsLeft = 1;
  attack(f, card(f, 'prepare'), { target: 'body' });   // a target is offered and ignored
  assert.equal(hasMark(f.hero, 'charged'), true);
  assert.equal(hasMark(f.boss, 'charged'), false, 'the boss must never be the one who winds up');
});

test('the Charge is +50 on the next landed attack, and is spent by it', () => {
  const f = fight();
  f.actionsLeft = 1;
  attack(f, card(f, 'prepare'), {});
  startRound(f);                                        // a fresh turn, Charge intact
  const strike = card(f, 'strike');
  assert.equal(attackDamage(f, strike, 0), 25 + 50, 'the wind-up is worth 50');
  const r = attack(f, strike, { target: 'body' });
  assert.equal(r.dealt, 75);
  assert.equal(hasMark(f.hero, 'charged'), false, 'and it is gone');
  assert.equal(attackDamage(f, card(f, 'strike'), 0), 25, 'back to a plain Strike');
});

test('any hit that costs a card costs the Charge, whoever made you pay', () => {
  for (const [what, apply] of [
    ['a plain guard', (g) => take(g, 25, false)],
    ['a break under Rage', (g) => take(g, 25, true)],
    ['a Mark ticking', (g) => { g.hero.marks.poison = true; startRound(g); }],
  ]) {
    const g = fight();
    g.actionsLeft = 1;
    attack(g, card(g, 'prepare'), {});
    apply(g);
    assert.equal(hasMark(g.hero, 'charged'), false, `${what} should have cost the Charge`);
  }
});

// ── Props ────────────────────────────────────────────────────

test('a prop is one action and one use, and it deals what its card says', () => {
  const f = fight();
  const barrel = prop('pitch-barrel');
  const before = f.boss.body;
  assert.equal(canUseObject(f, barrel), true);
  useObject(f, barrel);
  assert.equal(f.boss.body, before - 50);
  assert.equal(hasMark(f.boss, 'burning'), true);
  assert.equal(f.actionsLeft, 2);
  assert.equal(canUseObject(f, barrel), false, 'one use');
});

test('a level has ONE object and ONE use, even with both modules in play', () => {
  // The rule that stops M2 stacking free damage on top of M1. The props share
  // Terrain's objectUsed slot rather than opening a second one, which is also
  // why useObject() needed no change at all to place a prop.
  const f = fight({ biome: { id: 'volcano', element: 'fire' } });
  const vent = objectFor(mods, 'volcano');
  const cart = prop('cart');
  assert.ok(vent && cart, 'both are on the table');
  assert.equal(canUseObject(f, vent), true);
  assert.equal(canUseObject(f, cart), true, 'you may use either');
  useObject(f, cart);
  assert.equal(canUseObject(f, vent), false, 'but not both');
  assert.throws(() => useObject(f, vent), /spent for this level/);
});

test('the Chandelier costs you your next action, and the Millstone costs two now', () => {
  const f = fight();
  const before = f.boss.body;
  useObject(f, prop('chandelier'));
  assert.equal(f.boss.body, before - 100);
  assert.equal(hasMark(f.hero, 'frozen'), true, 'you go down with it');
  startRound(f);
  assert.equal(f.actionsLeft, 2, 'and lose an action for it');

  const g = fight();
  const mill = prop('millstone');
  assert.equal(mill.actions, 2);
  const bodyBefore = g.boss.body;
  useObject(g, mill);
  assert.equal(g.actionsLeft, 1, 'two actions up front');
  assert.equal(g.boss.body, bodyBefore - 100, 'and 100 for them');
  assert.equal(hasMark(g.hero, 'frozen'), false, 'the Millstone costs actions, not a Mark');
});

test('the Rope Bridge deals nothing and is often the strongest card in the deck', () => {
  const f = fight();
  const before = f.boss.body;
  useObject(f, prop('rope-bridge'));
  assert.equal(f.boss.body, before, 'no damage at all');
  assert.equal(hasMark(f.boss, 'frozen'), true);
  f.phase = 'boss';
  assert.equal(bossRoll(f, 6).kind, 'frozen', 'a Ruin it never gets to throw');
});

test('every prop names a Mark that exists, or none at all', () => {
  const marks = new Set(['poison', 'burning', 'frozen', 'marked', 'charged', 'snared']);
  for (const p of props(mods)) {
    for (const m of [p.target_mark, p.self_mark]) {
      if (m) assert.ok(marks.has(m), `${p.id} gives "${m}", which is not a Mark`);
    }
    assert.ok(p.actions >= 1, `${p.id} must cost at least an action`);
    assert.equal(p.damage % 25, 0, `${p.id} deals ${p.damage}, which is not a multiple of 25`);
  }
  assert.equal(props(mods).length, 8);
  assert.equal(drawProp(mods, 0).id, props(mods)[0].id);
  assert.equal(drawProp(mods, 1).id, props(mods)[7].id, 'a uniform of exactly 1 is still in the deck');
  assert.equal(drawProp({ byId: {} }, 0.5), null, 'no module means no prop, not a crash');
});

// ── Droppability ─────────────────────────────────────────────

test('legacy refuses Prepare at both doors', () => {
  const f = fight({ legacy: true });
  f.actionsLeft = 1;
  assert.equal(card(f, 'prepare').canAfford, false);
  assert.throws(() => attack(f, { ...card(f, 'prepare'), canAfford: true }, {}), /expansion/);
  assert.throws(() => useObject(f, prop('cart')), /expansion/);
});

test('the module prints nine cards on one sheet, each with its own drawing', () => {
  const cards = moduleCards(mods, 'prep');
  assert.equal(cards.length, 9);
  assert.equal(moduleOf(mods, 'prep').sheets, 1);
  const seen = new Set();
  for (const c of cards) {
    assert.ok(hasGlyph(c.icon), `${c.id} names "${c.icon}", which is not a glyph`);
    assert.equal(seen.has(c.icon), false, `${c.id} shares a drawing`);
    seen.add(c.icon);
  }
  const baseIds = new Set(data.physical.map((c) => c.id));
  for (const c of cards) assert.equal(baseIds.has(c.id), false, `${c.id} collides with a base card`);
  assert.equal(data.physical.length, 111);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
