// Contract C3 (engine) and C4 (strategies). Two halves:
//   1. unit rules: each rule the rulebook states, exercised and tripped
//   2. parity: in legacy mode the JS table must land on docs/BALANCE.md
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { useCards } from '../js/data/cards.js';
import { newFight, legalAttacks, attack, reroll, hide, endTurn, bossRoll, resolveBoss, take, playAdvantage, ready, spent, broken, bossHp, bossDown, effectiveStep } from '../js/game/engine.js';
import { affordable, choose, pKill, wantsBarrier, STYLES } from '../js/game/strategies.js';
import { runCell, levels, STRIKE, FOCUS, ALL_IN, TIER } from '../js/game/sim.js';
import { reattach } from '../js/game/run.js';
import { rng } from '../js/utils.js';
import { PUBLISHED } from '../js/data/published.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = useCards(JSON.parse(readFileSync(join(root, 'data/cards.json'), 'utf8')));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}

const L1 = data.byId['boss-m'];
const basic = (over = {}) => newFight(data, {
  level: 1, boss: L1, hero: { element: 'fire', klass: null, pool: ['fire', 'fire', 'fire', 'fire'], attacks: [STRIKE, FOCUS, ALL_IN] },
  die: 'd20', mode: 'standard', ...over,
});

// ── 1. Rules ─────────────────────────────────────────────────
test('the one rule: guard with Ready -> Spent (free); with nothing Ready, Spent -> Broken', () => {
  const f = basic();
  take(f, 50, false);
  assert.deepEqual([ready(f), spent(f), broken(f)], [2, 2, 0]);
  assert.ok(f.log.some((l) => /Guarded 50 with 2 Ready cards/.test(l.text)), 'the guard narrates itself before Recover hides it');
  take(f, 75, false);                 // 2 ready absorb 50, the third 25 breaks a spent card
  assert.deepEqual([ready(f), spent(f), broken(f)], [0, 3, 1]);
  assert.equal(take(f, 100, false), false, 'owing more than the pool is Down');
  assert.equal(f.phase, 'lost');
});

test('Rage: damage doubles and goes straight to Broken, Ready cards first', () => {
  const f = basic();
  f.round = 4;                        // rage round for level 1
  f.phase = 'boss';
  const p = bossRoll(f, 2);           // Strike
  assert.equal(p.dmg, 100, 'double 50');
  resolveBoss(f);
  assert.equal(broken(f), 4, 'four cards broken from Ready, no guarding');
});

test('betting turns cards sideways whether the attack lands or not; they recover next round', () => {
  const f = basic();
  const focus = legalAttacks(f).find((a) => a.id === 'focus');
  const r = attack(f, focus, { roll: 1 });            // miss on d20 (Sure needs 6+)
  assert.equal(r.hit, false); assert.equal(spent(f), 1); assert.equal(f.actionsLeft, 2);
  endTurn(f); bossRoll(f, 1); resolveBoss(f);          // Brace: no damage, next round starts
  assert.equal(f.round, 2); assert.equal(ready(f), 4, 'recovered');
});

test('All In: two actions, bet N, FOUR times it on Even, and the d20 target is 11+', () => {
  // 3x -> 6x -> 4x on 2026-08-27. 3x was dominated (38 expected per life card
  // against Focus's 56, for twice the actions). 6x fixed that and overshot. 4x
  // keeps the fix and makes the arithmetic a child does in their head: 100 per
  // card bet. See BALANCE.md.
  const f = basic();
  const allIn = legalAttacks(f).find((a) => a.id === 'all-in');
  const r = attack(f, allIn, { bet: 3, roll: 11 });
  assert.equal(r.hit, true); assert.equal(r.need, 11); assert.equal(r.dealt, 300); assert.equal(f.actionsLeft, 1);
  assert.equal(spent(f), 3);
  // and it must now beat Focus per card, which is the whole point of the change
  const focus = legalAttacks(f).find((a) => a.id === 'focus');
  assert.ok(300 * 0.5 + 25 > 3 * focus.damage * 0.75, 'a whole All In turn should beat three Focuses');
});

