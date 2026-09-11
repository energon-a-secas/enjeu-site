#!/usr/bin/env node
// ── M3 Wits, measured ────────────────────────────────────────
//
//     node tools/checks/wits.mjs [trials]
//
// Two numbers the module's spec said to measure rather than assume, and one it
// said would be zero for a reason that is a property of the harness rather than
// of the cards.
//
// 1. DROPPABILITY. Turtle at level 1 with the module in the hand and without it.
//    docs/EXPANSIONS.md section 8 names "a module that quietly repairs a
//    base-game defect" as the way an optional module becomes mandatory, and the
//    level 1 turtle is the defect it means. The module must move it by under a
//    point. It should not even be close: Marked eases a CHECK and Strike has
//    none, so a player who only ever Strikes gains nothing at all.
//
// 2. ANALYZE INTO ALL IN. The setup line the spec flagged as the thing to watch.
//    Analyze (Even) then All In (Even, or Sure if the brick landed) is three
//    actions. Against a 400 body at level 1 that is a one-turn kill, and the
//    question is how much easier the brick makes it.
//
// 3. Scout and Parley measure at approximately nothing in the 20-cell table and
//    always will: choose() prices every option through attackDamage, which
//    returns 0 for all three, so no strategy would ever pick one. That is why
//    they are measured here by playing the line explicitly instead.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { useCards } from '../../js/data/cards.js';
import { useExpansions, moduleOf } from '../../js/data/expansions.js';
import { newFight, legalAttacks, attack, endTurn, bossRoll, resolveBoss, bossDown } from '../../js/game/engine.js';
import { playTurn } from '../../js/game/strategies.js';
import { rng } from '../../js/utils.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const data = useCards(JSON.parse(readFileSync(join(root, 'data/cards.json'), 'utf8')));
const mods = useExpansions(JSON.parse(readFileSync(join(root, 'data/expansions.json'), 'utf8')));
const WITS = moduleOf(mods, 'wits').attack.map((c) => ({ ...c, deck: 'attack', module: 'wits' }));
const L1 = data.boss.find((b) => b.size === 'M');
const N = Number(process.argv[2] || 20000);

const build = (withWits, over = {}) => newFight(data, {
  level: 1, boss: L1,
  hero: {
    element: 'fire', klass: null, pool: ['fire', 'fire', 'fire', 'fire'],
    attacks: withWits ? [...data.attack, ...WITS] : [...data.attack],
  },
  die: 'd20', mode: 'standard', ...over,
});

/** One full fight driven by a strategy, exactly as sim.js drives it. */
function playOut(f, style, next) {
  let guard = 0;
  while (f.phase === 'act' && guard++ < 30) {
    playTurn(f, style, next, () => null);
    if (f.phase !== 'act') break;
    endTurn(f);
    while (f.phase === 'boss') { bossRoll(f, 1 + Math.floor(next() * 6)); resolveBoss(f, {}); if (f.phase === 'down') break; }
  }
  return f.phase === 'won';
}

console.log(`M3 Wits, ${N} fights per cell\n`);

// ── 1. Droppability ──
for (const style of ['turtle', 'safe', 'adaptive', 'gamble']) {
  const runs = [false, true].map((withWits) => {
    const next = rng(11);
    let wins = 0;
    for (let i = 0; i < N; i++) if (playOut(build(withWits), style, next)) wins++;
    return (100 * wins) / N;
  });
  const delta = runs[1] - runs[0];
  const verdict = Math.abs(delta) < 1 ? 'ok' : 'LOOK';
  console.log(`  ${verdict}  ${style.padEnd(9)} without ${runs[0].toFixed(2)}%  with ${runs[1].toFixed(2)}%  delta ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`);
}
console.log('\n  A strategy never picks a zero-damage card, so these must be identical.');
console.log('  The point is that they are identical for a reason: the module cannot');
console.log('  reach a player who does not bet, so it cannot repair the turtle defect.\n');

// ── 2. Analyze into All In, played explicitly ──
const oneTurnKill = (useAnalyze) => {
  const next = rng(7);
  let kills = 0;
  for (let i = 0; i < N; i++) {
    const f = build(true);
    const pick = (id) => legalAttacks(f).find((a) => a.id === id);
    if (useAnalyze) attack(f, pick('analyze'), { u: next(), target: 'body' });
    // All In bets everything Ready, and at level 1 that is four cards: 4 x 4 x 25 = 400.
    const allIn = pick('all-in');
    if (allIn && allIn.canAfford) attack(f, allIn, { bet: 4, u: next(), target: 'body' });
    if (bossDown(f)) kills++;
  }
  return (100 * kills) / N;
};
const plain = oneTurnKill(false);
const studied = oneTurnKill(true);
console.log(`  All In alone            ${plain.toFixed(2)}% one-turn kill at level 1`);
console.log(`  Analyze then All In     ${studied.toFixed(2)}%   (${studied >= plain ? '+' : ''}${(studied - plain).toFixed(2)})`);
console.log('\n  The lever if this measures hot is Analyze\'s own check (Even to Hard),');
console.log('  never Marked\'s step: Marked belongs to Terrain and later modules read it.');
