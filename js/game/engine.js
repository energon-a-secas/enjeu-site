// ── Engine (contract C3) ─────────────────────────────────────
// Pure functions over a Fight object, no DOM, no randomness of its own:
// every roll comes in from outside (a human's die, or a seeded stream), so
// the play runner and the batch simulator share every line of rules.
//
// Source of truth for the rules: RULES.md. Source of the shape: tools/sim.py,
// ported function for function (take, affordable, p_kill, choose live in
// strategies.js). Where the rulebook says more than the Python models, the
// rulebook wins and the Python's simplification is kept behind `legacy` so
// its published table can still be reproduced and checked.
//
// legacy (sim.py parity) differs from the rulebook in exactly three places:
//   1. Brace never halves the boss's incoming damage (it only skips a hit).
//   2. Summon moves a flat 100 hp off the body (not 2 x the boss's per-card
//      value) and needs body > 100.
//   3. Roar flattens the NEXT attack's check to Even, Strike included.
// It used to differ in a fourth: the fight was won on the body alone. The
// rulebook agrees with it now (2026-08-30), so that row is gone rather than
// green by accident. legacy also skips break points and the Run penalty, both
// of which arrived after tools/sim.py was last a source of truth.
// Rulings this file made while RULES.md was silent. Most were promoted INTO the
// rulebook on 2026-08-28, so the list below is now a map of where each one is
// written down, not a list of things only the code knows:
//   - an attack's element is the card's, falling back to the hero's: RULES.md s6
//   - a minion's damage does not spill to the boss's body: RULES.md s7
//   - Knight's free guard does not apply under Rage: RULES.md s7
//   - which cards break first under Rage (Ready, then Spent): RULES.md s7
//   - leftover damage after the Ally's defense is lost: RULES.md s7
//   - a downgraded Summon is a Strike and can be aimed at the Ally: RULES.md s7
//   - tier-0 skills start in the pool: RULES.md s8
// STILL ONLY HERE, and each is a gap worth closing in the rulebook rather than
// leaving in a comment:
//   - Ally lasts the level; Relic lasts the level; Rune is one check
//   - a minion's 25 always comes for the hero, never the Ally
//   - the Ally's own free 25 always hits the body and can never be aimed at a
//     minion, which the minion-overkill rule now makes load-bearing

import { UNIT, stepOdds, shiftStep, MODE_SHIFT, targetFor, beats, reactionFor } from './rules.js';

export const ATTACK_IDS = ['strike', 'focus', 'all-in'];

/**
 * Second Wind: the gentle-mode card. The first revive of a level is free and
 * each one after that climbs the same four-step ladder every check in this game
 * uses, so a child meets no new vocabulary: Sure, then Even, then Hard, then
 * Wild, and Wild from then on. Returns null for the free one.
 */
export const REVIVE_LADDER = ['sure', 'even', 'hard', 'wild'];
export function reviveStep(f) {
  if (!f.hero.secondWind) return undefined;          // the card is not in play
  if (f.hero.revives === 0) return null;             // the free one
  return REVIVE_LADDER[Math.min(f.hero.revives - 1, REVIVE_LADDER.length - 1)];
}
/**
 * How many Broken cards a comeback stands back up. The first rescue is a real
 * one and each after it is thinner, which is the same shape as the check
 * climbing the ladder beside it: the card gets harder to play AND worth less,
 * so a level cannot be farmed by falling over. It never reaches zero, because
 * a comeback that returns nothing is a coin flip dressed up as a choice.
 */
export const REVIVE_RETURNS = [4, 3, 2, 1];
export const reviveReturns = (f) => REVIVE_RETURNS[Math.min(f.hero.revives, REVIVE_RETURNS.length - 1)];
export const canRevive = (f) => !!f.hero.secondWind;
export const MAX_ROUNDS = 20;

/**
 * The Ally's defense (RULES.md section 7, "The Ally"). Two units, which is what
 * makes it a wall at levels 1 and 2 (Damage 50, nothing gets through) and a
 * one-hit sponge from level 3 up (75, then 100). The number is the balance of
 * the card, so it is named here rather than written into a branch.
 */
export const ALLY_DEF = 2 * UNIT;

// ── Break points (RULES.md section 7, "Breaking a part") ─────
/**
 * The bosses in this game are built out of bricks on somebody's table, so no
 * two are the same object and the rulebook cannot name their parts. It does not
 * try. The player says what they went for out loud ("I stab it in the eye",
 * "I go for the wing") and the game only referees whether it came off and what
 * that buys. This is the same move the cut spell system made: hand it back to
 * the table instead of writing another rule.
 *
 * The DM style is the one dial, and it is about PERMISSION, not difficulty:
 *   friendly  the grown-up says it broke, and it broke. No check, no cost.
 *   assisted  the site asks for a check at `step` (default Hard). The default,
 *             because it is the one that still feels earned to the person who
 *             invented the part.
 *   hardcore  one rung harder than `step`, and it costs an action, so a break
 *             competes with the attack it would have paid for.
 * Every number below is editable at the table (js/views/play-screens.js), which
 * is what makes this a dial and not a fourth difficulty setting.
 */
export const DM_STYLES = ['friendly', 'assisted', 'hardcore'];
export const BREAK_REWARDS = ['wound', 'cripple', 'trophy'];
export const DM_DEFAULTS = { style: 'assisted', cap: 2, step: 'hard', wound: 2 * UNIT, cripple: UNIT };

/** The check a break asks for, or null when the DM simply grants it. */
export function breakStepFor(f) {
  if (f.legacy || !f.dm) return null;
  if (f.dm.style === 'friendly') return null;
  const step = f.dm.step || 'hard';
  return f.dm.style === 'hardcore' ? shiftStep(step, 1) : step;
}
/** Actions a break costs. Only hardcore charges, and that is the whole of it. */
export const breakCost = (f) => (f.dm?.style === 'hardcore' ? 1 : 0);

