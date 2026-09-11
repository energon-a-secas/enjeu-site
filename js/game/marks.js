// ── Marks ────────────────────────────────────────────────────
// A Mark is a brick you put under a figure. It does one thing, and it ends.
//
// This file is the whole definition. It knows WHAT a mark is; js/game/engine.js
// knows what happens when one fires, because the hero pays damage through
// take() and a boss pays it through dealToBoss(), and a table of data should
// not have to know the difference.
//
// The five rules, from docs/EXPANSIONS.md, and the two that matter:
//
//   4. The same Mark twice does not stack. The second one refreshes the first.
//   5. Every Mark is small: 25 a round when it ticks, one rung when it shifts.
//      Charged is the SINGLE named exception at +50 once, because a whole
//      action bought it. No two Marks ever combine into one bigger number.
//
// Those two are the entire reason this can be added to a game a seven-year-old
// plays. Without rule 4 a figure accumulates a pile nobody can read; without
// rule 5 a child is adding two modifiers together before they can roll. Both
// are enforced here rather than remembered: add() cannot stack because a mark
// is a key in an object, and every entry below carries one small number: one
// UNIT when it ticks, one step when it shifts, and Charged's named +50.
//
// Marks apply to the boss and to minions exactly as they apply to the hero.
// That is the point of the terrain module: a poisoned boss loses 25 a round,
// and you did that by pushing it into a swamp rather than by hitting it.

import { UNIT } from './rules.js';

/**
 * Every mark in the game. `brick` is the colour you actually put on the table,
 * and is as load-bearing as any other field: the physical component IS the
 * state, which is why nothing here needs a counter or a track.
 *
 * `ticks`   'round' (it fires at the top of every round, for every figure at
 *           once) or null. One moment when everything pays is the whole reason
 *           a table never forgets a trigger: nobody has to remember whose turn
 *           it was. It is also why the damage is worth something. Ticking at
 *           the END of the hero's turn was the first design and it was very
 *           nearly free: a card Spent to guard it Recovers at the top of the
 *           next round, before the hero needs to bet again. Ticking after
 *           Recover instead costs a card of betting capacity for that round,
 *           which is a real price paid in the game's own currency.
 * `damage`  what it costs when it ticks
 * `ends`    what removes it: 'action' (spend one), 'hide', 'hit' (an attack
 *           lands on this figure), 'guard', 'tick' (it fires once and goes),
 *           'turn' (it expires on its own next turn)
 * `step`    a check shift it grants ATTACKERS of this figure (Marked only)
 * `bonus`   extra damage this figure's next landed attack deals (Charged only)
 * `blocks`  actions this figure may not take
 * `icon`    the glyph its printed reference card carries (js/cards/glyphs.js)
 * `hex`     the screen's stand-in for that brick. The BRICK is the real
 *           component and `brick` names it; this only exists so the board can
 *           draw the same thing the table is looking at.
 */
export const MARKS = {
  poison: {
    id: 'poison', icon: 'mark-poison', hex: '#4a9e52', name: 'Poison', brick: 'green',
    ticks: 'round', damage: UNIT, ends: 'action',
    text: 'Lose 25 at the start of each round. Spend an action to shake it off.',
  },
  burning: {
    id: 'burning', icon: 'mark-burning', hex: '#d1453b', name: 'Burning', brick: 'red',
    ticks: 'round', damage: UNIT, ends: 'tick', extinguish: 'hide',
    text: 'Lose 25 at the start of the round, then it goes out. Hide first and it goes out instead.',
  },
  frozen: {
    id: 'frozen', icon: 'mark-frozen', hex: '#7fc7e8', name: 'Frozen', brick: 'light blue',
    ticks: null, ends: 'turn', costsAction: true,
    text: 'Lose your next action. A boss or minion loses its next strike.',
  },
  marked: {
    id: 'marked', icon: 'mark-marked', hex: '#efe9db', name: 'Marked', brick: 'white',
    ticks: null, ends: 'hit', step: -1,
    text: 'Attacks against this figure are one step easier, until one lands.',
  },
  charged: {
    id: 'charged', icon: 'mark-charged', hex: '#eab308', name: 'Charged', brick: 'yellow',
    ticks: null, ends: 'guard', bonus: 2 * UNIT,
    text: 'Your next landed attack deals +50. Lost as soon as a hit costs you a card.',
  },
  snared: {
    id: 'snared', icon: 'mark-snared', hex: '#8a5a34', name: 'Snared', brick: 'brown',
    ticks: null, ends: 'action', blocks: ['run', 'hide', 'brace'],
    text: 'Cannot Run and cannot Hide. A boss cannot Brace. Spend an action to break free.',
  },
};

