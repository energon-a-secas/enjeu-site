// ── Play styles (contract C4) ────────────────────────────────
// The four stand-ins for how a person plays, ported from tools/sim.py:
// turtle never bets, safe keeps a guard, adaptive takes a likely kill shot,
// gamble bets everything. They pick from the same legalAttacks() the human
// sees and call the same attack()/resolveBoss(), so nothing here can know a
// rule the runner does not.

import { UNIT, stepOdds } from './rules.js';
import { legalAttacks, attack, reroll, hide, ready, alive, broken, raging, playAdvantage, effectiveStep, attackBonus, attackDamage, bossFaceDamage } from './engine.js';

export const STYLES = ['turtle', 'safe', 'adaptive', 'gamble'];

/** All In variants: bet 1..ready, each a distinct option like sim.py's all_in(n). */
function pool(f) {
  const out = [];
  for (const a of legalAttacks(f)) {
    if (a.bet === 'any') { for (let n = 1; n <= ready(f); n++) out.push({ ...a, bet: 'any', betN: n }); }
    else out.push({ ...a, betN: a.bet || 0 });
  }
  return out;
}

/** Every legal multiset of 1..3 attacks: <= 3 actions, total bet <= min(budget, ready). */
export function affordable(f, budget) {
  const p = pool(f);
  const cap = Math.min(budget, ready(f));
  const out = [];
  const rec = (start, combo, actions, bet) => {
    if (combo.length) out.push(combo.slice());
    if (combo.length === 3) return;
    for (let i = start; i < p.length; i++) {
      const a = p[i];
      if (actions + a.actions > f.actionsLeft) continue;
      if (bet + a.betN > cap) continue;
      combo.push(a); rec(i, combo, actions + a.actions, bet + a.betN); combo.pop();
    }
  };
  rec(0, [], 0, 0);
  return out;
}

const hitOdds = (f, a) => stepOdds(effectiveStep(f, a));
const dmgOf = (f, a) => attackDamage(f, a, a.betN);
const halved = (d) => Math.floor(d / 2 / UNIT) * UNIT;

/** Chance this combo finishes `hp`, enumerating hit/miss outcomes (sim.py p_kill). */
export function pKill(f, combo, hp) {
  let total = 0;
  const n = combo.length;
  for (let mask = 0; mask < (1 << n); mask++) {
    let p = 1, dealt = 0;
    for (let i = 0; i < n; i++) {
      const a = combo[i], h = hitOdds(f, a), landed = (mask >> i) & 1;
      p *= landed ? h : 1 - h;
      if (landed) { const d = dmgOf(f, a); dealt += f.boss.braced ? halved(d) : d; }
    }
    if (dealt >= hp) total += p;
  }
  return total;
}

export function expected(f, combo) {
  let out = 0;
  for (const a of combo) { const d = dmgOf(f, a); out += hitOdds(f, a) * (f.boss.braced ? halved(d) : d); }
  return out;
}

/** The target a strategy aims at: the body while it stands, then the weakest minion. */
export function targetFor(f) {
  if (f.boss.body > 0 || f.legacy) return 'body';
  let best = -1, hp = Infinity;
  f.boss.minions.forEach((m, i) => { if (m.hp < hp) { hp = m.hp; best = i; } });
  return best < 0 ? 'body' : best;
}
const targetHp = (f) => { const t = targetFor(f); return t === 'body' ? f.boss.body : f.boss.minions[t].hp; };

/** Pick a turn (sim.py choose). Styles differ only in how much life they will bet. */
export function choose(f, style) {
  const desperate = f.round >= f.boss.rage - 1;
  // A foretold die (Taunt) replaces the worst-case guard reserve with the KNOWN
  // incoming number. This is the whole value of the card: a Brace foretold
  // frees every reserved card to attack.
  const guardNeed = f.foretold
    ? Math.ceil(bossFaceDamage(f, f.foretold) / UNIT)
    : Math.ceil(f.boss.damage / UNIT);
  const r = ready(f);
  const budget = { turtle: 0, safe: Math.max(0, r - guardNeed), adaptive: Math.max(0, r - guardNeed), gamble: r }[style];
  let options = affordable(f, budget);
  const strike = legalAttacks(f).find((a) => a.id === 'strike');
  if (!options.length) return strike ? [{ ...strike, betN: 0 }, { ...strike, betN: 0 }, { ...strike, betN: 0 }] : [];
  if (style === 'adaptive') {
    const wide = affordable(f, r);
    const hp = targetHp(f);
    let best = null, odds = -1;
    for (const c of wide) { const p = pKill(f, c, hp); if (p > odds) { odds = p; best = c; } }
    if (odds >= 0.6 || (desperate && odds >= 0.3)) return best;
  }
  let best = null, ev = -1;
  for (const c of options) { const e = expected(f, c); if (e > ev) { ev = e; best = c; } }
  return best;
}

/** Advantage cards a style plays at the start of its turn (rulebook mode only). */
export function playOpeners(f, drawFn) {
  if (f.legacy) return;
  const hand = () => f.hero.advantage.slice();
  for (const id of hand()) {
    if (id === 'cure' && broken(f) >= 2) playAdvantage(f, 'cure');
    else if (id === 'relic' || id === 'ally' || id === 'rune') playAdvantage(f, id);
    else if (id === 'chest') { const r = playAdvantage(f, 'chest'); for (let i = 0; i < r.draw; i++) { const c = drawFn?.(); if (c) f.hero.advantage.push(c); } }
  }
}

