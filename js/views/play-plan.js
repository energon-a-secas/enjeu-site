// ── The plan lane ────────────────────────────────────────────
// A turn is DECLARED and then played. The player clicks a card once per action
// they want it to take, the clicks become numbered steps in order, and one
// button walks the lane. Nothing here touches the DOM or the strings, so the
// tests drive the same code the board does (tests/play.test.mjs).
//
// Rulings this file makes where RULES.md is silent (the rulebook is the source
// of the rules and it does not know about a screen, so these are UI readings of
// section 5, kept as conservative as they can be):
//   - Declaring a turn changes nothing until it resolves. RULES section 5 costs
//     the bet when the attack is made, so a queued step stakes no card and a
//     dropped step gives nothing back: there is nothing to give back.
//   - A plan is checked when it is built AND again before every step, because
//     the fight moves while the lane resolves (a minion falls, a bet spends the
//     card a later step needed). An illegal plan STOPS at that step with its
//     reason; it never skips the step and carries on.
//   - Ready cards do not recover mid-turn (section 4 recovers them at the start
//     of a turn), so simulating the bets forward is exact, not an estimate.
//   - A Rune attached to a step is the rulebook's "declare it before rolling",
//     one step earlier: the Rune is played the moment it is attached, and the
//     engine spends it on that step's check.

import { legalAttacks, effectiveStep, attack, ready } from '../game/engine.js';

/** The hero's copy of a card by id. Steps store the id, never the card. */
export const attackFor = (f, id) => f.hero.attacks.find((x) => x.id === id) || null;

/** What a step stakes: the card's fixed bet, or the player's number for 'any'. */
export const betFor = (a, st) => (a.bet === 'any' ? Math.max(1, st.bet || 1) : (a.bet || 0));

/** Actions a whole plan costs. */
export const planActions = (f, plan) => plan.reduce((n, st) => n + (attackFor(f, st.id)?.actions || 0), 0);

/** Runes played but not yet spoken for by a step. */
export const runeSpare = (f, plan) => (f.hero.rune || 0) - plan.filter((st) => st.rune).length;

/**
 * Is this plan playable, start to finish, from the fight as it stands?
 * @returns {{ok:boolean, reason:string|null, at:number}} reason is a strings.js
 *   key under `play.`: 'tooManyActions' or 'notEnoughReady'.
 */
export function validatePlan(f, plan) {
  let actions = 0, readyLeft = ready(f);
  for (let i = 0; i < plan.length; i++) {
    const a = attackFor(f, plan[i].id);
    if (!a) return { ok: false, reason: 'gone', at: i };
    actions += a.actions;
    if (actions > f.actionsLeft) return { ok: false, reason: 'tooManyActions', at: i };
    const bet = betFor(a, plan[i]);
    if (bet > readyLeft) return { ok: false, reason: 'notEnoughReady', at: i };
    readyLeft -= bet;
  }
  return { ok: true, reason: null, at: -1, actions, readyLeft };
}

/** Ready cards the plan has not staked by the time step i is reached. */
export function readyAt(f, plan, i) {
  let left = ready(f);
  for (let k = 0; k < i && k < plan.length; k++) {
    const a = attackFor(f, plan[k].id);
    if (a) left -= betFor(a, plan[k]);
  }
  return Math.max(0, left);
}

/**
 * The most step i could stake: every Ready card no OTHER step has claimed.
 * The old on-board ceiling was readyAt(i) + own bet, which double-counted the
 * step's own stake and ignored steps queued after it, so a 4-card pool could
 * render 7 chips and the top ones were dead buttons validatePlan refused.
 */
export function betRoom(f, plan, i) {
  const a = attackFor(f, plan[i].id);
  if (!a) return 1;
  return Math.max(1, readyAt(f, plan, plan.length) + betFor(a, plan[i]));
}

/** One more action of `id` at the end of the lane, or a refusal with its reason. */
export function queueStep(f, plan, id, { target = 'body' } = {}) {
  const a = attackFor(f, id);
  if (!a) return { ok: false, reason: 'gone' };
  const next = [...plan, { id, bet: a.bet === 'any' ? 1 : 0, target, rune: false }];
  const v = validatePlan(f, next);
  return v.ok ? { ok: true, plan: next } : { ok: false, reason: v.reason };
}

