// Wits (docs/EXPANSIONS.md M3, RULES.wits.md): three cards that spend a check
// on something other than damage.
//
// The design decision this file is really guarding is that they are CARDS, not
// buttons. All three resolve through attack(), which is why the hand, the plan
// lane, the target chips, the inspector, the roll dialog, the Rune and the
// Hunter's reroll all work on them with no new view code. If a future change
// gives them their own path, most of these tests stop meaning what they say.
//
// The second thing guarded here is that none of them can rescue a player who
// never bets. Marked cannot ease a card with no check, and Strike has none, so
// this module structurally cannot become the fix for the turtle defect and
// therefore cannot become mandatory.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { useCards } from '../js/data/cards.js';
import { useExpansions, moduleCards, moduleOf } from '../js/data/expansions.js';
import {
  newFight, legalAttacks, attack, endTurn, bossRoll, resolveBoss, startRound,
  effectiveStep, hasMark, applyMark, ready,
} from '../js/game/engine.js';
import { newRun, attacksFor, moduleAttacksFor } from '../js/game/run.js';
import { hasGlyph } from '../js/cards/glyphs.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = useCards(JSON.parse(readFileSync(join(root, 'data/cards.json'), 'utf8')));
const mods = useExpansions(JSON.parse(readFileSync(join(root, 'data/expansions.json'), 'utf8')));
const L1 = data.boss.find((b) => b.size === 'M');
const WITS = moduleOf(mods, 'wits').attack;

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}

const fight = (over = {}) => newFight(data, {
  level: 1, boss: L1, noSignatures: true,
  hero: {
    element: 'fire', klass: null, pool: ['fire', 'fire', 'fire', 'fire'],
    attacks: [...data.attack, ...WITS.map((c) => ({ ...c, deck: 'attack', module: 'wits' }))],
  },
  die: 'd20', mode: 'standard', ...over,
});
const card = (f, id) => legalAttacks(f).find((a) => a.id === id);

// ── The three cards ──────────────────────────────────────────

test('Scout throws the boss die face up and binds the reaction to it', () => {
  const f = fight();
  attack(f, card(f, 'scout'), { u: 0, face: 6 });   // u below the odds: the check lands
  assert.equal(f.foretold, 6, 'the face is bound');
  assert.equal(f.actionsLeft, 2, 'and it cost one action');
  assert.equal(ready(f), 4, 'and no life card');
  f.phase = 'boss';
  const p = bossRoll(f, 1);                          // a different die: the foretold one wins
  assert.equal(p.roll, 6, 'the boss is held to what everyone saw');
  assert.equal(p.kind, 'ruin');
});

test('Scout with no face waits for the table to say what the die showed', () => {
  const f = fight();
  attack(f, card(f, 'scout'), { u: 0 });
  assert.equal(f.awaitForetell, true, 'the same door the Knight\'s Taunt uses');
  assert.equal(f.foretold, null);
});

test('a missed Scout costs the action and tells you nothing', () => {
  const f = fight();
  attack(f, card(f, 'scout'), { u: 0.99, face: 6 });  // u above the odds: a miss
  assert.equal(f.foretold, null);
  assert.equal(f.awaitForetell, false);
  assert.equal(f.actionsLeft, 2, 'the action is spent either way');
});

test('Analyze Marks what you point it at, and eases the next attack one rung', () => {
  const f = fight();
  const allIn = card(f, 'all-in');
  assert.equal(effectiveStep(f, allIn), 'even');
  attack(f, card(f, 'analyze'), { u: 0, target: 'body' });
  assert.equal(hasMark(f.boss, 'marked'), true);
  assert.equal(effectiveStep(f, allIn), 'sure', 'one rung, on the printed ladder');

  // And at a minion, which is the case that used to read the boss's marks.
  const g = fight();
  g.boss.minions = [{ hp: 200, max: 200, marks: {} }];
  attack(g, card(g, 'analyze'), { u: 0, target: 0 });
  assert.equal(hasMark(g.boss.minions[0], 'marked'), true);
  assert.equal(hasMark(g.boss, 'marked'), false, 'the boss was not the target');
});

test('Parley freezes the boss for a round, once a level', () => {
  const f = fight();
  attack(f, card(f, 'parley'), { u: 0 });
  assert.equal(hasMark(f.boss, 'frozen'), true);
  f.phase = 'boss';
  assert.equal(bossRoll(f, 6).kind, 'frozen', 'a Ruin it never gets to throw');
  resolveBoss(f);

  assert.equal(card(f, 'parley').canAfford, false, 'spent for the level');
  assert.equal(card(f, 'parley').barred, true, 'and the hand can say why');
  assert.throws(() => attack(f, { ...card(f, 'parley'), canAfford: true }, { u: 0 }), /once a level/);
});