/**
 * A break is offered only in the window a landed attack opens, and only once
 * per attack: `breakWindow` is set by attack() and cleared here, at endTurn and
 * at the top of every round. Without that window the button would be a free
 * action a player could tap all turn, and "I stabbed it in the eye" would stop
 * describing anything that happened.
 */
export function canBreak(f) {
  if (f.legacy || !f.dm || !f.dm.cap) return false;
  return f.phase === 'act' && !!f.hero.breakWindow
    && f.boss.breaks < f.dm.cap && f.actionsLeft >= breakCost(f);
}

/**
 * Take a part off the boss. Pass a die `roll` (a human) or a uniform `u` (a
 * strategy); `reward` is the player's pick from BREAK_REWARDS.
 *
 * Returns `{draw}` rather than drawing itself: the Advantage deck belongs to the
 * run, not to the fight, and a First Game has no deck to draw from. The runner
 * honours the draw only where there is one, and the Rune below is the version
 * of the same reward every mode can pay.
 */
export function breakPart(f, o = {}) {
  if (!canBreak(f)) throw new Error('nothing to break yet');
  const reward = BREAK_REWARDS.includes(o.reward) ? o.reward : 'wound';
  f.actionsLeft -= breakCost(f);
  f.hero.breakWindow = false;
  const step = breakStepFor(f);
  let ok = true, need = null;
  if (step) {
    if (o.u !== undefined) ok = o.u < stepOdds(step);
    else { need = targetFor(f.die, step); ok = (o.roll ?? 0) >= need; }
  }
  if (!ok) { say(f, 'The part holds. Nothing comes off.', 'bad'); return { ok: false, step, need, reward }; }
  f.boss.breaks += 1;
  say(f, `You break a part off the boss (${f.boss.breaks} of ${f.dm.cap}).`, 'good');
  let draw = 0;
  if (reward === 'cripple') {
    f.boss.damage = Math.max(UNIT, f.boss.damage - (f.dm.cripple ?? UNIT));
    say(f, `Crippled: the boss now deals ${f.boss.damage}.`, 'good');
  } else if (reward === 'trophy') {
    f.hero.rune += 1;
    draw = 1;
    say(f, 'Trophy: one check this level succeeds automatically.', 'good');
  } else {
    const w = f.dm.wound ?? 2 * UNIT;
    say(f, `The break tears ${w} off it.`, 'good');
    dealToBoss(f, 'body', w, 'The break');
  }
  return { ok: true, step, need, reward, draw };
}



/**
 * Who the boss's pending reaction is aimed at. Only a Strike, only while an Ally
 * stands, and never under Rage: "Rage goes through everything, and it is not a
 * hit you can hand to somebody else". Handing a raging Strike to the Ally would
 * make the card a free 200-point shield at level 5, which is the opposite of
 * what Rage is for.
 */
export const aimedAtAlly = (f, kind) => !!f.hero.ally && kind === 'strike' && !raging(f) && !f.legacy;

/** A life card in the hero's pool. kind colours the mini face; st is the state. */
const card = (kind) => ({ kind, st: 'ready' });

/**
 * @param {object} data  parsed cards.json (for boss_reaction, element_cycle)
 * @param {object} init
 *   level, boss: {id,name,size,per_card,life_cards,damage,rage,element},
 *   hero: {element, klass, pool:[kind...], attacks:[card-like...]},
 *   biome: {id,element,rule}|null, die, mode, legacy, advantage:[ids],
 *   extraLife (Village), figure ids are the view's business.
 */
export function newFight(data, init) {
  const b = init.boss;
  const perCard = b.per_card;
  const pool = (init.hero.pool || []).map(card);
  if (init.biome?.id === 'village') pool.push(card('extra'));
  const f = {
    level: init.level || 1,
    round: 0,
    die: init.die || 'd20',
    mode: init.mode || 'standard',
    legacy: !!init.legacy,
    biome: init.biome || null,
    boss: {
      id: b.id, name: b.name || b.id, size: b.size, perCard, damage: b.damage, rage: b.rage || 99,
      summonCards: b.summon_cards ?? 2,
      signature: init.noSignatures || init.legacy ? null : (b.signature || null),
      offBalance: false,
      element: b.element || null, body: b.hp ?? b.life_cards * perCard, maxHp: b.hp ?? b.life_cards * perCard,
      minions: [], braced: false, actsTwice: init.biome?.id === 'castle',
      breaks: 0,
    },
    hero: {
      element: init.hero.element, klass: init.hero.klass || null,
      pool, attacks: init.hero.attacks.map((a) => ({ ...a })),
      advantage: [...(init.advantage || [])],
      // ally is null or a figure: { def }. It was a boolean until the boss could
      // aim at it, and a boolean has nothing to subtract 50 from.
      relic: false, ally: null, rune: 0, flatBonus: init.bonus || 0, shield: 0,
      penalty: false, hidden: false, hideAvailable: init.biome?.id === 'forest',
      knightUsed: false, hunterUsed: false, lastMiss: null,
      secondWind: !!init.secondWind, revives: 0,
      breakWindow: false,
    },
    // The table's own settings, never the sim's: legacy ignores them wholesale.
    dm: { ...DM_DEFAULTS, ...(init.dm || {}) },
    actionsLeft: 0,
    phase: 'act',      // act | boss | down | won | lost | stall
    pending: null,     // a rolled boss reaction awaiting resolve (Barrier window)
    foretold: null,    // Taunt: the boss's die, already thrown face up
    awaitForetell: false,
    fell: null,        // where a fall interrupted the boss phase, for attemptRevive
    log: [],
    stats: { rounds: 0, attacks: 0, hits: 0, allIns: 0 },
  };
  // Non-enumerable: the run is saved to localStorage, and cards.json must not ride along.
  Object.defineProperty(f, 'data', { value: data, enumerable: false, writable: true, configurable: true });
  startRound(f);
  return f;
}

