// Fuzz: long, chaotic fights with the expansion modules on, checking the
// invariants a unit test cannot reach because they only break in sequences
// nobody would think to write down.
//
// This exists because it found something. The first run of 4,000 fights threw
// 143 times, all from one root cause: js/game/strategies.js picked the Run card
// by looking for `.hides` without asking whether it was affordable, and Snared
// had made it not. The engine refused, correctly, and the caller had never
// asked. Two callers had the same shape. On the site that is a button that
// looks enabled and takes the run down with it.
//
// The lesson generalises past that one bug, which is why this is a permanent
// test rather than a fix: every guard added to the engine must ALSO appear in
// the predicate that decides whether the action is offered. legalAttacks() and
// canHide() are that predicate. A rule enforced only where it is used is half
// a rule, and the half that is missing is the half a player meets.
//
// Trial count is deliberately modest so `make test` stays quick. For a real
// sweep run it directly with a bigger number:  node tests/fuzz.test.mjs 20000
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { useCards } from '../js/data/cards.js';
import { useExpansions, objectFor } from '../js/data/expansions.js';
import * as E from '../js/game/engine.js';
import { MARK_IDS } from '../js/game/marks.js';
import { playTurn } from '../js/game/strategies.js';
import { rng } from '../js/utils.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = useCards(JSON.parse(readFileSync(join(root, 'data/cards.json'), 'utf8')));
const mods = useExpansions(JSON.parse(readFileSync(join(root, 'data/expansions.json'), 'utf8')));
const TRIALS = Number(process.argv[2] || 600);

const BIOMES = ['volcano', 'river', 'mountain', 'desert', 'forest', 'village', 'castle'];
const STYLES = ['turtle', 'safe', 'adaptive', 'gamble'];
const PHASES = ['act', 'boss', 'down', 'won', 'lost', 'stall'];
const KLASSES = [null, 'knight', 'mage', 'hunter', 'necromancer'];
const ADV = data.advantage.map((c) => c.id);
const DM_STYLES = ['friendly', 'assisted', 'hardcore'];

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}

