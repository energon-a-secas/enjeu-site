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
//      value), needs body > 100, and the fight is won on body alone.
//   3. Roar flattens the NEXT attack's check to Even, Strike included.
// Rulings this file makes where RULES.md is silent (all recorded in the brief):
//   - an attack's element is the card's, falling back to the hero's
//   - the boss falls when body AND minion cards are gone; a minion's damage
//     does not spill to the body
//   - Knight's free guard does not apply under Rage (Rage bypasses guards)
//   - Ally lasts the level; Relic lasts the level; Rune is one check

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
export const canRevive = (f) => !!f.hero.secondWind;
export const MAX_ROUNDS = 20;

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
      element: b.element || null, body: b.hp ?? b.life_cards * perCard, maxHp: b.hp ?? b.life_cards * perCard,
      minions: [], braced: false, actsTwice: init.biome?.id === 'castle',
    },
    hero: {
      element: init.hero.element, klass: init.hero.klass || null,
      pool, attacks: init.hero.attacks.map((a) => ({ ...a })),
      advantage: [...(init.advantage || [])],
      relic: false, ally: false, rune: 0, flatBonus: init.bonus || 0, shield: 0,
      penalty: false, hidden: false, hideAvailable: false,
      knightUsed: false, hunterUsed: false, lastMiss: null,
      secondWind: !!init.secondWind, revives: 0,
    },
    actionsLeft: 0,
    phase: 'act',      // act | boss | won | lost | stall
    pending: null,     // a rolled boss reaction awaiting resolve (Barrier window)
    log: [],
    stats: { rounds: 0, attacks: 0, hits: 0, allIns: 0 },
  };
  // Non-enumerable: the run is saved to localStorage, and cards.json must not ride along.
  Object.defineProperty(f, 'data', { value: data, enumerable: false, writable: true, configurable: true });
  startRound(f);
  return f;
}

const say = (f, text, cls = '') => { f.log.push({ text, cls }); };

export const ready = (f) => f.hero.pool.filter((c) => c.st === 'ready').length;
export const spent = (f) => f.hero.pool.filter((c) => c.st === 'spent').length;
export const broken = (f) => f.hero.pool.filter((c) => c.st === 'broken').length;
export const alive = (f) => ready(f) + spent(f);
export const raging = (f) => f.round >= f.boss.rage;
export const bossHp = (f) => f.boss.body + f.boss.minions.reduce((a, m) => a + m.hp, 0);
export const bossDown = (f) => f.legacy ? f.boss.body <= 0 : bossHp(f) <= 0;

// ── Round flow ───────────────────────────────────────────────
export function startRound(f) {
  f.round += 1;
  f.stats.rounds = f.round;
  // Recover: every Spent card comes back. The one thing that makes betting free.
  for (const c of f.hero.pool) if (c.st === 'spent') c.st = 'ready';
  f.actionsLeft = 3;
  f.hero.penaltyArmed = f.hero.penalty; // a Roar from the last boss turn applies this turn
  f.hero.hidden = false; f.hero.hideAvailable = f.biome?.id === 'forest';
  f.hero.shield = 0;   // an unused Bubble pops; it guards the round it was cast in
  f.hero.knightUsed = false; f.hero.hunterUsed = false; f.hero.lastMiss = null;
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

/** Damage a landed attack deals, before Brace. */
export function attackDamage(f, a, bet) {
  const base = a.damage === '4x bet' ? 4 * bet * UNIT : a.damage;
  return base + attackBonus(f, a);
}

const halve = (d) => Math.floor(d / 2 / UNIT) * UNIT;

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
  const bet = a.bet === 'any' ? Math.max(1, Math.min(o.bet || 1, ready(f))) : (a.bet || 0);
  if (bet > ready(f)) throw new Error('cannot afford the bet');
  // Betting turns cards sideways whether the attack lands or not.
  let n = bet;
  for (const c of f.hero.pool) { if (n > 0 && c.st === 'ready') { c.st = 'spent'; n--; } }
  f.actionsLeft -= a.actions;
  f.stats.attacks += 1;
  if (a.id === 'all-in') f.stats.allIns += 1;
  if (a.id === 'strike') f.hero.hideAvailable = true;

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
  f.hero.lastMiss = (!hit && f.hero.klass === 'hunter' && !f.hero.hunterUsed) ? { a, bet, target: o.target } : null;
  say(f, `${a.name || a.id}${bet ? ` (bet ${bet})` : ''}: ${auto ? 'lands' : hit ? 'hit' : 'miss'}${dealt ? `, ${dealt} damage` : ''}.`, hit ? 'hero' : 'bad');
  return { hit, auto, step, need, dealt, roll: rollShown, bet };
}

/** Hunter: once per round, reroll one failed check. Same odds, same damage. */
export function reroll(f, o = {}) {
  const m = f.hero.lastMiss;
  if (!m || f.hero.hunterUsed) throw new Error('no reroll available');
  f.hero.hunterUsed = true; f.hero.lastMiss = null;
  const step = effectiveStepNoPenalty(f, m.a);
  const odds = stepOdds(step);
  let hit, need = null;
  if (o.u !== undefined) hit = o.u < odds;
  else { need = targetFor(f.die, step); hit = (o.roll ?? 0) >= need; }
  const dealt = hit ? applyHit(f, m.a, m.bet, m.target) : 0;
  if (hit) f.stats.hits += 1;
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
  if (bossDown(f)) { f.phase = 'won'; say(f, 'The boss falls!', 'good'); }
}

