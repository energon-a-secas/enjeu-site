// Contract C3 (engine) and C4 (strategies). Two halves:
//   1. unit rules: each rule the rulebook states, exercised and tripped
//   2. parity: in legacy mode the JS table must land on docs/BALANCE.md
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { useCards } from '../js/data/cards.js';
import { newFight, legalAttacks, attack, reroll, hide, endTurn, bossRoll, resolveBoss, take, playAdvantage, ready, spent, broken, bossHp, bossDown, effectiveStep, reviveStep, attemptRevive, canRevive, bossFaceDamage, MAX_ROUNDS } from '../js/game/engine.js';
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
  level: 1, boss: L1, hero: { element: 'fire', klass: null, pool: ['fire', 'fire', 'fire', 'fire'], attacks: data.attack },
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
  // The level 1 boss's signature owns roll 1 (Skitter) since v1.2, so the plain
  // Brace is exercised on the level 4 boss, whose signature sits on roll 6.
  for (const legacy of [false, true]) {
    const f = basic({ legacy, boss: data.byId['boss-xl'] });
    endTurn(f); bossRoll(f, 1); resolveBoss(f);     // Brace at the end of round 1
    assert.equal(f.round, 2);
    const focus = legalAttacks(f).find((a) => a.id === 'focus');
    const r = attack(f, focus, { roll: 20 });
    assert.equal(r.dealt, legacy ? 75 : 25, `legacy=${legacy}: 75 halved to 25 rounded down`);
  }
});

test('Summon moves 2 x per-card off the body (legacy: flat 100); capped at 3 minions; boss falls only when all cards are gone', () => {
  // Every boss life card is 100 since 2026-08-28, so two of them is 200 at every
  // level. That uniformity is the point of the change: a minion is the same size
  // wherever you meet it, and the player never divides.
  const f = basic();
  endTurn(f); bossRoll(f, 4); resolveBoss(f);
  assert.equal(f.boss.minions.length, 1); assert.equal(f.boss.minions[0].hp, 200); assert.equal(f.boss.body, 200);
  assert.equal(bossHp(f), 400);
  f.boss.body = 0;
  assert.equal(bossDown(f), false, 'a minion still carries the boss\'s life');
  const g = basic({ legacy: true, boss: data.byId['boss-um'] });
  endTurn(g); bossRoll(g, 4); resolveBoss(g);
  assert.equal(g.boss.minions[0].hp, 100, 'legacy: sim.py moves a flat 100');
  g.boss.body = 0; assert.equal(bossDown(g), true, 'legacy: body alone ends it');
  // Cap at 3, on a boss with the body to reach it. Level 1 is 4 cards of 100 and
  // a Summon needs body > 200, so the tutorial boss can summon exactly once now:
  // the cap has to be exercised on a big boss or the test proves nothing.
  const h = basic({ boss: { ...data.byId['boss-um'], rage: 99, damage: 0 } });
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
  attack(f, allIn, { bet: 4, target: 0, roll: 20 });   // 400 at the 200hp minion
  assert.equal(f.boss.minions.length, 0); assert.equal(f.hero.pool.length, 5, 'one boss card pocketed');
  assert.equal(f.boss.body, 200, 'minion overflow does not spill to the body');
});

/**
 * Run shipped for an hour as a 1-action, no-bet card dealing up to 75 damage,
 * because data/cards.json knew what `hides` meant and js/ did not. All 124 tests
 * passed in that state. These are the assertions that would have caught it.
 */
test('Run deals nothing, costs an action and no card, and Hides you', () => {
  const f = basic();
  const run = legalAttacks(f).find((a) => a.id === 'run');
  assert.ok(run, 'Run is dealt into the hand');
  const before = bossHp(f);
  const r = attack(f, run, {});
  assert.equal(r.dealt, 0, 'Run deals no damage at all');
  assert.equal(bossHp(f), before, 'and the boss loses nothing');
  assert.equal(ready(f), 4, 'it bets no card');
  assert.equal(f.actionsLeft, 2, 'it costs exactly one action');
  assert.equal(f.hero.hidden, true);
});