// English on purpose: this file is the sim-parity layer and the engine tests
// pin exact lines. The DISPLAY translates (js/views/logline.js); a new line
// here needs a pattern there and a sample in tests/logline.test.mjs.
const say = (f, text, cls = '') => { f.log.push({ text, cls }); };

export const ready = (f) => f.hero.pool.filter((c) => c.st === 'ready').length;
export const spent = (f) => f.hero.pool.filter((c) => c.st === 'spent').length;
export const broken = (f) => f.hero.pool.filter((c) => c.st === 'broken').length;
export const alive = (f) => ready(f) + spent(f);
export const raging = (f) => f.round >= f.boss.rage;
export const bossHp = (f) => f.boss.body + f.boss.minions.reduce((a, m) => a + m.hp, 0);
// The boss falls when its BODY is gone, and every minion still standing runs
// off. It used to need the minions dead too, which is why a table that had just
// knocked the last card off the wall was told the fight was still going: the
// dramatic beat and the rule disagreed, and the rule was the one nobody had
// written down (it lived in this file's header, never in RULES.md). Body alone
// is also what tools/sim.py has always done, so `legacy` stops being a special
// case here. The cost is that Summon now moves life OFF the body and partly
// helps you; the answer to that is that killing a minion still stops its 25 a
// turn, so aiming at one is a choice about incoming damage, not about arithmetic.
export const bossDown = (f) => f.boss.body <= 0;

// ── Round flow ───────────────────────────────────────────────
export function startRound(f) {
  f.round += 1;
  f.stats.rounds = f.round;
  // Recover: every Spent card comes back. The one thing that makes betting free.
  for (const c of f.hero.pool) if (c.st === 'spent') c.st = 'ready';
  f.actionsLeft = 3;
  f.hero.penaltyArmed = f.hero.penalty; // a Roar from the last boss turn applies this turn
  f.hero.hidden = false;
  // The Forest's free hide is once per LEVEL, granted at newFight. Re-granting
  // it every round measured as 85-96% win at every level (biome-spread.mjs):
  // a permanent half-damage aura, not a biome.
  f.hero.shield = 0;   // an unused Bubble pops; it guards the round it was cast in
  f.hero.knightUsed = false; f.hero.hunterUsed = false; f.hero.lastMiss = null;
  f.hero.breakWindow = false;
  // legacy: the sim clears Brace at the top of every round after the first,
  // so the halving never applies. Rulebook: it lasts through this turn.
  if (f.legacy && f.round > 1) f.boss.braced = false;
  f.phase = 'act';
  say(f, `Round ${f.round}. ${ready(f)} Ready.`, raging(f) ? 'rage' : '');
  if (raging(f)) say(f, 'Rage: double damage, no guard.', 'rage');
  else if (f.round === f.boss.rage - 1) say(f, 'Rage next round.', 'rage');
  if (f.hero.ally && !f.legacy) { dealToBoss(f, 'body', UNIT, 'Ally'); }
}

/** Attack options with affordability, for the runner's hand and the strategies. */
export function legalAttacks(f) {
  const r = ready(f);
  return f.hero.attacks.map((a) => {
    const bet = a.bet === 'any' ? 1 : (a.bet || 0);
    return { ...a, canAfford: f.phase === 'act' && a.actions <= f.actionsLeft && bet <= r && (a.bet !== 'any' || r >= 1) };
  });
}

/** The step an attack will be checked at, after the mode dial and a Roar. */
export function effectiveStep(f, a) {
  let step = a.check || null;
  if (f.legacy) return f.hero.penaltyArmed ? 'even' : step;
  if (step && f.hero.penaltyArmed) step = shiftStep(step, 1);
  if (step) step = shiftStep(step, MODE_SHIFT[f.mode] || 0);
  return step;
}

/** The element an attack carries: the card's, else the hero's. */
export const attackElement = (f, a) => a.element || f.hero.element;

/** Flat bonus a landed attack of this element collects (affinity + biome + Relic + Mage). */
export function attackBonus(f, a) {
  let bonus = f.hero.flatBonus || 0; // tools/sim.py --bonus: a flat affinity stand-in
  const el = attackElement(f, a);
  if (beats(f.data, el, f.boss.element)) bonus += UNIT;
  if (f.biome?.element && f.biome.element === el) bonus += UNIT;
  if (f.hero.relic) bonus += UNIT;
  if (f.hero.klass === 'mage' && a.id === 'focus') bonus += UNIT;
  return bonus;
}

/** Halving always lands on a whole 25: this game never asks a child to hold a 37. */
const halve = (d) => Math.floor(d / 2 / UNIT) * UNIT;

/**
 * Damage a landed attack deals, before Brace.
 *
 * Hidden halves it, which is the whole answer to "does the order of my actions
 * matter" (RULES.md section 5, Striking from cover). Movement in this game is
 * free: you walk up to the boss, you climb it, you say where you are, and no
 * card charges you for it. Running away is the one move that is NOT free, and
 * before this rule it was also free to put FIRST, so the safe play was to hide
 * and then swing with nothing at risk. Now hiding costs the rest of the turn's
 * weight, so Run goes at the end and the tactic has a shape: hit, then hide.
 *
 * Deliberately here rather than in applyHit, so the preview under a queued step
 * shows the halved number BEFORE the die is thrown. A rule the player only
 * meets in the log is a rule they meet too late.
 */
