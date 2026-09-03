// ── The campaign (a run) ─────────────────────────────────────
// Level to level: who you are, what you hold, which boss is next. Rules
// section 8 (winning a level) and 9 (the campaign) live here; one fight
// lives in engine.js. The First Game (the user's fork 1) is a run of one
// level with the three Attack cards and nothing else to learn.

import { newFight, DM_DEFAULTS } from './engine.js';
import { BOSSES, MINION, heroFor } from '../data/placeholders.js';
import { shuffle } from '../utils.js';

export const RUN_KINDS = ['first', 'quick', 'full'];

/**
 * How long a run is, and which bosses it meets.
 *
 * The Quick run exists because five levels is an evening and a Saturday morning
 * is not. It is not "the first three levels": it is the whole ARC at three
 * stops, so the climax is still the climax. You meet the level 1, 3 and 5
 * bosses, and the two big ones come down to the life a hero who has only had
 * two drafts can actually chew through. `life` is a multiplier on the boss
 * card's own life_cards, so the shape of the ladder is still data.
 */
export const RUN_SHAPE = {
  first: { levels: 1, bosses: [1], life: [1] },
  quick: { levels: 3, bosses: [1, 3, 5], life: [1, 0.7, 0.55] },
  full: { levels: 5, bosses: [1, 2, 3, 4, 5], life: [1, 1, 1, 1, 1] },
};
export const shapeOf = (kind) => RUN_SHAPE[kind] || RUN_SHAPE.full;
/** The last level of this kind of run. */
export const lastLevel = (kind) => shapeOf(kind).levels;
// Derived, never listed: a hardcoded trio silently left Bubble out of every
// hand when it was added, and the card existed everywhere except the game.
const ELEMENT_BIOMES = ['volcano', 'river', 'mountain', 'desert'];

/** Set up a run. Nothing is fought yet. */
export function newRun(data, { kind = 'full', element = 'fire', die = 'd20', mode = 'standard', secondWind = false, simple = false, dm = null } = {}) {
  const deck = [];
  for (const a of data.advantage) for (let i = 0; i < (a.copies || 1); i++) deck.push(a.id);
  return {
    kind, element, die, mode, secondWind, simple,
    // The table's break settings ride on the run so a reload keeps them, and so
    // the fight never has to reach back into device state to know its own rules.
    dm: dm ? { ...dm } : null,
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
  // Which boss this run's Nth level meets, and how much of its printed life it
  // brings. A Quick run jumps 1 -> 3 -> 5 rather than stopping at 3, so the run
  // still ends on the Hoard King; the multiplier is what makes that survivable
  // with two fewer drafts behind you.
  const shape = shapeOf(run.kind);
  const at = Math.min(run.level, shape.levels) - 1;
  const rosterLevel = shape.bosses[at] ?? run.level;
  const roster = BOSSES.find((b) => b.level === rosterLevel) || BOSSES[BOSSES.length - 1];
  const base = data.byId[roster.card];
  const scale = shape.life[at] ?? 1;
  // Scaled in whole life CARDS, never in loose points: the boss's life is a pile
  // of printed cards on the table and half a card is not a thing you can build.
  const cards = Math.max(1, Math.round(base.life_cards * scale));
  const card = scale === 1 ? base : { ...base, life_cards: cards, hp: cards * base.per_card };
  // The simple table skips the add-on mechanics wholesale: no biome is drawn
  // and the boss keeps to the shared reaction table (noSignatures). The core
  // loop (bet, guard, Rage) is untouched; this is the try-out dial, not a
  // difficulty dial.
  const biomes = run.kind === 'first' ? data.biome.filter((b) => ELEMENT_BIOMES.includes(b.id)) : data.biome;
  const biome = run.simple ? null : biomes[Math.floor(Math.random() * biomes.length)];
  if (run.kind === 'full' && run.level === 1 && run.hand.length === 0) run.hand.push(run.advDeck.shift()); // setup draw
  const fight = newFight(data, {
    level: run.level,
    boss: { ...card, name: roster.name, element: roster.element },
    hero: { element: run.element, klass: run.klass, pool: poolFor(run), attacks: attacksFor(run, data) },
    biome: biome ? { id: biome.id, element: biome.element, rule: biome.rule } : null,
    noSignatures: !!run.simple,
    die: run.die, mode: run.mode, dm: run.dm || { ...DM_DEFAULTS, on: false },
    // The Second Wind card is put in play for the whole run or left in the box,
    // and the engine resets its ladder per fight (RULES: the first comeback is
    // free EACH level). Without this hop the engine's whole revive path was
    // unreachable from the runner, which is what "I cannot use the card to
    // resurrect" was: the rule worked and nothing ever switched it on.
    secondWind: !!run.secondWind,
    advantage: run.kind === 'full' ? run.hand.splice(0) : [],
  });
  fight.roster = roster; fight.biomeCard = biome ? biome.id : null; fight.minionRoster = MINION;
  run.fight = fight; run.stage = 'fight'; run.ui = {};
  return fight;
}

/** After the boss falls: record it and queue the level-end steps (RULES section 8). */
export function levelWon(run) {
  const f = run.fight;
  run.history.push({ level: run.level, outcome: 'win', rounds: f.round, broken: f.hero.pool.filter((c) => c.st === 'broken').length });
  run.hand = [...f.hero.advantage];             // unplayed Advantage cards carry over
  if (run.level >= lastLevel(run.kind)) { run.stage = 'done'; return; }
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