test('Hidden: the boss Strike misses entirely, everything else is halved', () => {
  // Asserted on the log, not on ready(), because resolveBoss ends by starting the
  // next round and Recover stands every Spent card back up: counting Ready after
  // the fact shows 4 whatever happened, which is how the first draft of this test
  // passed a miss and a full hit identically.
  const guarded = (f) => f.log.map((l) => l.text || l).find((t) => t.startsWith('Guarded ')) || 'nothing';
  const play = (roll) => {
    const f = basic();
    attack(f, legalAttacks(f).find((a) => a.id === 'run'), {});
    endTurn(f); bossRoll(f, roll); resolveBoss(f);
    return f;
  };
  const miss = play(2);                       // Strike, 50 at level 1
  assert.match(miss.log.map((l) => l.text || l).join('|'), /the Strike goes past you/);
  assert.equal(guarded(miss), 'nothing', 'a Strike must cost a Hidden hero nothing at all');
  const roar = play(5);                       // Roar, 50 -> 25
  assert.match(guarded(roar), /^Guarded 25 with 1 Ready card/, 'Roar is halved, not dodged');
  const ruin = play(6);                       // Ruin, 100 -> 50
  assert.match(guarded(ruin), /^Guarded 50 with 2 Ready cards/, 'Ruin is halved, not dodged');
  for (const f of [miss, roar, ruin]) assert.equal(f.hero.hidden, false, 'the boss spends it either way');
});

test('a minion never spends your Hidden, and Summon is not a counter to Run', () => {
  // minionStrikes runs before bossRoll. While a minion could consume Hidden, one
  // Summon permanently blanked the card: every later Run soaked 25 of chip damage
  // while the boss's own hit landed whole.
  const f = basic();
  endTurn(f); bossRoll(f, 4); resolveBoss(f);          // a minion is on the table
  assert.equal(f.boss.minions.length, 1);
  attack(f, legalAttacks(f).find((a) => a.id === 'run'), {});
  assert.equal(f.hero.hidden, true);
  endTurn(f);                                          // the minion strikes here
  assert.equal(f.hero.hidden, true, 'the minion must not have spent it');
  bossRoll(f, 2); resolveBoss(f);
  assert.equal(f.hero.hidden, false, 'the boss did');
});

test('covering the Ally breaks cover, so a Hidden hero cannot shield it for free', () => {
  const f = basic();
  f.hero.ally = { def: 50 };
  attack(f, legalAttacks(f).find((a) => a.id === 'run'), {});
  endTurn(f);
  const p = bossRoll(f, 2);
  assert.equal(p.at, 'ally', 'the Strike is aimed at the Ally');
  resolveBoss(f, { cover: true });
  assert.equal(f.hero.hidden, false, 'cover breaks the hide');
  const text = f.log.map((l) => l.text || l).join('|');
  assert.match(text, /break cover to shield the Ally/);
  assert.match(text, /Guarded 50 with 2 Ready cards/, 'the hero takes the Strike whole, not halved and not dodged');
  assert.ok(f.hero.ally, 'and the Ally is still standing, which is what covering bought');
});