export const MARK_IDS = Object.keys(MARKS);

/**
 * The marks on a figure, created on demand.
 *
 * Lazy creation is the migration story: a run saved by an older build has no
 * `marks` key on its hero, its boss or any minion, and comes back through
 * localStorage as a plain object. Reading through this function means such a
 * save simply has no marks, which is true, rather than throwing on a missing
 * key somewhere three calls deep in the boss phase.
 */
export function marksOf(fig) {
  if (!fig) return {};
  if (!fig.marks) fig.marks = {};
  return fig.marks;
}

export const hasMark = (fig, id) => !!(fig && fig.marks && fig.marks[id]);

/** Apply a mark. Rule 4: the same mark twice refreshes rather than stacking. */
export function addMark(fig, id) {
  if (!MARKS[id]) throw new Error(`no such mark: ${id}`);
  const m = marksOf(fig);
  const had = !!m[id];
  m[id] = true;
  return !had;
}

export function clearMark(fig, id) {
  const m = marksOf(fig);
  const had = !!m[id];
  delete m[id];
  return had;
}

/** Every mark currently on a figure, as definitions, in a stable order. */
export const listMarks = (fig) => MARK_IDS.filter((id) => hasMark(fig, id)).map((id) => MARKS[id]);

/**
 * Clear every mark that ends on `event`, and say which went.
 * Events: 'action', 'hide', 'hit', 'guard', 'turn'.
 */
export function endMarks(fig, event) {
  const gone = [];
  for (const id of MARK_IDS) {
    if (!hasMark(fig, id)) continue;
    const def = MARKS[id];
    if (def.ends === event || def.extinguish === event) { delete fig.marks[id]; gone.push(def); }
  }
  return gone;
}

/**
 * What this figure's marks cost it this round: the damage owed and the marks
 * that burned out doing it.
 *
 * Returns the total rather than applying it, because the hero pays through
 * take() (which can be guarded, and can end the fight) and a boss pays through
 * dealToBoss() (which cannot). Deciding that here would mean this file knowing
 * about both, and it deliberately knows about neither.
 */
export function tickMarks(fig) {
  let damage = 0;
  const fired = [];
  const spent = [];
  for (const id of MARK_IDS) {
    if (!hasMark(fig, id)) continue;
    const def = MARKS[id];
    if (def.ticks !== 'round') continue;
    damage += def.damage || 0;
    fired.push(def);
    if (def.ends === 'tick') { delete fig.marks[id]; spent.push(def); }
  }
  return { damage, fired, spent };
}

/** True if a mark forbids this figure from taking `action` ('run', 'hide', 'brace'). */
export function blocked(fig, action) {
  return MARK_IDS.some((id) => hasMark(fig, id) && (MARKS[id].blocks || []).includes(action));
}

/** The check shift attackers of this figure get, capped at one step by rule 5. */
export function markStep(fig) {
  const s = MARK_IDS.reduce((a, id) => a + (hasMark(fig, id) ? (MARKS[id].step || 0) : 0), 0);
  return Math.max(-1, Math.min(1, s));
}

/** Extra damage this figure's next landed attack deals, capped by rule 5. */
export function markBonus(fig) {
  return MARK_IDS.reduce((a, id) => a + (hasMark(fig, id) ? (MARKS[id].bonus || 0) : 0), 0);
}

/** True if this figure loses its next action or strike. */
export const losesAction = (fig) => MARK_IDS.some((id) => hasMark(fig, id) && MARKS[id].costsAction);