export function attackDamage(f, a, bet) {
  const base = a.damage === '4x bet' ? 4 * bet * UNIT : a.damage;
  const full = base + attackBonus(f, a);
  if (!f.hero.hidden || f.legacy) return full;
  // Never below one card's worth. halve() floors to a whole 25, so a Strike's
  // 25 halved is 0: the card that "always lands" landed for nothing, took an
  // action, counted as a hit, opened no break window, and printed "Strike:
  // lands." with no damage clause to explain any of it. Half, or 25, whichever
  // is more: the penalty is meant to cost you the difference, not the card.
  return full > 0 ? Math.max(UNIT, halve(full)) : 0;
}

/**
 * Resolve one attack.
 * @param {object} a       an entry from legalAttacks()
 * @param {object} o       { bet, target: 'body'|index, roll, u, useRune, hide }
 *   roll: the die result (runner);  u: uniform [0,1) (strategies). One of them.
 * @returns {{hit:boolean, auto:boolean, step, need, dealt, roll}}
 */
export function attack(f, a, o = {}) {
  if (f.phase !== 'act' || a.actions > f.actionsLeft) throw new Error('not legal now');
  // Bubble costs an ACTION, never a card. Betting a card to absorb 25 would be
  // strictly worse than guarding with it, since a Ready card guards for free and
  // comes back. Spending an action makes it the mirror of Strike: deal 25, or
  // stop 25. It is also the only attack card worth anything under Rage, where
  // nothing can be guarded at all.
  if (a.shield) {
    f.actionsLeft -= a.actions;
    f.hero.shield += a.shield;
    say(f, `Bubble: the next ${a.shield} damage is absorbed.`, 'hero');
    return { hit: true, auto: true, shield: a.shield, dealt: 0, bet: 0, step: null, need: null, roll: null };
  }
  // Run costs an action and no card, like Bubble, and it deals no damage at all.
  // Without this branch it fell through to applyHit and, because its element is
  // null, attackElement handed it the hero's element and it collected affinity,
  // biome and Relic bonuses: a 1-action, no-bet, no-check card dealing up to 75.
  // Every test passed in that state, because none of them assert that a card
  // with no damage deals none.
  // Taunt: the Knight buys information. The boss's die is thrown NOW, face up,
  // and bossRoll is bound to it. o.roll carries the face; without one the fight
  // waits in awaitForetell for the table to say what the real d6 showed.
  if (a.foretells) {
    f.actionsLeft -= a.actions;
    const face = o.roll ? Math.max(1, Math.min(6, Math.round(o.roll))) : null;
    if (face) { f.foretold = face; say(f, `Taunt: the boss will roll ${face}.`, 'hero'); }
    else f.awaitForetell = true;
    return { hit: true, auto: true, foretells: true, dealt: 0, bet: 0, step: null, need: null, roll: face };
  }
  if (a.hides) {
    f.actionsLeft -= a.actions;
    f.hero.hidden = true;
    say(f, 'Run: you are Hidden. The boss has to find you.', 'hero');
    return { hit: true, auto: true, hides: true, dealt: 0, bet: 0, step: null, need: null, roll: null };
  }
  const bet = a.bet === 'any' ? Math.max(1, Math.min(o.bet || 1, ready(f))) : (a.bet || 0);
  if (bet > ready(f)) throw new Error('cannot afford the bet');
  // Betting turns cards sideways whether the attack lands or not.
  let n = bet;
  for (const c of f.hero.pool) { if (n > 0 && c.st === 'ready') { c.st = 'spent'; n--; } }
  f.actionsLeft -= a.actions;
  f.stats.attacks += 1;
  if (a.id === 'all-in') f.stats.allIns += 1;

  const step = effectiveStep(f, a);
  f.hero.penaltyArmed = false; f.hero.penalty = false; // a Roar is spent on the next attack
  const odds = stepOdds(step);
  let hit, auto = false, need = null, rollShown = o.roll ?? null;
  if (o.useRune && f.hero.rune > 0 && step) { f.hero.rune -= 1; hit = true; auto = true; }
  else if (!step) { hit = true; auto = true; }
  else if (o.u !== undefined) hit = o.u < odds;
  else { need = targetFor(f.die, step); hit = (o.roll ?? 0) >= need; }

  const dealt = hit ? applyHit(f, a, bet, o.target) : 0;
  if (hit) f.stats.hits += 1;
  // The break window belongs to the hit that opened it: one landed attack, one
  // chance to say where it landed. A miss closes it too, so a break can never
  // be carried over from an earlier swing.
  f.hero.breakWindow = hit && dealt > 0;
  f.hero.lastMiss = (!hit && f.hero.klass === 'hunter' && !f.hero.hunterUsed) ? { a, bet, target: o.target, hidden: f.hero.hidden } : null;
  say(f, `${a.name || a.id}${bet ? ` (bet ${bet})` : ''}: ${auto ? 'lands' : hit ? 'hit' : 'miss'}${dealt ? `, ${dealt} damage` : ''}.`, hit ? 'hero' : 'bad');
  return { hit, auto, step, need, dealt, roll: rollShown, bet };
}