test('Strike no longer grants a free Hide: Run is the only way to hide', () => {
  // It used to arm hideAvailable on every Strike, which made Run strictly worse
  // than Strike (same Hidden, plus 25 damage, same one action).
  const f = basic();
  attack(f, legalAttacks(f).find((a) => a.id === 'strike'), {});
  assert.equal(f.hero.hideAvailable, false, 'a Strike must not arm a free Hide');
  assert.equal(f.hero.hidden, false);
  // The Forest still does, which is the terrain rule.
  const g = basic({ biome: { id: 'forest' } });
  assert.equal(g.hero.hideAvailable, true, 'the Forest gives one free Run a round');
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

test('the Forest gives a free Run; Knight guards 25 free once per round (not under Rage)', () => {
  // Hide used to be free after any Strike. It is now the Run card, and only the
  // Forest still gives it away, which is what a biome full of cover should do.
  const f = basic({ biome: { id: 'forest' }, hero: { element: 'fire', klass: 'knight', pool: ['fire', 'fire', 'fire', 'fire'], attacks: data.attack } });
  const plain = basic({ hero: { element: 'fire', klass: 'knight', pool: ['fire', 'fire', 'fire', 'fire'], attacks: data.attack } });
  assert.throws(() => hide(plain), /Run/, 'outside the Forest, hiding costs the card');
  hide(f);                                             // free, and no Strike needed
  endTurn(f); bossRoll(f, 6); resolveBoss(f);          // Ruin 100 -> hidden 50 -> knight 25 -> one Ready card spent
  assert.deepEqual([ready(f), spent(f), broken(f)], [4, 0, 0].map((v, i) => i === 0 ? 4 : v), 'round 2 started, recovered');
  assert.ok(f.log.some((l) => /Knight guards/.test(l.text)) && f.log.some((l) => /halved to 50/.test(l.text)));
  const g = basic({ hero: { element: 'fire', klass: 'knight', pool: ['fire', 'fire', 'fire', 'fire'], attacks: data.attack } });
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

// ── The Ally (RULES.md section 7, "The Ally") ────────────────
// The card was a boolean until the boss could aim at it, so every one of these
// checks an interaction that did not exist before and none of them can be
// inferred from another. The 50 is ALLY_DEF, and the whole point of the number
// is that it is exactly the level 1 and 2 Damage.
const withAlly = (over = {}) => {
  const f = basic({ advantage: ['ally'], ...over });
  playAdvantage(f, 'ally');
  return f;
};
const bossActs = (f, d6, opts) => { if (f.phase === 'act') endTurn(f); const p = bossRoll(f, d6); resolveBoss(f, opts); return p; };
// `spent` cannot be read after resolveBoss: it starts the next round, and Recover
// stands every Spent card back up. What the hero guarded survives only in the log.
const guarded = (f) => f.log.reduce((n, l) => { const m = /Guarded (\d+) with/.exec(l.text); return m ? n + Number(m[1]) : n; }, 0);

test('the Ally absorbs a level 1 Strike whole and stays: 50 damage against 50 defense', () => {
  const f = withAlly();
  const p = bossActs(f, 2);                        // Strike, 50 at level 1
  assert.equal(p.at, 'ally', 'the die decides who it is aimed at');
  assert.equal(p.dmg, 50);
  assert.ok(f.hero.ally, 'still standing');
  assert.deepEqual([ready(f), spent(f), broken(f)], [4, 0, 0], 'nothing reached the hero');
});

test('a Strike bigger than 50 sends the Ally away, and still nothing reaches the hero', () => {
  const f = withAlly({ boss: data.byId['boss-l2'] });   // level 3: Damage 75
  const p = bossActs(f, 2);
  assert.equal(p.dmg, 75);
  assert.equal(f.hero.ally, null, 'the figure comes off the table');
  assert.equal(guarded(f), 0, 'the Ally ate the whole hit, not just its 50');
  assert.equal(broken(f), 0);
  // And the next Strike has nobody to hit but the hero.
  assert.equal(bossActs(f, 2).at, 'hero');
  assert.equal(guarded(f), 75, 'guarded with three Ready cards');
});

test('covering the Ally takes the hit whole onto the hero and keeps the figure', () => {
  const f = withAlly();
  const p = bossActs(f, 2, { cover: true });
  assert.equal(p.at, 'ally');
  assert.ok(f.hero.ally, 'the figure stays');
  assert.equal(guarded(f), 50, 'the hero guarded all 50, not 50 minus the defense');
  assert.ok(f.log.some((l) => /cover the Ally/.test(l.text)));
});

test('only a Strike is aimed at the Ally: Roar, Ruin, Brace and a real Summon come for you', () => {
  for (const [d6, name] of [[1, 'Brace'], [4, 'Summon'], [5, 'Roar'], [6, 'Ruin']]) {
    const f = withAlly();
    if (f.phase === 'act') endTurn(f);
    assert.equal(bossRoll(f, d6).at, 'hero', name);
    assert.ok(f.hero.ally, `${name} left the Ally alone`);
  }
});

test('a Summon that cannot summon is a Strike, and a Strike is aimed at the Ally', () => {
  const f = withAlly();
  f.boss.body = 50;                                 // too little to move 2 cards under a minion
  if (f.phase === 'act') endTurn(f);
  const p = bossRoll(f, 4);
  assert.equal(p.name, 'Strike', 'the downgrade happened');
  assert.equal(p.at, 'ally', 'and `at` was read after it, not before');
});

test('Rage goes through everything: the boss ignores the Ally and comes for you', () => {
  const f = withAlly();
  f.round = 4;                                      // rage round for level 1
  f.phase = 'boss';
  const p = bossRoll(f, 2);
  assert.equal(p.dmg, 100, 'doubled');
  assert.equal(p.at, 'hero', 'a raging Strike is not a hit you can hand to somebody else');
  resolveBoss(f);
  assert.ok(f.hero.ally, 'the Ally is untouched, not consumed');
  assert.equal(broken(f), 4, 'and the hero took all of it, unguarded');
});

test('Barrier beats cover: a cancelled Strike deals nothing to the hero or the Ally', () => {
  const f = withAlly({ advantage: ['ally', 'barrier'] });
  bossActs(f, 2, { barrier: true, cover: true });
  assert.ok(f.hero.ally);
  assert.equal(guarded(f), 0);
  assert.equal(broken(f), 0);
});

test('minions always strike the hero, never the Ally', () => {
  const f = withAlly();
  f.boss.minions.push({ hp: 100, max: 100 });
  endTurn(f);                                       // the minion line runs inside endTurn
  assert.ok(f.hero.ally, 'a minion has no business with the Ally');
  assert.equal(spent(f), 1, 'the hero guarded its 25');
});

test('legacy leaves the Ally out of it entirely, so BALANCE.md parity cannot move', () => {
  const f = withAlly({ legacy: true });
  if (f.phase === 'act') endTurn(f);
  assert.equal(bossRoll(f, 2).at, 'hero');
  resolveBoss(f);
  assert.equal(guarded(f), 50, 'the hero took it, exactly as before the rule existed');
  assert.ok(!f.log.some((l) => /Ally/.test(l.text) && /takes it|falls/.test(l.text)));
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

// Not async: `test` runs fn() inside a try and counts a pass the moment a
// Promise comes back, so an async test's assertions were never waited on. This
// one was async only to dynamically import what is now imported at the top.
test('Second Wind: first comeback free, then the ladder climbs, and it resets each level', () => {
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

test('a comeback resumes the step that felled you, it does not hand back a free turn', () => {
  // The bug: attemptRevive read `f.phase = f.pending ? 'boss' : 'act'`, and
  // resolveBoss nulls pending BEFORE applying damage, so the condition was never
  // true. Every revived hero got a turn the boss phase never finished: no
  // Recover, no round increment, no Castle second act, no stall cap.

  // 1. Felled by the boss's reaction: the round it interrupted still ends.
  const f = basic({ secondWind: true });
  f.boss.damage = 500;
  endTurn(f);
  bossRoll(f, 6);                                  // Ruin, double damage
  resolveBoss(f);
  assert.equal(f.phase, 'down', 'set the fight up wrong: nothing felled the hero');
  assert.deepEqual(f.fell, { at: 'boss' }, 'the engine records where the fall happened');
  const r = attemptRevive(f, {});
  assert.equal(r.ok, true);
  assert.equal(f.round, 2, 'the round the boss phase owed the hero');
  assert.equal(f.phase, 'act');
  assert.equal(f.actionsLeft, 3, 'a resumed turn is a real turn, with its three actions');
  assert.equal(f.fell, null, 'the record is consumed, not left to fire twice');

  // 2. Felled by a minion mid-line: the rest of the line still strikes. Coming
  //    back does not clear the table.
  const g = basic({ secondWind: true });
  g.boss.minions = [{ hp: 50, max: 50 }, { hp: 50, max: 50 }];
  for (const c of g.hero.pool) c.st = 'broken';    // nothing left to guard with
  endTurn(g);
  assert.equal(g.phase, 'down', 'the first minion felled the hero');
  assert.equal(g.fell.left, 1, 'one minion is still owed a strike');
  assert.equal(attemptRevive(g, {}).ok, true);
  assert.equal(g.log.filter((l) => l.text.includes('A minion strikes')).length, 2, 'both minions struck');
  assert.equal(spent(g), 1, 'the second strike was guarded with one of the cards the comeback stood up');
  assert.equal(g.phase, 'boss', 'the line ends where endTurn would have left it, waiting on the boss roll');

  // 3. Castle round 1: the boss owes a second act, and a comeback does not cancel it.
  const h = basic({ secondWind: true, biome: { id: 'castle' } });
  h.boss.damage = 500;
  endTurn(h);
  bossRoll(h, 6);
  resolveBoss(h);
  assert.equal(h.phase, 'down');
  const rh = attemptRevive(h, {});
  assert.equal(rh.resumed, 'again', 'the caller is told Castle acts again');
  assert.equal(h.phase, 'boss', 'still the boss phase, waiting on the second roll');
  assert.equal(h.round, 1, 'the round does not advance while an act is owed');

  // 4. The stall cap is part of that tail too, so it cannot be dodged by dying.
  const k = basic({ secondWind: true });
  k.boss.damage = 500;
  k.round = MAX_ROUNDS;
  endTurn(k);
  bossRoll(k, 6);
  resolveBoss(k);
  assert.equal(k.phase, 'down');
  assert.equal(attemptRevive(k, {}).ok, true);
  assert.equal(k.phase, 'stall', 'a comeback on the last round is still a stall');
});

// ── 2. Strategies ────────────────────────────────────────────
test('affordable: a budget of 0 buys only the cards that cost no card; pKill of 3 Strikes vs 75 is 1', () => {
  const f = basic();
  const t = affordable(f, 0);
  // Strike, Bubble and Run all bet nothing, so a turtle on budget 0 can reach
  // any combination of the three. What must stay true is that nothing needing a
  // card gets in, and that three Strikes is still one of the lines.
  assert.ok(t.every((c) => c.every((a) => (a.bet || 0) === 0)), 'no card-betting attack fits a zero budget');
  assert.ok(t.some((c) => c.length === 3 && c.every((a) => a.id === 'strike')), 'three Strikes is still reachable');
  const threeStrikes = t.find((c) => c.length === 3 && c.every((a) => a.id === 'strike'));
  assert.equal(pKill(f, threeStrikes, 75), 1);
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

// ── v1.2: signature moves ────────────────────────────────────
test('each boss overrides exactly its one signature row; legacy mode never does', () => {
  // Skitter (L1, roll 1): no damage, off balance, next landed hit +25.
  const f = basic();
  endTurn(f); bossRoll(f, 1);
  assert.equal(f.pending.sig, 'skitter'); resolveBoss(f);
  assert.deepEqual([ready(f), broken(f)], [4, 0], 'Skitter deals nothing');
  const r = attack(f, legalAttacks(f).find((a) => a.id === 'focus'), { roll: 20 });
  assert.equal(r.dealt, 100, 'off balance pays +25 on the next landed hit');
  const r2 = attack(f, legalAttacks(f).find((a) => a.id === 'strike'), {});
  assert.equal(r2.dealt, 25, 'and only once');
  const g = basic({ legacy: true });
  endTurn(g); bossRoll(g, 1);
  assert.equal(g.pending.sig, undefined, 'legacy mode has never heard of signatures');
});

test('Coil summons a minion that strikes at once; Bedrock repairs 25 of the wall', () => {
  const c = basic({ boss: data.byId['boss-l'] });
  endTurn(c); bossRoll(c, 4); resolveBoss(c);
  assert.equal(c.boss.minions.length, 1);
  assert.ok(c.log.some((l) => /strikes at once/.test(l.text)), 'the immediate strike is said');
  const b = basic({ boss: data.byId['boss-l2'] });
  b.boss.body = 900;
  endTurn(b); bossRoll(b, 1); resolveBoss(b);
  assert.equal(b.boss.body, 925, 'Bedrock grinds 25 back into the wall');
  assert.equal(b.boss.braced, true, 'and it is a Brace');
});

test('Stormbreak Ruins the unguarded twice; Hoard steals, or Roars at an empty table', () => {
  // Guarded: one Ruin, no more. The Bubble makes both halves observable
  // without felling the small test hero.
  const x = basic({ boss: data.byId['boss-xl'] });
  x.hero.shield = 300;
  endTurn(x); bossRoll(x, 6);
  assert.equal(x.pending.dmg, 200, 'a Ruin: twice Damage 100, pre-Rage');
  resolveBoss(x);
  // The shield is 0 either way (an unused Bubble pops at round start), so the
  // observables are the break count and the log.
  assert.equal(broken(x), 0, 'one Ruin of 200, absorbed whole');
  assert.ok(!x.log.some((l) => /Ruins AGAIN/.test(l.text)), 'a guarded hero is never doubled');
  // Naked: every card spent, so the storm Ruins again. 200 into the shield,
  // then 100 more breaking four spent cards proves the second take landed.
  const n = basic({ boss: data.byId['boss-xl'] });
  n.hero.shield = 300;
  for (const c of n.hero.pool) c.st = 'spent';
  endTurn(n); bossRoll(n, 6); resolveBoss(n);
  assert.equal(broken(n), 4, 'the second Ruin got past the shield and broke the spent cards');
  assert.ok(n.log.some((l) => /Ruins AGAIN/.test(l.text)), 'the double is said out loud');
  // Hoard with a card standing: steals INSTEAD of dealing.
  const u = basic({ boss: data.byId['boss-um'] });
  u.boss.body = 1900;
  endTurn(u); bossRoll(u, 5); resolveBoss(u);
  assert.equal(u.hero.pool.length, 3, 'one card is GONE, not broken');
  assert.equal(u.boss.body, 1925, 'and its 25 joined the wall');
  assert.equal(broken(u), 0, 'and no damage came with it');
  // Hoard with nothing standing: a plain Roar, penalty and all.
  const v = basic({ boss: data.byId['boss-um'] });
  for (const c of v.hero.pool) c.st = 'spent';
  endTurn(v); bossRoll(v, 5); resolveBoss(v);
  assert.equal(v.hero.pool.length, 4, 'nothing to steal, nothing stolen');
  assert.equal(broken(v), 4, 'the Roar lands as damage instead');
  assert.equal(v.hero.penalty, true, 'with the usual Roar penalty');
});

test('Taunt: the foretold die binds bossRoll, and choose() spends the knowledge', () => {
  const f = basic({ hero: { element: 'fire', klass: 'knight', pool: ['fire', 'fire', 'fire', 'fire'], attacks: [...data.attack, data.byId.taunt] } });
  const taunt = legalAttacks(f).find((a) => a.foretells);
  assert.ok(taunt, 'the Knight is dealt Taunt');
  const r = attack(f, taunt, { roll: 1 });
  assert.equal(r.roll, 1); assert.equal(f.foretold, 1);
  assert.equal(f.actionsLeft, 2, 'information costs an action');
  assert.equal(bossFaceDamage(f, 1), 0, 'a foretold signature is priced too');
  const combo = choose(f, 'safe');
  assert.ok(combo.reduce((a, x) => a + (x.betN || 0), 0) >= 2, 'safe stops reserving against a hit it knows is nothing');
  endTurn(f); bossRoll(f, 6);
  assert.equal(f.pending.roll, 1, 'the boss is bound by the die everyone saw');
  assert.equal(f.foretold, null, 'and the foretelling is spent');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