test(`${TRIALS} chaotic fights break no invariant and never throw`, () => {
  const breaks = [];
  const note = (why, f) => breaks.push(`${why} (round ${f.round}, phase ${f.phase}, body ${f.boss.body})`);
  const next = rng(4242);

  for (let n = 0; n < TRIALS; n++) {
    const boss = data.boss[Math.min(5, Math.floor(next() * 6))];
    const biome = BIOMES[Math.floor(next() * BIOMES.length)];
    const style = STYLES[Math.floor(next() * STYLES.length)];
    const f = E.newFight(data, {
      level: 1 + Math.floor(next() * 5), boss, biome: { id: biome, element: null },
      hero: {
        element: 'fire', klass: KLASSES[Math.floor(next() * KLASSES.length)], attacks: data.attack,
        pool: Array.from({ length: 4 + Math.floor(next() * 8) }, () => 'fire'),
      },
      // Every dial at once: the break points and the Advantage hand are base
      // game, not module, and stacking modules on an unfuzzed base is how a
      // latent bug gets six new suspects.
      advantage: ADV.filter(() => next() < 0.4),
      dm: next() < 0.5 ? {
        on: true, style: DM_STYLES[Math.floor(next() * 3)],
        cap: 1 + Math.floor(next() * 3), step: 'hard', wound: 50, cripple: 25,
      } : null,
      die: 'd20', mode: ['story', 'standard', 'nightmare'][Math.floor(next() * 3)],
      secondWind: next() < 0.5,
    });

    let guard = 0;
    while (f.phase === 'act' && guard++ < 60) {
      // Chaos: marks land on anybody at any time, objects get used, marks get
      // shaken. A real table is not this hostile; the point is that nothing
      // here is illegal, so nothing here may throw.
      if (next() < 0.35) {
        const t = next() < 0.5 ? 'hero'
          : (f.boss.minions.length && next() < 0.4 ? Math.floor(next() * f.boss.minions.length) : 'body');
        E.applyMark(f, t, MARK_IDS[Math.floor(next() * MARK_IDS.length)]);
      }
      const obj = objectFor(mods, biome);
      if (obj && next() < 0.2 && E.canUseObject(f, obj)) {
        E.useObject(f, obj, next() < 0.3 && f.boss.minions.length ? 0 : 'body');
      }
      if (next() < 0.2 && E.canShake(f)) E.shake(f);
      // Advantage cards, played at random legal moments. Barrier is excluded:
      // it is played through resolveBoss, not from the hand.
      if (next() < 0.25 && f.hero.advantage.length) {
        const pick = f.hero.advantage.filter((id) => id !== 'barrier');
        if (pick.length) {
          const r = E.playAdvantage(f, pick[Math.floor(next() * pick.length)]);
          if (r.draw) for (let k = 0; k < r.draw; k++) f.hero.advantage.push(ADV[Math.floor(next() * ADV.length)]);
        }
      }
      if (f.phase !== 'act') break;

      playTurn(f, style, next, () => null);
      // Break a part whenever the window a landed attack opened is still open,
      // and reroll whenever the Hunter is owed one.
      if (next() < 0.5 && E.canBreak(f)) {
        E.breakPart(f, { roll: 1 + Math.floor(next() * 20), part: 'a horn' });
      }
      if (next() < 0.4 && f.hero.lastMiss && !f.hero.hunterUsed) E.reroll(f, { u: next() });
      while (f.phase === 'down') E.attemptRevive(f, { u: next() });
      if (f.phase !== 'act') break;
      E.endTurn(f);
      while (f.phase === 'down') E.attemptRevive(f, { u: next() });
      while (f.phase === 'boss') {
        E.bossRoll(f, 1 + Math.floor(next() * 6));
        E.resolveBoss(f, {});
        while (f.phase === 'down') E.attemptRevive(f, { u: next() });
        if (f.phase === 'down') break;
      }

      if (f.boss.body < 0) note('boss body went negative', f);
      if (!Number.isFinite(f.boss.body)) note('boss body is not finite', f);
      if (!f.boss.minions.every((m) => m.hp > 0 && Number.isFinite(m.hp))) note('a dead or NaN minion is still standing', f);
      if (!PHASES.includes(f.phase)) note(`bogus phase ${f.phase}`, f);
      if (f.actionsLeft < 0) note('negative actions left', f);
      if (f.boss.body > f.boss.maxHp) note('boss healed past its maximum', f);
      if (f.hero.pool.some((c) => !['ready', 'spent', 'broken'].includes(c.st))) note('a life card is in no known state', f);
      if (f.hero.ally && !(f.hero.ally.def > 0)) note('an ally with no defense is still standing', f);
      if (f.boss.breaks < 0) note('negative break count', f);
      if (f.round > E.MAX_ROUNDS + 1) note('the round cap did not hold', f);
      for (const fig of [f.hero, f.boss, ...f.boss.minions]) {
        if (!Object.keys(fig.marks || {}).every((k) => MARK_IDS.includes(k))) note('unknown mark id on a figure', f);
      }
      // The save path. A run that cannot be serialised is a run that is lost,
      // and events.js saves BEFORE it renders, so a corrupt fight persists.
      const json = JSON.stringify(f);
      if (JSON.parse(json).boss.body !== f.boss.body) note('rehydrate lost the boss body', f);
    }
    if (guard >= 60) note('fight never terminated', f);
  }

  const summary = [...new Set(breaks)].slice(0, 8).join('\n       ');
  assert.equal(breaks.length, 0, `${breaks.length} invariant break(s):\n       ${summary}`);
});

test('every refusal the engine can throw is visible in the predicate that offers the action', () => {
  // The exact shape of the bug this file was written for. If a future guard is
  // added to hide() or to the Run branch of attack() without teaching
  // legalAttacks/canHide about it, this fails rather than the fuzz loop, and
  // the failure names the rule.
  const boss = data.boss.find((b) => b.size === 'M');
  const f = E.newFight(data, {
    level: 1, boss, biome: { id: 'forest', element: null }, noSignatures: true,
    hero: { element: 'fire', klass: null, pool: ['fire', 'fire', 'fire', 'fire'], attacks: data.attack },
    die: 'd20', mode: 'standard',
  });
  const runOf = (g) => E.legalAttacks(g).find((a) => a.hides);
  assert.equal(runOf(f).canAfford, true, 'Run is offered when nothing stops it');
  assert.equal(E.canHide(f), true, 'and so is the Forest hide');

  E.applyMark(f, 'hero', 'snared');
  assert.equal(runOf(f).canAfford, false, 'Snared must make Run unofferable, not merely unplayable');
  assert.equal(runOf(f).stopped, true, 'and say why, so the hand can explain the grey button');
  assert.equal(E.canHide(f), false, 'and the Forest hide too');
  assert.throws(() => E.attack(f, runOf(f), {}), /Snared/, 'the engine still refuses if asked anyway');
  assert.throws(() => E.hide(f), /Snared/);

  E.shake(f);
  assert.equal(runOf(f).canAfford, true, 'and shaking it off puts both back');
  assert.equal(E.canHide(f), true);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