test('a failed Parley turns this round\'s reaction into a Roar, whatever it was', () => {
  // The module's engine. Trading a Ruin for a Roar is a good round; trading a
  // Brace for one is the worst move in the module, and only Scout tells you which.
  for (const face of [1, 2, 4, 6]) {
    const f = fight();
    attack(f, card(f, 'parley'), { u: 0.99 });        // Hard, and we failed it
    assert.equal(f.boss.forced, 'roar');
    f.phase = 'boss';
    const p = bossRoll(f, face);
    assert.equal(p.kind, 'roar', `a ${face} should have become a Roar`);
    assert.ok(p.dmg > 0, 'and a Roar hurts');
  }
});

test('a forced Roar is spent as it is read, so it lasts exactly one round', () => {
  const f = fight();
  attack(f, card(f, 'parley'), { u: 0.99 });
  f.phase = 'boss';
  bossRoll(f, 1);
  assert.equal(f.boss.forced, null, 'used up');
  resolveBoss(f);
  f.phase = 'boss';
  assert.equal(bossRoll(f, 1).kind, 'brace', 'the round after is the boss\'s own die again');
});

// ── Droppability, which is the constraint that matters ───────

test('nothing in the module helps a player who never bets a life card', () => {
  // Marked eases a CHECK. Strike has none, so a turtle gains exactly nothing,
  // and this module cannot quietly become the fix for the turtle defect.
  const f = fight();
  const strike = card(f, 'strike');
  assert.equal(strike.check ?? null, null, 'Strike still has no check to ease');
  applyMark(f, 'body', 'marked');
  assert.equal(effectiveStep(f, strike), null, 'so Marked does nothing for it');
  for (const c of WITS) assert.equal(c.damage, 0, `${c.id} must deal no damage`);
  for (const c of WITS) assert.equal(c.bet, 0, `${c.id} must bet no life card`);
});

test('legacy refuses a module card at both doors', () => {
  const f = fight({ legacy: true });
  for (const id of ['scout', 'analyze', 'parley']) {
    assert.equal(card(f, id).canAfford, false, `${id} is offered under legacy`);
    assert.equal(card(f, id).barred, true);
    assert.throws(() => attack(f, { ...card(f, id), canAfford: true }, { u: 0 }), /expansion/);
  }
});

test('the cards reach the hand only when the module is switched on', () => {
  const off = newRun(data, { kind: 'full', element: 'fire', modules: { wits: false }, mods });
  const on = newRun(data, { kind: 'full', element: 'fire', modules: { wits: true }, mods });
  const ids = (r) => attacksFor(r, data).map((c) => c.id);
  assert.equal(ids(off).includes('scout'), false);
  assert.deepEqual(ids(on).filter((i) => ['scout', 'analyze', 'parley'].includes(i)), ['scout', 'analyze', 'parley']);

  // The First Game keeps its six cards on purpose: it is the try-out.
  const first = newRun(data, { kind: 'first', element: 'fire', modules: { wits: true }, mods });
  assert.equal(ids(first).includes('scout'), false, 'the First Game is still six cards');

  // And a run resolves its modules ONCE, so flipping the switch mid-campaign
  // cannot silently change a game already in progress.
  on.modules.wits = false;
  assert.equal(attacksFor(on, data).map((c) => c.id).includes('scout'), true, 'the run keeps the game it started');
  assert.deepEqual(moduleAttacksFor(null, null), [], 'and no expansion data means no cards, not a crash');
});

// ── Components ───────────────────────────────────────────────

test('the module prints four cards on one sheet, every one with its own drawing', () => {
  const cards = moduleCards(mods, 'wits');
  assert.equal(cards.length, 4);
  assert.equal(moduleOf(mods, 'wits').sheets, 1);
  const seen = new Set();
  for (const c of cards) {
    assert.ok(hasGlyph(c.icon), `${c.id} names "${c.icon}", which is not a glyph`);
    assert.equal(seen.has(c.icon), false, `${c.id} shares a drawing`);
    seen.add(c.icon);
  }
  const baseIds = new Set(data.physical.map((c) => c.id));
  for (const c of cards) assert.equal(baseIds.has(c.id), false, `${c.id} collides with a base card`);
  assert.equal(data.physical.length, 111, 'and the frozen box is still the frozen box');
});

test('Wits declares that it needs Terrain, because two cards place its bricks', () => {
  assert.deepEqual(moduleOf(mods, 'wits').needs, ['terrain']);
  for (const c of WITS) {
    if (c.mark) assert.ok(['marked', 'frozen'].includes(c.mark), `${c.id} places ${c.mark}, which Terrain does not ship`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
