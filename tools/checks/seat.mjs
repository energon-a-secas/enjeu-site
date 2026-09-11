#!/usr/bin/env node
// ── M6 The Boss Seat, measured against the die ───────────────
//
//     node tools/checks/seat.mjs [trials]
//
// The claim this exists to test is the one the module refuses to print. An
// earlier design said "the boss player can never hit harder than the die, only
// choose when", and a review measured that it was false inside a fight and that
// the module came out EASIER than the die, because drawing six cards without
// replacement deletes the variance the difficulty is made of: two Ruins inside
// four rounds is 13.2% under a die and impossible under a six-card cycle.
//
// This build sweeps every THREE cards instead of six, so the cycle turns over
// inside a 3.4-to-5.5 round fight and repeats come back. Whether that is enough
// is a measurement, not an argument, which is what this file is.
//
// Two boss policies, because one of them is not a policy at all:
//   greedy    always commits the biggest card it holds. This is what the first
//             harness did, and it never makes the WHEN decision the seat is for:
//             it dumps Ruin the instant the gate opens.
//   patient   holds Ruin for the Rage round, plays the biggest otherwise. This
//             is what the rulebook actually teaches.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { useCards } from '../../js/data/cards.js';
import { newFight, endTurn, bossRoll, resolveBoss, attemptRevive, raging } from '../../js/game/engine.js';
import { playTurn } from '../../js/game/strategies.js';
import { newSeat, playable, commit, reveal, refill } from '../../js/game/seat.js';
import { rng } from '../../js/utils.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const data = useCards(JSON.parse(readFileSync(join(root, 'data/cards.json'), 'utf8')));
const N = Number(process.argv[2] || 4000);
const STYLES = ['turtle', 'safe', 'adaptive', 'gamble'];
const ORDER = ['boss-m', 'boss-l', 'boss-l2', 'boss-xl', 'boss-um'];
const CARDS = { 1: 4, 2: 5, 3: 6, 4: 7, 5: 8 };
// How much a face hurts, for a boss player deciding what to spend.
const WEIGHT = { ruin: 4, roar: 3, strike: 2, summon: 1, brace: 0 };

const shuffleWith = (next) => (a) => {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

function build(level) {
  return newFight(data, {
    level,
    boss: data.boss.find((b) => b.id === ORDER[level - 1]),
    hero: {
      element: 'fire', klass: null, attacks: data.attack,
      pool: Array.from({ length: CARDS[level] }, (_, i) => (i < 4 ? 'fire' : 'extra')),
    },
    die: 'd20', mode: 'standard',
  });
}

/** Which card the boss player commits this round. */
function choose(seat, f, policy) {
  const opts = playable(seat, f.round);
  if (!opts.length) return 0;
  const rage = raging(f);
  const ranked = [...opts].sort((a, b) => WEIGHT[b.id] - WEIGHT[a.id]);
  if (policy === 'patient' && !rage) {
    // Hold the hammer for the round it lands hardest.
    const notRuin = ranked.filter((c) => c.id !== 'ruin');
    if (notRuin.length) return seat.hand.indexOf(notRuin[0]);
  }
  return seat.hand.indexOf(ranked[0]);
}

function fight(level, style, next, seatStyle, policy) {
  const f = build(level);
  const shuffle = shuffleWith(next);
  let seat = seatStyle ? newSeat(seatStyle, shuffle) : null;
  let guard = 0;
  while (f.phase === 'act' && guard++ < 30) {
    if (seat && !seat.committed) commit(seat, choose(seat, f, policy), raging(f));
    playTurn(f, style, next, () => null);
    while (f.phase === 'down') attemptRevive(f, { u: next() });
    if (f.phase !== 'act') break;
    endTurn(f);
    while (f.phase === 'down') attemptRevive(f, { u: next() });
    while (f.phase === 'boss') {
      const face = seat ? reveal(seat) : 1 + Math.floor(next() * 6);
      bossRoll(f, face);
      resolveBoss(f, {});
      if (seat) { seat = refill(seat, shuffle); delete seat.swept; }
      while (f.phase === 'down') attemptRevive(f, { u: next() });
      if (f.phase === 'down') break;
    }
  }
  return f.phase === 'won';
}

const row = (seatStyle, policy) => STYLES.map((style) =>
  [1, 2, 3, 4, 5].map((level) => {
    const next = rng(11 + level * 1000);
    let wins = 0;
    for (let i = 0; i < N; i++) if (fight(level, style, next, seatStyle, policy)) wins++;
    return (100 * wins) / N;
  }));

console.log(`M6 The Boss Seat, ${N} fights per cell\n`);
const die = row(null, null);
const fmt = (a) => a.map((x) => x.toFixed(1).padStart(5)).join(' ');
console.log('  the die (baseline)');
STYLES.forEach((s, i) => console.log(`    ${s.padEnd(9)} ${fmt(die[i])}`));

for (const policy of ['greedy', 'patient']) {
  for (const [seatStyle, label] of [['friendly', 'hand 1'], ['assisted', 'hand 2'], ['hardcore', 'hand 3']]) {
    const r = row(seatStyle, policy);
    console.log(`\n  ${label} (${policy})            delta against the die`);
    STYLES.forEach((s, i) => {
      const d = r[i].map((x, j) => x - die[i][j]);
      console.log(`    ${s.padEnd(9)} ${fmt(r[i])}   ${d.map((x) => `${x >= 0 ? '+' : ''}${x.toFixed(1)}`.padStart(6)).join(' ')}`);
    });
  }
}
console.log('\n  A POSITIVE delta means the seat is EASIER than the die, which is the');
console.log('  failure mode: a module that makes the game gentler while claiming to');
console.log('  be an opponent. Turtle level 1 is the cell to watch for the second');
console.log('  failure, a module quietly repairing the base game\'s known defect.');
