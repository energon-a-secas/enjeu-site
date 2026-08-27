// ── The campaign (a run) ─────────────────────────────────────
// Level to level: who you are, what you hold, which boss is next. Rules
// section 8 (winning a level) and 9 (the campaign) live here; one fight
// lives in engine.js. The First Game (the user's fork 1) is a run of one
// level with the three Attack cards and nothing else to learn.

import { newFight } from './engine.js';
import { BOSSES, MINION, heroFor } from '../data/placeholders.js';
import { shuffle } from '../utils.js';

export const RUN_KINDS = ['first', 'full'];
// Derived, never listed: a hardcoded trio silently left Bubble out of every
// hand when it was added, and the card existed everywhere except the game.
const ELEMENT_BIOMES = ['volcano', 'river', 'mountain', 'desert'];

/** Set up a run. Nothing is fought yet. */
export function newRun(data, { kind = 'full', element = 'fire', die = 'd20', mode = 'standard' } = {}) {
  const deck = [];
  for (const a of data.advantage) for (let i = 0; i < (a.copies || 1); i++) deck.push(a.id);
  return {
    kind, element, die, mode,
    level: 1, klass: null,
    skills: [],                                   // card ids taken at drafts
    skillPool: data.skill.filter((c) => c.tier === 0).map((c) => c.id),  // tier 0 sits in the pool from the start
    advDeck: shuffle(deck), hand: [],
    extraLives: 0,                                // white cards earned, one per level cleared
    fight: null, stage: 'setup',                  // setup | fight | class | draft | advantage | next | done | lost
    draft: [], ui: {},
    history: [],                                  // {level, outcome, rounds, broken}
  };
}

/** The hero's attack cards for a fight: the three Attack cards plus drafted skills. */
export function attacksFor(run, data) {
  const attacks = data.attack.map((c) => c.id);
  const first = run.kind === 'first' ? attacks : [...attacks, ...run.skills];
  return first.map((id) => data.byId[id]);
}

/** The hero's life pool at the start of a level: 4 element cards + earned extras (+ Necromancer keeps nothing). */
export function poolFor(run) {
  return [...Array(4).fill(run.element), ...Array(run.extraLives).fill('extra')];
}

/** Begin the level the run is on. Draws a biome; builds the fight. */
export function startLevel(run, data) {
  const roster = BOSSES.find((b) => b.level === run.level) || BOSSES[BOSSES.length - 1];
  const card = data.byId[roster.card];
  const biomes = run.kind === 'first' ? data.biome.filter((b) => ELEMENT_BIOMES.includes(b.id)) : data.biome;
  const biome = biomes[Math.floor(Math.random() * biomes.length)];
  if (run.kind === 'full' && run.level === 1 && run.hand.length === 0) run.hand.push(run.advDeck.shift()); // setup draw
  const fight = newFight(data, {
    level: run.level,
    boss: { ...card, name: roster.name, element: roster.element },
    hero: { element: run.element, klass: run.klass, pool: poolFor(run), attacks: attacksFor(run, data) },
    biome: { id: biome.id, element: biome.element, rule: biome.rule },
    die: run.die, mode: run.mode,
    advantage: run.kind === 'full' ? run.hand.splice(0) : [],
  });
  fight.roster = roster; fight.biomeCard = biome.id; fight.minionRoster = MINION;
  run.fight = fight; run.stage = 'fight'; run.ui = {};
  return fight;
}

/** After the boss falls: record it and queue the level-end steps (RULES section 8). */
export function levelWon(run) {
  const f = run.fight;
  run.history.push({ level: run.level, outcome: 'win', rounds: f.round, broken: f.hero.pool.filter((c) => c.st === 'broken').length });
  run.hand = [...f.hero.advantage];             // unplayed Advantage cards carry over
  if (run.kind === 'first') { run.stage = 'done'; return; }
  if (run.level >= 5) { run.stage = 'done'; return; }
  run.extraLives += 1;                           // 1. broken return (pool rebuilt) 2. take one Extra Life
  run.stage = run.level === 1 ? 'class' : 'draft'; // 3. class after level 1 only, 4. draft
}

export function levelLost(run) {
  const f = run.fight;
  run.history.push({ level: run.level, outcome: 'loss', rounds: f.round, broken: f.hero.pool.filter((c) => c.st === 'broken').length });
  run.stage = 'lost';
}

export function chooseClass(run, klass) {
  run.klass = klass;
  run.stage = 'draft';
}

/** Shuffle the next tier into the pool, reveal 3. A card locked to another class is replaced. */
export function revealDraft(run, data) {
  const tier = run.level;                          // after level N, tier N enters
  for (const c of data.skill) if (c.tier === tier && !run.skillPool.includes(c.id) && !run.skills.includes(c.id)) run.skillPool.push(c.id);
  shuffle(run.skillPool);
  const shown = [], rest = [];
  for (const id of run.skillPool) {
    const c = data.byId[id];
    if (shown.length < 3 && (!c.class || c.class === run.klass)) shown.push(id); else rest.push(id);
  }
  run.skillPool = rest;                            // the three are out of the pool while revealed
  run.draft = shown;
  return shown;
}

export function takeSkill(run, id) {
  if (!run.draft.includes(id)) return;
  run.skills.push(id);
  for (const other of run.draft) if (other !== id) run.skillPool.push(other); // the rest return to the pool
  run.draft = [];
  run.stage = 'advantage';
}

/** Draw n Advantage cards into the hand (setup, level end, Chest). */
export function drawAdvantage(run, n = 1) {
  const drawn = run.advDeck.splice(0, n);
  run.hand.push(...drawn);
  return drawn;
}

export function nextLevel(run, data) {
  run.level += 1;
  return startLevel(run, data);
}

/**
 * A fight loaded from storage lost its data pointer; put it back. And a run
 * saved by an OLDER build of this site may not have the shape this build
 * renders: rather than restore it into a view that throws on every click,
 * check the load-bearing fields and fall back to a clean setup screen.
 */
export function reattach(run, data) {
  const f = run?.fight;
  if (!f) return run;
  const sane = Array.isArray(f.hero?.pool) && Array.isArray(f.hero?.attacks)
    && typeof f.boss?.body === 'number' && Array.isArray(f.boss?.minions)
    && Array.isArray(f.log) && typeof f.phase === 'string';
  if (!sane) {
    run.fight = null;
    run.stage = 'setup';
    return run;
  }
  Object.defineProperty(f, 'data', { value: data, enumerable: false, configurable: true, writable: true });
  return run;
}