test('affinity: a Fire attack on a Wind boss adds 25, and the biome adds 25 more; Strike uses the hero element', () => {
  const f = basic({ boss: { ...L1, element: 'wind' }, biome: { id: 'volcano', element: 'fire' } });
  const strike = legalAttacks(f).find((a) => a.id === 'strike');
  const r = attack(f, strike, {});
  assert.equal(r.dealt, 75, '25 + 25 affinity + 25 biome');
});

test('Brace halves the next turn in rulebook mode, never in legacy mode', () => {
  for (const legacy of [false, true]) {
    const f = basic({ legacy });
    endTurn(f); bossRoll(f, 1); resolveBoss(f);     // Brace at the end of round 1
    assert.equal(f.round, 2);
    const focus = legalAttacks(f).find((a) => a.id === 'focus');
    const r = attack(f, focus, { roll: 20 });
    assert.equal(r.dealt, legacy ? 75 : 25, `legacy=${legacy}: 75 halved to 25 rounded down`);
  }
});

test('Summon moves 2 x per-card off the body (legacy: flat 100); capped at 3 minions; boss falls only when all cards are gone', () => {
  const f = basic();
  endTurn(f); bossRoll(f, 4); resolveBoss(f);
  assert.equal(f.boss.minions.length, 1); assert.equal(f.boss.minions[0].hp, 100); assert.equal(f.boss.body, 300);
  assert.equal(bossHp(f), 400);
  f.boss.body = 0;
  assert.equal(bossDown(f), false, 'a minion still carries the boss\'s life');
  const g = basic({ legacy: true, boss: data.byId['boss-um'] });
  endTurn(g); bossRoll(g, 4); resolveBoss(g);
  assert.equal(g.boss.minions[0].hp, 100, 'legacy: sim.py moves a flat 100');
  g.boss.body = 0; assert.equal(bossDown(g), true, 'legacy: body alone ends it');
  // cap at 3: a harmless boss (no Rage, no damage) so the hero lives to see the fourth roll
  const h = basic({ boss: { ...L1, rage: 99, damage: 0 } });
  for (let i = 0; i < 3; i++) { endTurn(h); bossRoll(h, 4); resolveBoss(h); }
  assert.equal(h.boss.minions.length, 3);
  endTurn(h);
  const p = bossRoll(h, 4);
  assert.equal(p.kind, 'strike', 'a fourth Summon Strikes instead');
});

test('a minion strikes each round for 25; felling it stops that, and a Necromancer pockets a card', () => {
  const f = basic({ hero: { element: 'fire', klass: 'necromancer', pool: ['fire', 'fire', 'fire', 'fire'], attacks: [STRIKE, FOCUS, ALL_IN] } });
  endTurn(f); bossRoll(f, 4); resolveBoss(f);
  const allIn = legalAttacks(f).find((a) => a.id === 'all-in');
  attack(f, allIn, { bet: 2, target: 0, roll: 20 });   // 150 at the 100hp minion
  assert.equal(f.boss.minions.length, 0); assert.equal(f.hero.pool.length, 5, 'one boss card pocketed');
  assert.equal(f.boss.body, 300, 'minion overflow does not spill to the body');
});

test('Roar: the next checked attack is one rung harder (legacy: flattened to Even, even for Strike)', () => {
  const f = basic();
  endTurn(f); bossRoll(f, 5); resolveBoss(f);
  const focus = legalAttacks(f).find((a) => a.id === 'focus');
  assert.equal(effectiveStep(f, focus), 'even');
  const strike = legalAttacks(f).find((a) => a.id === 'strike');
  assert.equal(effectiveStep(f, strike), null, 'Strike has no check to harden');
  attack(f, focus, { roll: 10 });                    // Even needs 11+
  assert.equal(effectiveStep(f, focus), 'sure', 'penalty spent');
  const g = basic({ legacy: true });
  endTurn(g); bossRoll(g, 5); resolveBoss(g);
  assert.equal(effectiveStep(g, legalAttacks(g).find((a) => a.id === 'strike')), 'even', 'legacy: sim.py hardens whatever comes next');
});

