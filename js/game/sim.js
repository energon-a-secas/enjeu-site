// ── Batch simulator ──────────────────────────────────────────
// tools/sim.py in the browser: the same five levels, four styles, and the
// same outputs (win %, rounds, cards Broken). With legacy=true it reproduces
// the Python's simplifications so docs/BALANCE.md can be checked; with it
// off, the engine plays the rulebook (Brace halves, Summon moves real cards,
// Roar shifts one rung), and classes and the Advantage deck can be switched
// on, which the Python cannot do yet.

import { rng, shuffle } from '../utils.js';
import { newFight, endTurn, bossRoll, resolveBoss, broken, MAX_ROUNDS } from './engine.js';
import { STYLES, playTurn, wantsBarrier } from './strategies.js';

/** The tuned ladder of synthetic attacks, exactly tools/sim.py's TIER table. */
export const STRIKE = { id: 'strike', name: 'Strike', actions: 1, bet: 0, damage: 25, check: null };
export const FOCUS = { id: 'focus', name: 'Focus', actions: 1, bet: 1, damage: 75, check: 'sure' };
export const ALL_IN = { id: 'all-in', name: 'All In', actions: 2, bet: 'any', damage: '3x bet', check: 'even' };
export const TIER = {
  1: { id: 'tier1', name: 'Tier 1', actions: 1, bet: 1, damage: 100, check: 'sure' },
  2: { id: 'tier2', name: 'Tier 2', actions: 1, bet: 2, damage: 225, check: 'sure' },
  3: { id: 'tier3', name: 'Tier 3', actions: 1, bet: 2, damage: 400, check: 'even' },
  4: { id: 'tier4', name: 'Tier 4', actions: 1, bet: 3, damage: 750, check: 'even' },
};

/** The campaign from cards.json: level -> boss entry, plus the sim's hero pool sizes. */
export function levels(data) {
  const ids = ['boss-m', 'boss-l', 'boss-l2', 'boss-xl', 'boss-um'];
  return ids.map((id, i) => ({
    level: i + 1,
    cards: 4 + i,
    tiers: [1, 2, 3, 4].slice(0, i),
    boss: data.byId?.[id] || data.boss.find((b) => b.id === id),
  }));
}

export function advantageDeck(data, next) {
  const deck = [];
  for (const a of data.advantage) for (let i = 0; i < (a.copies || 1); i++) deck.push(a.id);
  return shuffle(deck, next);
}

/**
 * One fight. Returns { outcome: 'win'|'loss'|'stall', rounds, broken }.
 * opts: { level, style, legacy, bonus, klass, advantage (bool), element }
 */
export function runFight(data, opts, next) {
  const L = levels(data)[opts.level - 1];
  const attacks = [STRIKE, FOCUS, ALL_IN, ...L.tiers.map((t) => TIER[t])];
  const el = opts.element || 'fire';
  const pool = Array.from({ length: L.cards }, (_, i) => (i < 4 ? el : 'extra'));
  let deck = null, hand = [];
  if (opts.advantage && !opts.legacy) { deck = advantageDeck(data, next); hand = deck.splice(0, opts.level); }
  const draw = () => deck?.shift() || null;
  const f = newFight(data, {
    level: opts.level, boss: L.boss, legacy: !!opts.legacy, bonus: opts.bonus || 0,
    hero: { element: el, klass: opts.klass && opts.klass !== 'none' ? opts.klass : null, pool, attacks },
    advantage: hand, die: 'd20', mode: 'standard',
  });
  while (f.phase === 'act') {
    playTurn(f, opts.style, next, draw);
    if (f.phase !== 'act') break;
    endTurn(f);
    while (f.phase === 'boss') {
      const p = bossRoll(f, 1 + Math.floor(next() * 6));
      const r = resolveBoss(f, { barrier: wantsBarrier(f, p) });
      if (r === 'again') continue;
    }
  }
  const outcome = f.phase === 'won' ? 'win' : f.phase === 'lost' ? 'loss' : 'stall';
  return { outcome, rounds: f.round, broken: broken(f) };
}

/** One table cell: `trials` fights. */
export function runCell(data, opts, trials, seed = 7) {
  const next = rng(seed + opts.level * 1000 + STYLES.indexOf(opts.style) * 97);
  let wins = 0, roundSum = 0, brokenSum = 0;
  for (let i = 0; i < trials; i++) {
    const r = runFight(data, opts, next);
    if (r.outcome === 'win') { wins++; roundSum += r.rounds; }
    brokenSum += r.broken;
  }
  return { level: opts.level, style: opts.style, win: (100 * wins) / trials, rounds: wins ? roundSum / wins : NaN, broken: brokenSum / trials, trials };
}

/** The whole table; onCell fires after each of the 20 cells for progress. */
export function runTable(data, opts, trials, onCell) {
  const rows = [];
  for (const L of levels(data)) {
    for (const style of STYLES) {
      const cell = runCell(data, { ...opts, level: L.level, style }, trials, opts.seed ?? 7);
      rows.push(cell);
      onCell?.(cell, rows.length, 20);
    }
  }
  return rows;
}
