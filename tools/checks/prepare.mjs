#!/usr/bin/env node
// ── M2 Preparation, measured ─────────────────────────────────
//
//     node tools/checks/prepare.mjs [trials]
//
// The strategies in js/game/strategies.js will never pick Prepare: choose()
// prices every option through attackDamage and Prepare returns 0, so it is
// invisible to the 20-cell table. That is a property of the harness, not of the
// card, so the card is driven EXPLICITLY here, exactly as tools/checks/taunt.mjs
// does for the Knight's Taunt.
//
// The player modelled is the dangerous one: a turtle. It never bets a life card,
// so it holds the maximum Ready cards, which is why the base game's own defect
// lives there. Three variants of the same turtle:
//
//   plain        three Strikes a round, the shipped strategy
//   early        Prepare FIRST, then Strike twice. The Charge is cashed on the
//                turn it was bought, which makes Prepare a strictly better
//                Strike. This is the version the rule exists to forbid.
//   last         Strike twice, then Prepare with the last action. The Charge has
//                to survive the boss's turn to be worth anything.
//
// If `early` is far above `plain` and `last` is not, the last-action clause is
// carrying the module and belongs in the rulebook. If `last` is also hot, the
// module is a problem regardless of the clause.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { useCards } from '../../js/data/cards.js';
import { useExpansions, moduleOf } from '../../js/data/expansions.js';
import { newFight, legalAttacks, attack, endTurn, bossRoll, resolveBoss, hasMark } from '../../js/game/engine.js';
import { rng } from '../../js/utils.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const data = useCards(JSON.parse(readFileSync(join(root, 'data/cards.json'), 'utf8')));
const mods = useExpansions(JSON.parse(readFileSync(join(root, 'data/expansions.json'), 'utf8')));
const PREPARE = { ...moduleOf(mods, 'prep').attack[0], deck: 'attack', module: 'prep' };
const N = Number(process.argv[2] || 8000);

const LEVELS = data.boss.filter((b) => b.hp || b.life_cards).slice(0, 6);
const levelOf = (n) => {
  const order = ['boss-m', 'boss-l', 'boss-l2', 'boss-xl', 'boss-um'];
  return data.boss.find((b) => b.id === order[n - 1]);
};
const CARDS = { 1: 4, 2: 5, 3: 6, 4: 7, 5: 8 };

function build(level, withPrepare, unrestricted) {
  const card = unrestricted ? { ...PREPARE, last_action: false } : PREPARE;
  return newFight(data, {
    level, boss: levelOf(level),
    hero: {
      element: 'fire', klass: null,
      pool: Array.from({ length: CARDS[level] }, (_, i) => (i < 4 ? 'fire' : 'extra')),
      attacks: withPrepare ? [...data.attack, card] : [...data.attack],
    },
    die: 'd20', mode: 'standard',
  });
}

/** A turtle: only ever Strike, never bet. Optionally wind up, early or late. */
function turtle(f, next, mode) {
  let guard = 0;
  while (f.phase === 'act' && guard++ < 30) {
    const pick = (id) => legalAttacks(f).find((a) => a.id === id);
    if (mode === 'early') {
      const p = pick('prepare');
      if (p && p.canAfford && !hasMark(f.hero, 'charged')) attack(f, p, {});
    }
    // Strike until one action is left (or none, when not winding up).
    const floor = mode === 'last' ? 1 : 0;
    while (f.phase === 'act' && f.actionsLeft > floor) {
      const st = pick('strike');
      if (!st || !st.canAfford) break;
      attack(f, st, { target: 'body' });
    }
    if (mode === 'last' && f.phase === 'act') {
      const p = pick('prepare');
      if (p && p.canAfford && !hasMark(f.hero, 'charged')) attack(f, p, {});
      else { const st = pick('strike'); if (st && st.canAfford) attack(f, st, { target: 'body' }); }
    }
    if (f.phase !== 'act') break;
    endTurn(f);
    while (f.phase === 'boss') {
      bossRoll(f, 1 + Math.floor(next() * 6));
      resolveBoss(f, {});
      if (f.phase === 'down') break;
    }
  }
  return f.phase === 'won';
}

const run = (level, withPrepare, unrestricted, mode) => {
  const next = rng(11 + level * 1000);
  let wins = 0;
  for (let i = 0; i < N; i++) if (turtle(build(level, withPrepare, unrestricted), next, mode)) wins++;
  return (100 * wins) / N;
};

console.log(`M2 Preparation, turtle driven explicitly, ${N} fights per cell\n`);
console.log('  variant     L1     L2     L3     L4     L5');
const rows = [
  ['plain', () => [1, 2, 3, 4, 5].map((L) => run(L, false, false, 'none'))],
  ['early', () => [1, 2, 3, 4, 5].map((L) => run(L, true, true, 'early'))],
  ['last', () => [1, 2, 3, 4, 5].map((L) => run(L, true, false, 'last'))],
];
const out = {};
for (const [name, fn] of rows) {
  out[name] = fn();
  console.log(`  ${name.padEnd(10)} ${out[name].map((x) => x.toFixed(1).padStart(5)).join('  ')}`);
}
console.log('\n  deltas against plain:');
for (const name of ['early', 'last']) {
  const d = out[name].map((x, i) => x - out.plain[i]);
  console.log(`  ${name.padEnd(10)} ${d.map((x) => `${x >= 0 ? '+' : ''}${x.toFixed(1)}`.padStart(6)).join(' ')}`);
}
console.log('\n  `early` is the version the last-action rule forbids. If it is far above');
console.log('  plain and `last` is not, the clause is what makes the module a bet.');