/** Hunter: once per round, reroll one failed check. Same odds, same damage. */
export function reroll(f, o = {}) {
  const m = f.hero.lastMiss;
  if (!m || f.hero.hunterUsed) throw new Error('no reroll available');
  f.hero.hunterUsed = true; f.hero.lastMiss = null;
  // The docstring's promise is "same odds, same damage", and effectiveStepNoPenalty
  // already protects the odds half from a Roar landing in between. The damage half
  // had no equivalent: applyHit re-runs attackDamage, which reads hidden AS IT IS
  // NOW, so a Run played after the miss halved the reroll of an attack made in the
  // open. Price it as the original attack was priced.
  const wasHidden = f.hero.hidden;
  f.hero.hidden = !!m.hidden;
  const step = effectiveStepNoPenalty(f, m.a);
  const odds = stepOdds(step);
  let hit, need = null;
  if (o.u !== undefined) hit = o.u < odds;
  else { need = targetFor(f.die, step); hit = (o.roll ?? 0) >= need; }
  const dealt = hit ? applyHit(f, m.a, m.bet, m.target) : 0;
  if (hit) f.stats.hits += 1;
  // A rerolled hit is a landed attack, so it opens the break window like any
  // other. The miss it replaces had already closed it, and the class whose
  // whole ability is turning a miss into a hit was the one class that could
  // never break a part.
  f.hero.hidden = wasHidden;
  f.hero.breakWindow = hit && dealt > 0;
  say(f, `Reroll: ${hit ? `hit, ${dealt} damage` : 'miss'}.`, hit ? 'hero' : 'bad');
  return { hit, need, dealt };
}
function effectiveStepNoPenalty(f, a) {
  let step = a.check || null;
  if (step && !f.legacy) step = shiftStep(step, MODE_SHIFT[f.mode] || 0);
  return step;
}

function applyHit(f, a, bet, target) {
  let dealt = attackDamage(f, a, bet);
  // Skitter left it off balance: the next landed hit takes the opening, once.
  if (f.boss.offBalance && dealt > 0) { dealt += UNIT; f.boss.offBalance = false; say(f, 'It was off balance: +25.', 'good'); }
  if (f.boss.braced) dealt = halve(dealt);
  dealToBoss(f, target, dealt, a.name || a.id);
  return dealt;
}

/** Damage to the body or a minion (index). Minions do not spill to the body. */
function dealToBoss(f, target, amount, who) {
  if (amount <= 0) return;
  if (typeof target === 'number' && f.boss.minions[target]) {
    const m = f.boss.minions[target];
    m.hp -= amount;
    if (m.hp <= 0) {
      f.boss.minions.splice(target, 1);
      say(f, `${who} fells a minion.`, 'good');
      if (f.hero.klass === 'necromancer') { f.hero.pool.push(card('boss')); say(f, 'Necromancer takes one of its cards as a Ready life card.', 'good'); }
    }
  } else {
    f.boss.body = Math.max(0, f.boss.body - amount);
  }
  if (bossDown(f)) {
    f.phase = 'won';
    say(f, 'The boss falls!', 'good');
    // The minions were its life, carried off the wall. With the wall gone they
    // have nothing to guard, so they scatter rather than fight on alone.
    if (f.boss.minions.length) { say(f, `Its minions scatter.`, 'good'); f.boss.minions = []; }
  }
}

/**
 * Attempt the comeback. Pass a die `roll` (a human) or a uniform `u` (the sim).
 * Success voids the damage that felled you and stands `returns` Broken cards
 * back up; failure ends the level exactly as before the card existed.
 *
 * On success the fight resumes exactly where the fall interrupted it, which is
 * why `f.fell` exists. This used to read `f.phase = f.pending ? 'boss' : 'act'`,
 * and the condition can never be true: both callers of `take` that can fell you
 * run after `resolveBoss` has already nulled `pending`. So every revived hero
 * landed in 'act' and got a turn the boss phase never finished handing over: no
 * Recover, no round increment, no Castle second act, no stall cap. `resumeFall`
 * finishes the interrupted step instead. Nothing outside the engine can do this,
 * because the count of minions still owed a strike is not visible from a view.
 */
export function attemptRevive(f, o = {}) {
  if (f.phase !== 'down') throw new Error('not Down');
  const step = reviveStep(f);
  let ok = true, need = null;
  if (step) {
    if (o.u !== undefined) ok = o.u < stepOdds(step);
    else { need = targetFor(f.die, step); ok = (o.roll ?? 0) >= need; }
  }
  // Read the ladder BEFORE the counter moves: revives is the number of comebacks
  // already spent, so this one is the (revives + 1)th and takes the rung it stands on.
  const owed = o.returns ?? reviveReturns(f);
  f.hero.revives += 1;
  if (!ok) { f.phase = 'lost'; say(f, 'The comeback fails. You are Down.', 'bad'); return { ok: false, step, need }; }
  let back = owed;
  for (const c of f.hero.pool) { if (back > 0 && c.st === 'broken') { c.st = 'ready'; back--; } }
  say(f, `Second Wind holds! Back up with ${owed} cards.`, 'good');
  return { ok: true, step, need, resumed: resumeFall(f) };
}

/**
 * Put a revived hero back into the step that felled them. Returns what that step
 * returned, so a caller can report Castle acting again.
 */
function resumeFall(f) {
  const fell = f.fell;
  f.fell = null;
  f.phase = 'boss';
  // A minion in the middle of the line felled you; the rest of the line still
  // strikes. Coming back does not clear the table.
  if (fell?.at === 'minions') return minionStrikes(f, fell.left);
  if (fell?.at === 'boss') return endBossPhase(f);
  // No record of the fall: the only way here is a caller that put the fight in
  // 'down' itself, so hand the turn back rather than guessing at a boss phase.
  f.phase = 'act';
  return f.phase;
}

/**
 * The Forest's free hide. Everywhere else, hiding is the Run card and costs an
 * action; this is the one biome that hands it over, once a round, because it is
 * the one made of cover. Same Hidden state either way: one rule, two sources.
 */
export function hide(f) {
  if (!f.hero.hideAvailable) throw new Error('hiding costs a Run outside the Forest');
  f.hero.hidden = true; f.hero.hideAvailable = false;
  say(f, 'You slip into the trees. The boss has to find you.', 'hero');
}