test('mode dial: Story makes Sure automatic, Nightmare makes Sure an Even', () => {
  const story = basic({ mode: 'story' }), night = basic({ mode: 'nightmare' });
  const f1 = legalAttacks(story).find((a) => a.id === 'focus'), f2 = legalAttacks(night).find((a) => a.id === 'focus');
  assert.equal(effectiveStep(story, f1), null);
  assert.equal(attack(story, f1, { roll: 1 }).hit, true);
  assert.equal(effectiveStep(night, f2), 'even');
});

test('Hide after a Strike halves the next hit this round; Knight guards 25 free once per round (not under Rage)', () => {
  const f = basic({ hero: { element: 'fire', klass: 'knight', pool: ['fire', 'fire', 'fire', 'fire'], attacks: [STRIKE, FOCUS, ALL_IN] } });
  assert.throws(() => hide(f), /Strike/);
  attack(f, legalAttacks(f).find((a) => a.id === 'strike'), {});
  hide(f);
  endTurn(f); bossRoll(f, 6); resolveBoss(f);          // Ruin 100 -> hidden 50 -> knight 25 -> one Ready card spent
  assert.deepEqual([ready(f), spent(f), broken(f)], [4, 0, 0].map((v, i) => i === 0 ? 4 : v), 'round 2 started, recovered');
  assert.ok(f.log.some((l) => /Knight guards/.test(l.text)) && f.log.some((l) => /Hidden: halved to 50/.test(l.text)));
  const g = basic({ hero: { element: 'fire', klass: 'knight', pool: ['fire', 'fire', 'fire', 'fire'], attacks: [STRIKE, FOCUS, ALL_IN] } });
  g.round = 4; g.phase = 'boss'; bossRoll(g, 2); resolveBoss(g);
  assert.equal(broken(g), 4, 'Rage ignores the Knight guard');
});

test('Hunter rerolls one failed check per round; Mage Focus +25', () => {
  const f = basic({ hero: { element: 'fire', klass: 'hunter', pool: ['fire', 'fire', 'fire', 'fire'], attacks: [STRIKE, FOCUS, ALL_IN] } });
  const focus = legalAttacks(f).find((a) => a.id === 'focus');
  assert.equal(attack(f, focus, { roll: 2 }).hit, false);
  assert.equal(reroll(f, { roll: 20 }).dealt, 75);
  assert.throws(() => reroll(f, { roll: 20 }), /no reroll/);
  const m = basic({ hero: { element: 'fire', klass: 'mage', pool: ['fire', 'fire', 'fire', 'fire'], attacks: [STRIKE, FOCUS, ALL_IN] } });
  assert.equal(attack(m, legalAttacks(m).find((a) => a.id === 'focus'), { roll: 20 }).dealt, 100);
});

test('Advantage: Cure returns 2 Broken, Barrier cancels a pending reaction, Rune auto-succeeds one check, Chest asks for 2', () => {
  const f = basic({ advantage: ['cure', 'barrier', 'rune', 'chest'] });
  for (const c of f.hero.pool) c.st = 'broken';
  playAdvantage(f, 'cure'); assert.equal(ready(f), 2);
  assert.equal(playAdvantage(f, 'chest').draw, 2);
  playAdvantage(f, 'rune');
  const focus = legalAttacks(f).find((a) => a.id === 'focus');
  assert.equal(attack(f, focus, { roll: 1, useRune: true }).auto, true);
  assert.equal(f.hero.rune, 0);
  endTurn(f); const p = bossRoll(f, 6);
  assert.equal(wantsBarrier(f, p), true, 'a style spends Barrier on Ruin');
  resolveBoss(f, { barrier: true });
  assert.equal(broken(f), 2, 'no new damage; the two unhealed stay Broken');
  assert.equal(f.hero.advantage.length, 0);
});