export function unqueueStep(plan, i) {
  const out = [...plan];
  if (i >= 0 && i < out.length) out.splice(i, 1);
  return out;
}

/** Restake step i. Refuses rather than silently clamping: the number is the plan. */
export function setStepBet(f, plan, i, n) {
  const out = plan.map((st, k) => (k === i ? { ...st, bet: Math.max(1, n) } : st));
  const v = validatePlan(f, out);
  return v.ok ? { ok: true, plan: out } : { ok: false, reason: v.reason };
}

/** Attach or detach the Rune on step i. Only a step with a check has one to skip. */
export function toggleStepRune(f, plan, i) {
  const st = plan[i];
  const a = st && attackFor(f, st.id);
  if (!a || !effectiveStep(f, a)) return { ok: false, reason: 'noCheck' };
  if (!st.rune && runeSpare(f, plan) <= 0) return { ok: false, reason: 'noRune' };
  return { ok: true, plan: plan.map((x, k) => (k === i ? { ...x, rune: !x.rune } : x)) };
}

/** Cycle a step's target: the body, then each minion in play. */
export function cycleStepTarget(f, plan, i) {
  const n = f.boss.minions.length;
  const st = plan[i];
  if (!st || !n) return plan;
  const order = ['body', ...f.boss.minions.map((_, k) => k)];
  const at = order.findIndex((x) => x === st.target);
  const next = order[(at + 1) % order.length];
  return plan.map((x, k) => (k === i ? { ...x, target: next } : x));
}

/** The step the lane is waiting on, if any, and what it needs rolled. */
export function awaitingStep(f, ui) {
  if (ui.awaiting === null || ui.awaiting === undefined) return null;
  const st = (ui.plan || [])[ui.awaiting];
  const a = st && attackFor(f, st.id);
  if (!a) return null;
  return { i: ui.awaiting, st, a, step: effectiveStep(f, a) };
}

/**
 * Walk the lane from `ui.at`, resolving everything that needs no die and
 * stopping at the first step that does. Hand that step's `roll` back in to
 * carry on. The roll comes from the caller (a human's die or a test's stream);
 * nothing in here or in the engine invents one.
 *
 * @returns {{done?:boolean, awaiting?:number, error?:string, phase?:string}}
 */
export function advancePlan(f, ui, roll = null) {
  ui.plan ||= [];
  ui.at ||= 0;
  ui.error = null;
  while (ui.at < ui.plan.length) {
    if (f.phase !== 'act') { ui.awaiting = null; return { done: true, phase: f.phase }; }
    // Only the REMAINDER is re-checked: the fight already carries the cost of
    // every step behind us, so validating the whole lane would count it twice.
    const v = validatePlan(f, ui.plan.slice(ui.at));
    if (!v.ok) { ui.awaiting = null; ui.error = v.reason; return { error: v.reason, at: ui.at }; }
    const st = ui.plan[ui.at];
    const a = attackFor(f, st.id);
    const step = effectiveStep(f, a);
    const useRune = !!st.rune && !!step && f.hero.rune > 0;
    if (step && !useRune && roll === null) { ui.awaiting = ui.at; return { awaiting: ui.at, step }; }
    const target = typeof st.target === 'number' && f.boss.minions[st.target] ? st.target : 'body';
    const r = attack(f, a, { bet: betFor(a, st), target, roll: step && !useRune ? roll : null, useRune });
    ui.last = { name: a.name, hit: r.hit, auto: r.auto, dealt: r.dealt, roll: r.roll ?? null, need: r.need, i: ui.at };
    ui.awaiting = null;
    ui.at += 1;
    roll = null;              // the roll belonged to that one step
  }
  return { done: true, phase: f.phase };
}

/** Cards that can still be added to this plan, for the hand's disabled state. */
export function pickable(f, plan) {
  const out = {};
  for (const a of legalAttacks(f)) out[a.id] = queueStep(f, plan, a.id).ok;
  return out;
}