/** Play an Advantage card from the hand. Barrier is played through resolveBoss. */
export function playAdvantage(f, id) {
  const i = f.hero.advantage.indexOf(id);
  if (i < 0) throw new Error('not in hand');
  switch (id) {
    case 'cure': {
      let n = 2;
      for (const c of f.hero.pool) if (n > 0 && c.st === 'broken') { c.st = 'ready'; n--; }
      say(f, 'Cure: two Broken cards return to Ready.', 'good'); break;
    }
    case 'ally': f.hero.ally = { def: ALLY_DEF }; say(f, `Ally: a companion joins, Strikes for 25 each turn and draws the boss's Strike behind ${ALLY_DEF} defense.`, 'good'); break;
    case 'rune': f.hero.rune += 1; say(f, 'Rune: one check this level succeeds automatically.', 'good'); break;
    case 'relic': f.hero.relic = true; say(f, 'Relic: every landed attack deals +25 this level.', 'good'); break;
    case 'chest': say(f, 'Chest: draw two more Advantage cards.', 'good'); f.hero.advantage.splice(i, 1); return { draw: 2 };
    case 'barrier': throw new Error('Barrier is played when the boss acts');
    default: throw new Error(`unknown advantage ${id}`);
  }
  f.hero.advantage.splice(i, 1);
  return { draw: 0 };
}

// ── Boss turn ────────────────────────────────────────────────
/** End the hero's actions: minions strike, then the boss rolls. */
export function endTurn(f) {
  if (f.phase !== 'act') return;
  f.phase = 'boss';
  f.boss.braced = false; // Brace covered the hero's turn that just ended
  f.hero.hideAvailable = false;
  f.hero.breakWindow = false;
  minionStrikes(f, f.boss.minions.length);
}

/**
 * `n` minions strike, 25 each, and the line stops the moment the hero falls.
 * How many are still owed a strike is recorded on the fight, because a hero who
 * comes back on Second Wind faces the rest of the line: coming back does not
 * clear the table. Returns the phase the line left the fight in.
 */
function minionStrikes(f, n) {
  for (let left = n; left > 0 && f.phase === 'boss'; left--) {
    say(f, 'A minion strikes for 25.', 'boss');
    take(f, UNIT, raging(f));
    if (f.phase === 'down') f.fell = { at: 'minions', left: left - 1 };
  }
  return f.phase;
}

/**
 * The boss rolls its d6. Nothing is applied yet: the runner shows the face,
 * offers Barrier if the hero holds one, then calls resolveBoss.
 */
/**
 * The damage face `d6` would deal the hero, signature and Rage included. This
 * is what a foretold die is FOR: choose() swaps its worst-case guard reserve
 * for the known number, which is the whole value of the Knight's Taunt.
 */
export function bossFaceDamage(f, d6) {
  const rage = raging(f);
  const base = f.boss.damage * (rage ? 2 : 1);
  const sig = f.boss.signature;
  if (sig && sig.roll === d6) {
    if (sig.id === 'coil') {
      const chunk = f.boss.summonCards * f.boss.perCard;
      // A Coil that cannot summon is a Strike, and Taunt has to say so.
      return (f.boss.body > chunk && f.boss.minions.length < 3) ? UNIT : base;
    }
    return sig.id === 'stormbreak' ? base * 2 : sig.id === 'hoard' ? base : 0;
  }
  const rx = reactionFor(f.data, d6);
  const kind = rx.name.toLowerCase();
  if (kind === 'strike' || kind === 'roar') return base;
  if (kind === 'ruin') return base * 2;
  if (kind === 'summon') {
    const chunk = f.legacy ? 100 : f.boss.summonCards * f.boss.perCard;
    const can = f.legacy ? (f.boss.body > 100 && f.boss.minions.length < 3)
                         : (f.boss.body > chunk && f.boss.minions.length < 3);
    return can ? 0 : base;
  }
  return 0;
}

export function bossRoll(f, d6) {
  if (f.phase !== 'boss') throw new Error('not the boss phase');
  // A Taunt already made this roll, face up, during the hero's turn. The boss
  // is bound by what everyone saw: a foretold die that could be re-rolled here
  // would make the Knight's card a lie.
  if (f.foretold) { d6 = f.foretold; f.foretold = null; }
  // Each boss overrides ONE row of the shared table with its signature move
  // (RULES.md, "Signature moves"). Legacy mode skips them: tools/sim.py has
  // never heard of a signature and the parity test holds it to that.
  const sig = f.boss.signature;
  if (sig && sig.roll === d6) {
    const rage = raging(f);
    const base = f.boss.damage * (rage ? 2 : 1);
    const chunk = f.boss.summonCards * f.boss.perCard;
    // Coil is a Summon that also strikes, so it obeys the Summon rule it is
    // built on: a boss cannot carve out more wall than it has. Without this it
    // took the body straight past zero, and since bossDown became body-only
    // (2026-08-30) that left the boss dead by the rule with the fight still
    // running: measured at 7.5% of level 2 fights, a tenth of which the player
    // then LOST to a boss that had already fallen. A negative body also made
    // bossWall repeat() a life card a negative number of times, which throws,
    // takes renderFight down, and (because events.js saves before it renders)
    // persists the unrenderable run to localStorage. One missing guard.
    if (sig.id === 'coil' && !(f.boss.body > chunk && f.boss.minions.length < 3)) {
      f.pending = { roll: d6, kind: 'strike', dmg: base, rage, at: aimedAtAlly(f, 'strike') ? 'ally' : 'hero', name: 'Strike' };
      return f.pending;
    }
    const dmg = sig.id === 'stormbreak' ? base * 2 : sig.id === 'hoard' ? base : 0;
    f.pending = { roll: d6, kind: 'signature', sig: sig.id, dmg, chunk, rage, at: 'hero', name: sig.name };
    return f.pending;
  }
  const rx = reactionFor(f.data, d6);
  const rage = raging(f);
  const base = f.boss.damage * (rage ? 2 : 1);
  let dmg = 0, kind = rx.name.toLowerCase();
  if (kind === 'strike' || kind === 'roar') dmg = base;
  else if (kind === 'ruin') dmg = base * 2;
  else if (kind === 'summon') {
    // How much body a Summon moves is CARDS times the card's value, so making the
    // cards uniform changes the minion's size at every level at once. The count
    // is data (boss.summon_cards) rather than the literal 2 it used to be,
    // because that is the dial the uniform-100 change had to be tuned on.
    const chunk = f.legacy ? 100 : f.boss.summonCards * f.boss.perCard;
    const can = f.legacy ? (f.boss.body > 100 && f.boss.minions.length < 3)
                         : (f.boss.body > chunk && f.boss.minions.length < 3);
    if (!can) { kind = 'strike'; dmg = base; } else dmg = 0;
    // A Summon that cannot summon IS a Strike, so it can be aimed at the Ally
    // like any other. `at` is read after the downgrade, never before.
    f.pending = { roll: d6, kind, dmg, chunk, rage, at: aimedAtAlly(f, kind) ? 'ally' : 'hero', name: can ? 'Summon' : 'Strike' };
    return f.pending;
  }
  f.pending = { roll: d6, kind, dmg, rage, at: aimedAtAlly(f, kind) ? 'ally' : 'hero', name: rx.name };
  return f.pending;
}