/** Should a style spend its Barrier on this pending reaction? */
export function wantsBarrier(f, pending) {
  if (!f.hero.advantage.includes('barrier')) return false;
  if (pending.dmg <= 0) return false;
  // A hit the Ally is standing in front of costs the hero nothing at all, so a
  // Barrier spent on it buys one figure and loses the answer to the next Ruin.
  // Measured before this line existed: at level 3 every Ally that "survived" a
  // 75-damage Strike survived because a Barrier had been spent on it.
  if (pending.at === 'ally' && f.hero.ally) return false;
  const cards = pending.dmg / UNIT;
  if (pending.kind === 'ruin') return true;
  if (pending.rage) return cards >= 2;
  return cards > ready(f); // it would start breaking cards
}

/**
 * Play one whole hero turn for a style: openers, the chosen combo with rune
 * and hunter handling, targets. `next` is the uniform stream.
 */
/**
 * Bubbles to cast before attacking. Three conditions, all necessary, and the
 * first measured pass got this wrong in a way worth recording: bubbling merely
 * because the next hit looks lethal LOSES up to 10 points of win rate, because
 * an action spent absorbing is an action not spent shortening the fight, and
 * under Rage the clock is what kills you. Stalling a death you cannot prevent
 * just moves it one round later with less damage dealt.
 *
 * So: only under Rage (outside it a Ready card guards for free and an action is
 * worth more), only when the bubbles available actually CLOSE the gap, and only
 * when the boss cannot simply be killed this turn instead.
 */
export function bubblesNeeded(f, style) {
  if (style !== 'safe' && style !== 'adaptive') return 0;
  const bub = legalAttacks(f).find((a) => a.shield);
  if (!bub || !raging(f)) return 0;
  const incoming = f.boss.damage * 2 + f.boss.minions.length * UNIT;
  const shortfall = Math.ceil(incoming / UNIT) - alive(f);
  if (shortfall <= 0) return 0;                 // you survive it anyway
  if (shortfall > f.actionsLeft) return 0;      // cannot be saved; swing instead
  const hp = f.boss.body > 0 || f.legacy ? f.boss.body : Math.min(...f.boss.minions.map((m) => m.hp));
  const kill = affordable(f, ready(f));
  if (kill.some((c) => pKill(f, c, hp) >= 0.5)) return 0;   // a likely kill beats surviving
  return shortfall;
}

/**
 * Whether to Run before attacking. Same shape as bubblesNeeded and for the same
 * reason: an action spent hiding is an action not spent shortening the fight,
 * and under Rage the clock is what kills you.
 *
 * Where it differs is that Run scales with the boss and Bubble does not. Bubble
 * stops a flat 25; Run stops the whole Strike a third of the time and half of
 * everything else, so its expected saving is half the boss's Damage, doubled
 * under Rage. At level 1 that is 25, the same as a Bubble. At level 5 under Rage
 * it is 100, which is four Bubbles for one action.
 *
 * Outside Rage it is still usually wrong: a Ready card guards for free, so the
 * only damage worth dodging is damage you cannot guard.
 */
export function wantsRun(f, style) {
  if (style !== 'safe' && style !== 'adaptive') return false;
  const run = legalAttacks(f).find((a) => a.hides);
  if (!run || f.hero.hidden || f.actionsLeft < run.actions) return false;
  if (!raging(f)) return false;
  const incoming = f.boss.damage * 2 + f.boss.minions.length * UNIT;
  const shortfall = Math.ceil(incoming / UNIT) - alive(f);
  if (shortfall <= 0) return false;              // you survive it anyway
  const hp = f.boss.body > 0 || f.legacy ? f.boss.body : Math.min(...f.boss.minions.map((m) => m.hp));
  const kill = affordable(f, ready(f));
  if (kill.some((c) => pKill(f, c, hp) >= 0.5)) return false;  // a likely kill beats hiding
  return true;
}

export function playTurn(f, style, next, drawFn) {
  playOpeners(f, drawFn);
  // The Forest's free hide costs nothing, so a bot always takes it.
  if (f.hero.hideAvailable && !f.hero.hidden) hide(f);
  // Taunt first: information is only worth an action BEFORE the plan is made.
  // The face comes from the stream, never from inside the engine. And it is
  // only worth the action against the final boss: played every turn it costs
  // 5 to 39 points at levels 1-4 and pays +15.7 only at level 5
  // (tools/checks/taunt.mjs), where the fight is long enough to amortize the
  // information and the foretold Hoard is worth dodging.
  const taunt = legalAttacks(f).find((a) => a.foretells);
  if (taunt && !f.foretold && style !== 'turtle' && f.actionsLeft >= 3
      && f.boss.damage >= 100 && f.boss.maxHp > 1200) {
    attack(f, taunt, { roll: 1 + Math.floor(next() * 6) });
  }
  const bub = legalAttacks(f).find((a) => a.shield);
  for (let i = bubblesNeeded(f, style); i > 0 && f.actionsLeft >= bub.actions; i--) attack(f, bub, {});
  if (wantsRun(f, style)) attack(f, legalAttacks(f).find((a) => a.hides), {});
  const combo = choose(f, style);
  // Rune goes on the biggest checked attack in the combo.
  let runeOn = -1, big = 0;
  combo.forEach((a, i) => { if (a.check && dmgOf(f, a) > big) { big = dmgOf(f, a); runeOn = i; } });
  for (let i = 0; i < combo.length; i++) {
    if (f.phase !== 'act') return;
    const a = combo[i];
    if (a.actions > f.actionsLeft || (a.betN || 0) > ready(f)) continue;
    const live = legalAttacks(f).find((x) => x.id === a.id);
    if (!live) continue;
    const res = attack(f, live, { bet: a.betN, target: targetFor(f), u: next(), useRune: i === runeOn && f.hero.rune > 0 });
    if (!res.hit && f.hero.lastMiss) reroll(f, { u: next() });
  }
}
