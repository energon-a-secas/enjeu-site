// ── Rules constants and the dice bridge ──────────────────────
// Everything here is a port of a number that already lives in the folder:
// the ladder and element cycle come from data/cards.json, the die targets
// are tools/dice_bridge.py ported line for line (exact integer arithmetic,
// ties toward the more generous target). tests/dice.test.mjs asserts the
// ported table equals docs/DICE-BRIDGE.md.

export const UNIT = 25;
export const STEPS = ['sure', 'even', 'hard', 'wild'];
export const DEFAULT_LADDER = { sure: 0.75, even: 0.50, hard: 0.25, wild: 0.15 };
export const DICE = ['d20', 'd12', 'd10', 'd8', 'd6', 'd4', '2d6', '3d6'];
const SPEC = { d20: [20, 1], d12: [12, 1], d10: [10, 1], d8: [8, 1], d6: [6, 1], d4: [4, 1], '2d6': [6, 2], '3d6': [6, 3] };

/** Odds for a step, or 1 for "no check" (null). */
export const stepOdds = (step, ladder = DEFAULT_LADDER) => (step ? ladder[step] : 1);

/**
 * One rung harder (+1) or easier (-1). Easier than Sure is automatic (null);
 * harder than Wild stays Wild. This is Roar, the mode dial, and Hide's
 * sibling "one step" rules, all in one place.
 */
export function shiftStep(step, delta) {
  if (step === null || step === undefined) return delta > 0 ? 'sure' : null;
  const i = STEPS.indexOf(step) + delta;
  if (i < 0) return null;
  return STEPS[Math.min(i, STEPS.length - 1)];
}

/** The mode dial: story = one rung easier, nightmare = one rung harder. */
export const MODE_SHIFT = { story: -1, standard: 0, nightmare: 1 };

// ── Dice bridge (tools/dice_bridge.py) ───────────────────────
const _dist = {};
/** Outcome counts per total for `count` dice of `sides`. Integers, no drift. */
export function distribution(die) {
  if (_dist[die]) return _dist[die];
  const [sides, count] = SPEC[die];
  let counts = new Map([[0, 1]]);
  for (let i = 0; i < count; i++) {
    const next = new Map();
    for (const [sum, n] of counts) for (let f = 1; f <= sides; f++) next.set(sum + f, (next.get(sum + f) || 0) + n);
    counts = next;
  }
  return (_dist[die] = { counts, denom: sides ** count, lo: count, hi: sides * count });
}

export function atLeast(die, target) {
  const { counts, denom } = distribution(die);
  let n = 0;
  for (const [sum, c] of counts) if (sum >= target) n += c;
  return { n, denom, p: n / denom };
}

/**
 * The target number whose real odds sit closest to `want`. Exact compare:
 * |n/denom - want| scaled by 100*denom so 75/50/25/15 stay integers, and a
 * tie breaks toward the LOWER (more generous) target. On 2d6 the Even step
 * sits exactly between 7+ (58.3%) and 8+ (41.7%); floats handed it to 8+.
 */
export function bestTarget(die, want) {
  const { lo, hi, denom } = distribution(die);
  const w = Math.round(want * 100);
  let best = lo, bestGap = Infinity;
  for (let tgt = lo; tgt <= hi; tgt++) {
    const gap = Math.abs(atLeast(die, tgt).n * 100 - w * denom);
    if (gap < bestGap) { bestGap = gap; best = tgt; }
  }
  return { target: best, odds: atLeast(die, best).p };
}

/** The whole printed table: one row per step, one column per die. */
export function ladderTable(ladder = DEFAULT_LADDER) {
  return {
    dice: DICE,
    rows: STEPS.map((step, i) => {
      const targets = {}, real = {};
      for (const d of DICE) { const b = bestTarget(d, ladder[step]); targets[d] = b.target; real[d] = b.odds; }
      return { step, pips: i + 1, odds: Math.round(ladder[step] * 100), targets, real };
    }),
  };
}
export const ladderForAid = (data) => ladderTable(data?.ladder || DEFAULT_LADDER)
/**
 * Everything the generated aid cards need to draw themselves: the ladder, and the
 * boss's reaction rows exactly as cards.json states them. One function, because
 * the browse grid, the print sheet and the detail panel each built this object by
 * hand and a fourth site would have shipped an aid card with a blank table.
 */
/**
 * Everything the two reference cards need. `reactionNames` is keyed by the id
 * cards.json now carries, so the printed Boss Reactions aid says Aguante on a
 * Spanish sheet and Brace on an English one, and matches whichever rulebook is
 * on the table. The card renderer itself never imports the string table.
 */
export const aidFor = (data, names = null, breakNames = null, dmNames = null) => ({
  ladder: ladderForAid(data),
  reactions: data?.boss_reaction || [],
  reactionNames: names,
  // The Break Points card draws itself from the same dial the engine defaults
  // from, so a table that reads 'Wound 50' off the card is reading cards.json.
  breaks: data?.break_points || null,
  breakNames, dmNames,
});

/** Worst gap between stated and real odds, per die, for the fidelity list. */
export function fidelity(ladder = DEFAULT_LADDER) {
  return DICE.map((d) => ({
    die: d,
    gap: Math.max(...STEPS.map((s) => Math.abs(bestTarget(d, ladder[s]).odds - ladder[s]))),
  })).sort((a, b) => a.gap - b.gap);
}

/** The number to meet or beat on `die` for `step` (null step = no roll). */
export function targetFor(die, step, ladder = DEFAULT_LADDER) {
  if (!step) return null;
  return bestTarget(die, ladder[step]).target;
}

/** Roll a die from a uniform source: the sum of its parts. */
export function rollDie(die, next) {
  const [sides, count] = SPEC[die];
  let sum = 0;
  for (let i = 0; i < count; i++) sum += 1 + Math.floor(next() * sides);
  return sum;
}
export const dieMax = (die) => SPEC[die][0] * SPEC[die][1];

// ── Element cycle and boss reactions (from cards.json) ───────
export const ELEMENTS = ['fire', 'water', 'earth', 'wind'];
export function beats(data, attacker, defender) {
  return !!(attacker && defender && data.element_cycle?.[attacker] === defender);
}
/** The reaction row a d6 roll lands on. */
export function reactionFor(data, roll) {
  return data.boss_reaction.find((r) => Array.isArray(r.roll) ? r.roll.includes(roll) : r.roll === roll);
}