/**
 * The Ally takes a Strike. Its 50 defense comes off the top; anything left sends
 * the figure away. Nothing reaches the hero either way, which is the whole point
 * of the card, and nothing here can fell the hero, so there is no `fell` to
 * record. Returns whether the Ally is still standing.
 */
function takeAlly(f, damage) {
  const through = Math.max(0, damage - f.hero.ally.def);
  if (through <= 0) { say(f, `The Ally takes it: ${f.hero.ally.def} defense absorbs all ${damage}.`, 'good'); return true; }
  f.hero.ally = null;
  say(f, `The Ally covers you and falls: ${through} was more than its ${ALLY_DEF} defense.`, 'bad');
  return false;
}

/**
 * Apply (or Barrier away) the pending reaction, then start the next round.
 * `cover` is the hero stepping in front of an Ally the boss aimed at: the hit
 * lands on the hero whole, guarded as normal, and the figure stays. Barrier wins
 * over cover, because a cancelled action deals nothing to anybody.
 */
export function resolveBoss(f, { barrier = false, cover = false } = {}) {
  const p = f.pending;
  if (!p) throw new Error('nothing pending');
  f.pending = null;
  if (barrier) {
    const i = f.hero.advantage.indexOf('barrier');
    if (i < 0) throw new Error('no Barrier in hand');
    f.hero.advantage.splice(i, 1);
    say(f, `Barrier cancels the boss's ${p.name}.`, 'good');
  } else {
    switch (p.kind) {
      case 'brace': f.boss.braced = true; say(f, 'The boss Braces: no damage, and it halves what it takes until the end of your next turn.', 'boss'); break;
      case 'summon': {
        f.boss.body = Math.max(0, f.boss.body - p.chunk); f.boss.minions.push({ hp: p.chunk, max: p.chunk });
        say(f, `The boss Summons: ${p.chunk} of its life moves under a minion.`, 'boss'); break;
      }
      case 'signature': {
        switch (p.sig) {
          case 'skitter':
            f.boss.offBalance = true;
            say(f, 'Skitter: it darts aside, no damage, and it is off balance. Your next landed hit deals +25.', 'boss');
            break;
          case 'coil': {
            f.boss.body = Math.max(0, f.boss.body - p.chunk); f.boss.minions.push({ hp: p.chunk, max: p.chunk });
            say(f, `Coil: ${p.chunk} of its life moves under a minion, and the minion strikes at once.`, 'boss');
            take(f, UNIT, raging(f));
            break;
          }
          case 'bedrock': {
            f.boss.braced = true;
            f.boss.body = Math.min(f.boss.maxHp, f.boss.body + UNIT);
            say(f, 'Bedrock: it braces, and 25 of its wall grinds back into place.', 'boss');
            break;
          }
          case 'stormbreak': {
            // Measured into this shape: a flat x3 or x4 taxed CAREFUL play
            // hardest (a pre-Rage 300+ into any pool is mass breakage) and left
            // the level 4 inversion wider than before. Conditional on an empty
            // guard, it taxes exactly the player it was designed to: the storm
            // finds the unguarded.
            const naked = f.hero.pool.every((c) => c.st !== 'ready');
            say(f, `Stormbreak! Ruin: ${p.dmg}.${naked ? ' No card of yours is standing: it Ruins AGAIN.' : ''}`, 'boss');
            take(f, p.dmg, p.rage, 'ruin');
            // The second Ruin only lands on a hero still standing: take()
            // moves the fight to 'down' the moment the first one fells you.
            if (naked && f.phase === 'boss') take(f, p.dmg, p.rage, 'ruin');
            break;
          }
          case 'hoard': {
            // Measured into this shape, twice. Steal PLUS a full Roar collapsed
            // level 5 by 12.6 points; steal INSTEAD of damage handed reckless
            // play +13.5, because a no-damage face is a gift to whoever kept
            // nothing back. Conditional is the answer both times: it takes a
            // standing card if you have one, and Roars at you if you do not.
            const i = f.hero.pool.findIndex((c) => c.st === 'ready');
            if (i >= 0) {
              say(f, 'Hoard: the boss deals nothing. It is busy pocketing your life.', 'boss');
              f.hero.pool.splice(i, 1);
              f.boss.body = Math.min(f.boss.maxHp, f.boss.body + UNIT);
              say(f, 'It steals a Ready life card: gone for the level, and its 25 joins the wall.', 'bad');
            } else {
              say(f, `Hoard: nothing standing to steal. It Roars for ${p.dmg} instead.`, 'boss');
              take(f, p.dmg, p.rage, 'roar'); f.hero.penalty = true;
            }
            break;
          }
        }
        break;
      }
      case 'roar': say(f, `The boss Roars for ${p.dmg}. Your next check is one step harder.`, 'boss'); take(f, p.dmg, p.rage, 'roar'); f.hero.penalty = true; break;
      case 'ruin': say(f, `Ruin! The boss deals ${p.dmg}.`, 'boss'); take(f, p.dmg, p.rage, 'ruin'); break;
      default: {
        // A Strike aimed at the Ally, unless the hero covers for it. `at` was
        // decided when the die was rolled, so a cover cannot be offered for a
        // hit that was never the Ally's.
        const atAlly = p.at === 'ally' && f.hero.ally && !cover;
        say(f, `The boss Strikes ${atAlly ? 'at the Ally' : ''} for ${p.dmg}.`.replace('  ', ' '), 'boss');
        if (atAlly) takeAlly(f, p.dmg);
        else if (p.at === 'ally' && cover) {
          // Covering means stepping out of cover. Otherwise a Hidden hero could
          // cover the Ally for free every round, the Ally could never fall, and
          // the choice RULES.md section 7 names as a real one would stop being
          // one. You cannot be behind the sofa and in front of your friend.
          if (f.hero.hidden) { f.hero.hidden = false; say(f, 'You break cover to shield the Ally.', 'hero'); }
          say(f, 'You cover the Ally and take it whole.', 'hero');
          take(f, p.dmg, p.rage);
        } else {
          take(f, p.dmg, p.rage, 'strike');
        }
      }
    }
  }
  // Felled by the reaction: remember where, so a comeback finishes this step
  // rather than being handed a turn the boss phase never completed.
  if (f.phase === 'down') f.fell = { at: 'boss' };
  if (f.phase === 'boss') return endBossPhase(f);
  return f.phase;
}