test('Castle: the boss acts twice on round 1; Village: one extra Ready card', () => {
  const f = basic({ biome: { id: 'castle', element: null } });
  endTurn(f); bossRoll(f, 2);
  assert.equal(resolveBoss(f), 'again');
  bossRoll(f, 2); resolveBoss(f);
  assert.equal(f.round, 2);
  const v = basic({ biome: { id: 'village', element: null } });
  assert.equal(ready(v), 5);
});

test('reattach: a saved fight round-trips; a stale save from an older build falls back to setup', () => {
  const f = basic();
  const revived = JSON.parse(JSON.stringify({ stage: 'fight', fight: f }));
  reattach(revived, data);
  assert.equal(revived.stage, 'fight');
  assert.equal(revived.fight.data, data, 'data pointer restored');
  assert.equal(JSON.stringify(revived.fight).includes('boss_reaction'), false, 'cards.json still not serialised');
  const stale = { stage: 'fight', fight: { hero: { cards: 4 }, boss: 'Level 1' } };  // an imaginary older schema
  reattach(stale, data);
  assert.equal(stale.fight, null);
  assert.equal(stale.stage, 'setup', 'stale save cannot wedge the Play view');
});

test('Bubble: costs an action and no card, absorbs 25, and pops unused at Recover', () => {
  const BUBBLE = { id: 'bubble', name: 'Bubble', actions: 1, bet: 0, damage: 0, check: null, shield: 25 };
  const f = basic({ hero: { element: 'fire', klass: null, pool: ['fire', 'fire', 'fire', 'fire'], attacks: [STRIKE, FOCUS, BUBBLE] } });
  const bub = legalAttacks(f).find((a) => a.id === 'bubble');
  const r = attack(f, bub, {});
  assert.equal(r.dealt, 0, 'deals nothing');
  assert.equal(ready(f), 4, 'costs no card: all four still Ready');
  assert.equal(f.actionsLeft, 2, 'costs one action');
  assert.equal(f.hero.shield, 25);

  // 50 incoming: 25 absorbed, the other 25 guarded by a Ready card as usual
  take(f, 50, false);
  assert.equal(f.hero.shield, 0, 'the bubble popped');
  assert.deepEqual([ready(f), spent(f), broken(f)], [3, 1, 0]);

  // under Rage it is the only thing that stops a card breaking
  const g = basic({ hero: { element: 'fire', klass: null, pool: ['fire', 'fire', 'fire', 'fire'], attacks: [STRIKE, FOCUS, BUBBLE] } });
  attack(g, legalAttacks(g).find((a) => a.id === 'bubble'), {});
  take(g, 50, true);
  assert.equal(broken(g), 1, 'Rage broke one card, not two: the bubble ate the other 25');

  // and it cannot be banked
  const h = basic({ hero: { element: 'fire', klass: null, pool: ['fire', 'fire', 'fire', 'fire'], attacks: [STRIKE, FOCUS, BUBBLE] } });
  attack(h, legalAttacks(h).find((a) => a.id === 'bubble'), {});
  endTurn(h); bossRoll(h, 1); resolveBoss(h);          // Brace: no damage, round ends
  assert.equal(h.hero.shield, 0, 'an unused bubble pops at Recover');
});