/**
 * Attempt the comeback. Pass a die `roll` (a human) or a uniform `u` (the sim).
 * Success voids the damage that felled you and stands `returns` Broken cards
 * back up; failure ends the level exactly as before the card existed.
 */
export function attemptRevive(f, o = {}) {
  if (f.phase !== 'down') throw new Error('not Down');
  const step = reviveStep(f);
  let ok = true, need = null;
  if (step) {
    if (o.u !== undefined) ok = o.u < stepOdds(step);
    else { need = targetFor(f.die, step); ok = (o.roll ?? 0) >= need; }
  }
  f.hero.revives += 1;
  if (!ok) { f.phase = 'lost'; say(f, 'The comeback fails. You are Down.', 'bad'); return { ok: false, step, need }; }
  let back = o.returns ?? 2;
  for (const c of f.hero.pool) { if (back > 0 && c.st === 'broken') { c.st = 'ready'; back--; } }
  f.phase = f.pending ? 'boss' : 'act';
  say(f, step ? `Second Wind holds! Back up with 2 cards.` : 'Second Wind: you come back free.', 'good');
  return { ok: true, step, need };
}

/** Hide: free after a Strike (or anytime in the Forest). Next hit this round halved. */
export function hide(f) {
  if (!f.hero.hideAvailable) throw new Error('Hide needs a Strike first');
  f.hero.hidden = true; f.hero.hideAvailable = false;
  say(f, 'Hide: the next hit this round is halved.', 'hero');
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
    case 'ally': f.hero.ally = true; say(f, 'Ally: a companion joins and Strikes for 25 each turn.', 'good'); break;
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
  for (let i = 0; i < f.boss.minions.length && f.phase === 'boss'; i++) {
    say(f, 'A minion strikes for 25.', 'boss');
    take(f, UNIT, raging(f));
  }
}

/**
 * The boss rolls its d6. Nothing is applied yet: the runner shows the face,
 * offers Barrier if the hero holds one, then calls resolveBoss.
 */
export function bossRoll(f, d6) {
  if (f.phase !== 'boss') throw new Error('not the boss phase');
  const rx = reactionFor(f.data, d6);
  const rage = raging(f);
  const base = f.boss.damage * (rage ? 2 : 1);
  let dmg = 0, kind = rx.name.toLowerCase();
  if (kind === 'strike' || kind === 'roar') dmg = base;
  else if (kind === 'ruin') dmg = base * 2;
  else if (kind === 'summon') {
    const chunk = f.legacy ? 100 : 2 * f.boss.perCard;
    const can = f.legacy ? (f.boss.body > 100 && f.boss.minions.length < 3)
                         : (f.boss.body > 2 * f.boss.perCard && f.boss.minions.length < 3);
    if (!can) { kind = 'strike'; dmg = base; } else dmg = 0;
    f.pending = { roll: d6, kind, dmg, chunk, rage, name: can ? 'Summon' : 'Strike' };
    return f.pending;
  }
  f.pending = { roll: d6, kind, dmg, rage, name: rx.name };
  return f.pending;
}

/** Apply (or Barrier away) the pending reaction, then start the next round. */
export function resolveBoss(f, { barrier = false } = {}) {
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
        f.boss.body -= p.chunk; f.boss.minions.push({ hp: p.chunk, max: p.chunk });
        say(f, `The boss Summons: ${p.chunk} of its life moves under a minion.`, 'boss'); break;
      }
      case 'roar': say(f, `The boss Roars for ${p.dmg}. Your next check is one step harder.`, 'boss'); take(f, p.dmg, p.rage); f.hero.penalty = true; break;
      case 'ruin': say(f, `Ruin! The boss deals ${p.dmg}.`, 'boss'); take(f, p.dmg, p.rage); break;
      default: say(f, `The boss Strikes for ${p.dmg}.`, 'boss'); take(f, p.dmg, p.rage);
    }
  }
  if (f.phase === 'boss') {
    // Castle: the boss acts twice on round 1. Leave the phase open for a second roll.
    if (f.boss.actsTwice && f.round === 1 && !f._secondAct) { f._secondAct = true; say(f, 'Castle: the boss acts again.', 'boss'); return 'again'; }
    f._secondAct = false;
    if (f.round >= MAX_ROUNDS) { f.phase = 'stall'; return 'stall'; }
    startRound(f);
  }
  return f.phase;
}

/**
 * Resolve incoming damage (tools/sim.py Player.take, plus Hide and Knight).
 * Guarding with a Ready card Spends it (it comes back next round); with a
 * Spent card it Breaks. Under Rage nothing can be guarded with Ready cards.
 */
export function take(f, damage, unguardable) {
  if (f.hero.hidden) { damage = halve(damage); f.hero.hidden = false; say(f, `Hidden: halved to ${damage}.`, 'hero'); }
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