/**
 * What closes a boss phase once its damage is settled: Castle's extra act, the
 * stall cap, or the next round. Separate from resolveBoss because attemptRevive
 * has to run exactly this and no more when a comeback lands mid-reaction.
 */
function endBossPhase(f) {
  // Castle: the boss acts twice on round 1. Leave the phase open for a second
  // roll, and let Spent guards Recover in between: without that breath the
  // second swing broke the guards the first one spent, three cards a fight,
  // every fight, and the cell measured 0.0% (tools/checks/biome-spread.mjs).
  if (f.boss.actsTwice && f.round === 1 && !f._secondAct) {
    f._secondAct = true;
    for (const c of f.hero.pool) if (c.st === 'spent') c.st = 'ready';
    say(f, 'Castle: the boss acts again. You catch your breath between swings.', 'boss');
    return 'again';
  }
  f._secondAct = false;
  if (f.round >= MAX_ROUNDS) { f.phase = 'stall'; return 'stall'; }
  startRound(f);
  return f.phase;
}

/**
 * Resolve incoming damage (tools/sim.py Player.take, plus Hide and Knight).
 * Guarding with a Ready card Spends it (it comes back next round); with a
 * Spent card it Breaks. Under Rage nothing can be guarded with Ready cards.
 */
export function take(f, damage, unguardable, kind = null) {
  // Hidden is spent by the BOSS and by nothing else. minionStrikes runs before
  // bossRoll, so while a minion could consume it a single Summon was a permanent
  // counter to the card: every Run after it paid an action to soak 25 of chip
  // damage while the boss's own hit landed whole. A minion passes kind=null and
  // walks straight past this block.
  if (f.hero.hidden && kind) {
    if (kind === 'strike') {
      say(f, 'Hidden: the Strike goes past you. No damage.', 'good');
      f.hero.hidden = false;
      return true;
    }
    damage = halve(damage);
    say(f, `Hidden: ${kind === 'ruin' ? 'Ruin' : 'it'} finds you anyway, halved to ${damage}.`, 'hero');
    f.hero.hidden = false;
  }
  if (f.hero.shield > 0 && damage > 0) {
    const popped = Math.min(f.hero.shield, damage);
    f.hero.shield -= popped; damage -= popped;
    say(f, `Bubble absorbs ${popped}.`, 'hero');
  }
  if (f.hero.klass === 'knight' && !f.hero.knightUsed && !unguardable && damage > 0) { damage -= UNIT; f.hero.knightUsed = true; say(f, 'Knight guards 25 for free.', 'hero'); }
  let owed = Math.floor(damage / UNIT);
  if (owed <= 0) return true;
  if (!unguardable) {
    let used = 0;
    for (const c of f.hero.pool) if (owed > 0 && c.st === 'ready') { c.st = 'spent'; owed--; used++; }
    // Say it now: Recover stands these cards back up at the start of the next
    // round, and a guard nobody saw looks like damage that vanished.
    if (used) say(f, `Guarded ${used * UNIT} with ${used} Ready card${used > 1 ? 's' : ''}; they return next round.`, 'hero');
  }
  for (const st of ['ready', 'spent']) {
    for (const c of f.hero.pool) if (owed > 0 && c.st === st) { c.st = 'broken'; owed--; }
  }
  if (owed > 0) {
    // With Second Wind in play, Down is not the end yet: the runner (or a
    // strategy) gets to attempt the comeback before the level is lost.
    if (canRevive(f)) { f.phase = 'down'; say(f, 'You are Down. Second Wind?', 'bad'); return false; }
    f.phase = 'lost'; say(f, 'You are Down.', 'bad'); return false;
  }
  if (broken(f)) say(f, `${broken(f)} Broken.`, 'bad');
  return true;
}