test('Second Wind: first comeback free, then the ladder climbs, and it resets each level', async () => {
  const { reviveStep, attemptRevive, canRevive } = await import('../js/game/engine.js');
  const f = basic({ secondWind: true });
  assert.equal(canRevive(f), true);
  assert.equal(reviveStep(f), null, 'the first one is free');

  // fell in battle: Down is pending, not lost, while the card is in play
  f.round = 4;
  for (const c of f.hero.pool) c.st = 'ready';
  assert.equal(take(f, 500, true), false);
  assert.equal(f.phase, 'down', 'not lost yet');
  const r1 = attemptRevive(f, {});
  assert.equal(r1.ok, true); assert.equal(r1.step, null);
  assert.equal(ready(f), 2, 'back up with 2 cards');
  assert.notEqual(f.phase, 'lost');

  // the ladder from here: Sure, Even, Hard, Wild, then Wild forever
  assert.equal(reviveStep(f), 'sure');
  f.hero.revives = 2; assert.equal(reviveStep(f), 'even');
  f.hero.revives = 3; assert.equal(reviveStep(f), 'hard');
  f.hero.revives = 4; assert.equal(reviveStep(f), 'wild');
  f.hero.revives = 9; assert.equal(reviveStep(f), 'wild', 'it never gets easier again');

  // and a failed roll ends the level exactly as before the card existed
  const g = basic({ secondWind: true });
  g.hero.revives = 1;                       // free one already spent
  g.round = 4;
  assert.equal(take(g, 500, true), false);
  assert.equal(g.phase, 'down');
  assert.equal(attemptRevive(g, { u: 0.99 }).ok, false, 'Sure is 75%, so 0.99 misses');
  assert.equal(g.phase, 'lost');

  // without the card, Down is still immediately lost
  const h = basic();
  h.round = 4;
  take(h, 500, true);
  assert.equal(h.phase, 'lost');
});

// ── 2. Strategies ────────────────────────────────────────────
test('affordable: turtle budget 0 leaves only Strike combos; pKill of 3 Strikes vs 75 is 1', () => {
  const f = basic();
  const t = affordable(f, 0);
  assert.ok(t.every((c) => c.every((a) => a.id === 'strike')) && t.length === 3);
  assert.equal(pKill(f, t[2], 75), 1);
  const safe = choose(f, 'safe');     // 4 ready, guard need 2 -> budget 2
  assert.ok(safe.reduce((a, x) => a + (x.betN || 0), 0) <= 2, 'safe keeps a guard');
  const gamble = choose(f, 'gamble');
  assert.ok(gamble.length >= 1);
});

// ── 3. Parity with docs/BALANCE.md (legacy mode) ─────────────
const BALANCE = Object.fromEntries(PUBLISHED.rows.map((r) => [r.level, r.win]));  // js/data/published.js mirrors docs/BALANCE.md
const TRIALS = Number(process.env.ENJEU_TRIALS || 3000);
const TOL = 4.0;
test(`parity: legacy engine lands within ${TOL} points of BALANCE.md at ${TRIALS} fights per cell`, () => {
  const gaps = [];
  const t0 = Date.now();
  for (const L of levels(data)) {
    STYLES.forEach((style, i) => {
      const cell = runCell(data, { level: L.level, style, legacy: true }, TRIALS);
      const want = BALANCE[L.level][i];
      const gap = Math.abs(cell.win - want);
      gaps.push(`L${L.level} ${style.padEnd(8)} js ${cell.win.toFixed(1).padStart(5)}%  py ${want.toFixed(1).padStart(5)}%  gap ${gap.toFixed(1)}`);
      assert.ok(gap <= TOL, `L${L.level} ${style}: js ${cell.win.toFixed(1)} vs py ${want} (gap ${gap.toFixed(1)})`);
    });
  }
  console.log(gaps.map((g) => `       ${g}`).join('\n'));
  console.log(`       (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
});

test('rulebook mode keeps the shape: adaptive beats safe beats turtle, turtle is 0 from level 3', () => {
  const out = [];
  for (const L of levels(data)) {
    const cells = STYLES.map((style) => runCell(data, { level: L.level, style, legacy: false }, Math.min(TRIALS, 1500)));
    const [t, s, a, g] = cells.map((c) => c.win);
    out.push(`L${L.level}  turtle ${t.toFixed(1)}  safe ${s.toFixed(1)}  adaptive ${a.toFixed(1)}  gamble ${g.toFixed(1)}  rounds ${cells[2].rounds.toFixed(1)}  broken ${cells[2].broken.toFixed(1)}`);
    assert.ok(a >= s - 1.5, `L${L.level}: adaptive ${a} should not trail safe ${s}`);
    if (L.level >= 3) assert.ok(t <= 1, `L${L.level}: turtle should be ~0, got ${t}`);
  }
  console.log(out.map((g) => `       ${g}`).join('\n'));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
