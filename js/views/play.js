// ── Play view ────────────────────────────────────────────────
// The runner: set up a run, declare a turn, resolve it, carry on. Every rule
// resolution is a call into game/engine.js, game/run.js or views/play-plan.js;
// this file is the dispatcher and the human's side of the table.
//
// A turn here is DECLARED and then played: click a card once per action you
// want it to take, the clicks become a numbered lane, one button walks it.
// That is the whole shape of the screen, and play-plan.js holds the rules of
// the lane (and the rulings it had to make) with no DOM in the way.
//
// Rulings this file makes that the rulebook does not:
//   - Resolving the plan does NOT end the turn, even when it used the last
//     action. Hide is free and is played after attacking and before the boss
//     acts (RULES section 6), so auto-ending would quietly delete it. When
//     there is nothing left to declare, End turn becomes the primary button.
//   - A parked Barrier is a declared intention, not an automatic cancel. Brace
//     deals no damage, so spending the card on it would waste a card the
//     player never chose to spend. Parking promotes the Barrier button.
//   - Giving up the comeback sets the level lost directly. The engine has no
//     "decline" and faking a failed roll would write a lie into the log.
//
// The board's viewport claim lives in css/play.css, hung off the
// html[data-view="play"] attribute that render.js sets.

import { secondWindDefault, simpleDefault } from '../state.js';
import { t, cardName } from '../strings.js';
import { showToast } from '../utils.js';
import {
  reroll, hide, endTurn, bossRoll, resolveBoss, playAdvantage,
  attemptRevive, reviveStep, raging, canBreak, breakPart, breakStepFor,
} from '../game/engine.js';
import { rollDie, dieMax } from '../game/rules.js';
import { newRun, startLevel, levelWon, levelLost, chooseClass, revealDraft, takeSkill, drawAdvantage, nextLevel } from '../game/run.js';
import { queueStep, unqueueStep, setStepBet, toggleStepRune, cycleStepTarget, advancePlan, awaitingStep, attackFor, moveStep } from './play-plan.js';
import { renderFight, reasonText } from './play-board.js';
import { renderSetup, renderClassPick, renderDraft, renderAdvantage, renderDone, renderLost } from './play-screens.js';

export function renderPlay(s) {
  const run = s.run;
  if (!run || run.stage === 'setup') return renderSetup(s);
  switch (run.stage) {
    case 'fight': return renderFight(s, run);
    case 'class': return renderClassPick(s, run);
    case 'draft': return renderDraft(s, run);
    case 'advantage': return renderAdvantage(s, run);
    case 'done': return renderDone(s, run);
    case 'lost': return renderLost(s, run);
    default: return renderSetup(s);
  }
}

/** A new turn starts with an empty lane and last turn's verdict cleared. */
function resetPlan(ui) {
  ui.plan = []; ui.at = 0; ui.awaiting = null; ui.error = null; ui.typed = null;
}

/**
 * Grudge (RULES.md 8b): a lost level leaves a Grudge under that boss, capped at
 * 2, and the next attempt at THAT level starts with them as auto-successes.
 * They live on device state, not on the run: the run dies with the loss, the
 * grudge is the part that survives, which is the whole card.
 */
function noteLoss(s, run) {
  if (!run?.fight) return;
  const g = (s.grudges ||= {});
  g[run.level] = Math.min(2, (g[run.level] || 0) + 1);
}
function applyGrudges(s, run) {
  const g = s.grudges?.[run.level] || 0;
  if (g && run.fight) run.fight.hero.rune += g;
}

/** Walk the lane, then keep the board honest about what is left. */
function step(run, f, ui, roll, oneStep = false) {
  // The story beats are computed here, where before-and-after both exist. The
  // wall's card count before the hit is unrecoverable one line later, and the
  // bubble's event line depends on which boundary this exact hit crossed.
  const per = f.boss.perCard || 100;
  const cardsOf = (body) => Math.ceil(Math.max(0, body) / per);
  const b0 = f.boss.body;
  const r = advancePlan(f, ui, roll, { oneStep });
  ui.typed = null;
  if (r.error) { showToast(reasonText(r.error)); return true; }
  // EVERY step this call resolved, not just the last. ui.last is the most recent
  // one and reading it once meant a lane that resolved three steps put one line
  // in the ledger.
  if (ui.results) for (const p of (r.played || [])) {
    ui.results.push({ name: p.name, id: p.id, roll: p.roll, auto: p.auto, hit: p.hit, dealt: p.dealt || 0 });
  }
  if (ui.last) {
    ui.fx = ui.last.hit ? 'hit' : 'miss';
    ui.dealt = ui.last.dealt || 0;
    ui.wallFell = Math.max(0, cardsOf(b0) - cardsOf(f.boss.body));
    const bet = ui.plan?.[ui.last.i]?.bet || 0;
    if (f.phase === 'won') { ui.event = 'killingBlow'; ui.fx = 'boss-felled'; }
    else if (ui.last.hit && ui.dealt >= 200) ui.event = 'bigHit';
    else if (ui.last.hit && b0 === f.boss.maxHp && f.boss.body < b0) ui.event = 'firstBlood';
    else if (!ui.last.hit && bet > 0) ui.event = 'whiff';
  }
  if (r.paused) return true;    // one step landed; the player asks for the next
  if (r.done) {
    // The lane is spent; leave the turn open (Hide, a reroll, a second thought).
    resetPlan(ui);
    if (f.phase === 'lost') { levelLost(run); noteLoss(s, run); }
  }
  return true;
}

// ── Actions ──────────────────────────────────────────────────
/** Returns true when the view must re-render. */
export function onPlayAction(s, act, el, e) {
  const run = s.run;
  const f = run?.fight;
  const ui = run ? (run.ui ||= {}) : null;
  const d = el.dataset;
  // Every effect on the board is a CSS animation on markup render.js replaces
  // wholesale, so an effect left in ui.fx would replay on the next unrelated
  // click. Clearing it HERE, before the case that may set it, means each effect
  // plays exactly once: on the render caused by the action that earned it.
  if (ui) { ui.fx = null; ui.wallFell = 0; ui.event = null; ui.roundNew = false; ui.rageIn = false;
    // dealt and took ride along with fx: they are read on the render fx causes,
    // and leaving them set meant a break animated the last ATTACK's number over
    // the boss, for damage the break had not dealt.
    ui.dealt = 0; ui.took = 0; ui.breakRoll = null;
    if (act !== 'abandon') ui.confirmAbandon = false; }
  try {
    switch (act) {
      // Switching run kind re-arms the safety net at that kind's default: on for
      // the First Game, off for the five-level run. Toggling it after is a
      // deliberate choice and survives, which is why the two are separate cases.
      // The two single-choice slides advance on the click itself: the option
      // was already preselected, so a separate Next per slide was pure
      // friction. The settings slide (die, mode, Second Wind) keeps its Next,
      // because three controls share it and a jump on the first click would
      // yank the other two away.
      case 'kind': s.runKind = d.kind; s.secondWind = secondWindDefault(d.kind); s.simple = simpleDefault(d.kind); s.setupStep = 1; return true;
      case 'second-wind': s.secondWind = el.checked !== undefined ? !!el.checked : !s.secondWind; return true;
      case 'simple': s.simple = el.checked !== undefined ? !!el.checked : !s.simple; return true;
      case 'element': s.element = d.element; s.setupStep = 2; return true;
      case 'die': s.die = d.die; return true;
      // The break dial. A table setting, so it lives on device state next to
      // the die and the mode, not on the run: the grown-up who set it is the
      // same grown-up next Saturday.
      case 'dm-on': s.dm = { ...s.dm, on: el.checked !== undefined ? !!el.checked : !s.dm.on }; return true;
      case 'dm-style': s.dm = { ...s.dm, style: d.style }; return true;
      case 'dm-cap': s.dm = { ...s.dm, cap: Math.max(0, Math.min(4, Number(d.cap))) }; return true;
      case 'dm-num': {
        // No re-render: this fires on every keystroke (events.js binds both
        // change and input), and redrawing the field under the caret moves it.
        const n = Math.max(0, Math.round(Number(el.value) / 25) * 25);
        s.dm = { ...s.dm, [d.key]: n };
        return false;
      }
      case 'mode': s.mode = d.mode; return true;
      case 'start': {
        // Remember the table so a returning family gets a one-tap fast lane.
        s.playLast = { kind: s.runKind || 'first', element: s.element, die: s.die, mode: s.mode, secondWind: s.secondWind, simple: s.simple, dm: { ...s.dm } };
        s.setupStep = 0;
        s.run = newRun(s.cards, s.playLast);
        startLevel(s.run, s.cards);
        applyGrudges(s, s.run);
        return true;
      }
      case 'setup-step': { s.setupStep = Math.max(0, Math.min(3, Number(d.step))); return true; }
      case 'setup-again': {
        const L = s.playLast;
        if (L) { s.runKind = L.kind; s.element = L.element; s.die = L.die; s.mode = L.mode; s.secondWind = L.secondWind; s.simple = !!L.simple; if (L.dm) s.dm = { ...s.dm, ...L.dm }; }
        s.run = newRun(s.cards, { kind: s.runKind || 'first', element: s.element, die: s.die, mode: s.mode, secondWind: s.secondWind, simple: s.simple, dm: { ...s.dm } });
        startLevel(s.run, s.cards);
        applyGrudges(s, s.run);
        return true;
      }
      case 'resume': return true;
      case 'abandon': {
        if (ui && !ui.confirmAbandon) { ui.confirmAbandon = true; return true; }
        s.run = null; showToast(t('play.abandoned')); return true;
      }
      case 'new-run': s.run = null; return true;
      case 'go-full': s.runKind = 'full'; s.run = null; return true;

      // ── Building the lane ──────────────────────────────────
      case 'pick': {
        if (!f || f.phase !== 'act') return false;
        ui.plan ||= [];
        const r = queueStep(f, ui.plan, d.id, { target: ui.target ?? 'body' });
        if (!r.ok) {
          // aria-disabled instead of disabled so this click arrives and can explain itself
          const a = attackFor(f, d.id);
          showToast(`${a ? cardName(a) : d.id}: ${reasonText(r.reason)}`);
          return false;
        }
        ui.plan = r.plan; ui.error = null; ui.fx = 'queued';
        return true;
      }
      case 'unqueue': {
        if (!f) return false;
        ui.plan = unqueueStep(ui.plan || [], Number(d.i));
        ui.error = null;
        return true;
      }
      case 'clear-plan': resetPlan(ui); return true;
      // Reorder, from a drag or from the two nudge buttons beside a step. Order
      // started mattering when Run began halving what follows it, and rebuilding
      // a lane to move one card was the commonest reason to clear the whole thing.
      case 'move-step': {
        const r = moveStep(f, ui.plan || [], Number(d.i), Number(d.to));
        if (!r.ok) { if (r.reason !== 'gone') showToast(reasonText(r.reason)); return false; }
        ui.plan = r.plan; ui.error = null; ui.fx = 'queued';
        return true;
      }
      case 'undo-last': { ui.plan = unqueueStep(ui.plan || [], (ui.plan || []).length - 1); return true; }
      case 'step-bet': {
        const r = setStepBet(f, ui.plan || [], Number(d.i), Number(d.bet));
        if (!r.ok) { showToast(reasonText(r.reason)); return false; }
        ui.plan = r.plan; return true;
      }
      case 'step-target': ui.plan = cycleStepTarget(f, ui.plan || [], Number(d.i)); return true;
      case 'rune-step': {
        const r = toggleStepRune(f, ui.plan || [], Number(d.i));
        if (!r.ok) { showToast(t('play.useRune')); return false; }
        ui.plan = r.plan; return true;
      }
      // The reaction slot: park Barrier for the boss's turn, or take it back.
      case 'park': ui.reaction = ui.reaction === d.id ? null : d.id; return true;

      // ── Resolving the lane ─────────────────────────────────
      // Resolve opens a chooser instead of advancing: the throw is the game's
      // dramatic beat, so it gets a stage (the popup) and two doors: throw
      // each die, or skip the theatre and resolve everything at once.
      case 'resolve-plan': {
        if (!ui.plan?.length) return false;
        ui.resolveOpen = true; ui.results = []; ui.at = null; ui.awaiting = null;
        return true;
      }
      case 'resolve-throw': {
        if (!ui.resolveOpen) return false;
        ui.resolveMode = 'step'; ui.at = 0; ui.awaiting = null;
        return step(run, f, ui, null, true);
      }
      // The beat between two steps of the lane. Only the throw door uses it;
      // the fast lane never pauses.
      case 'resolve-next': {
        if (!ui.resolveOpen || ui.resolveMode !== 'step') return false;
        return step(run, f, ui, null, true);
      }
      case 'resolve-fast': {
        if (!ui.resolveOpen) return false;
        ui.resolveMode = 'all'; ui.at = 0; ui.awaiting = null;
        let r = step(run, f, ui, null);
        let guard = (ui.plan?.length || 0) + 1;
        while (f.phase === 'act' && awaitingStep(f, ui) && guard-- > 0) {
          r = step(run, f, ui, rollDie(f.die, Math.random));
        }
        return true;
      }
      case 'resolve-close': {
        if (awaitingStep(f, ui)) return false;   // a thrown attack cannot be un-thrown
        ui.resolveOpen = false; ui.results = null; ui.resolveMode = null; ui.breakRoll = null;
        return true;
      }
      case 'typed': ui.typed = Number(el.value) || null; return false;
      case 'roll': {
        const wait = awaitingStep(f, ui);
        if (!wait) return false;
        // A typed physical roll is clamped to the die's range; nothing else validates it.
        const typed = ui.typed != null ? Math.max(1, Math.min(dieMax(f.die), Math.round(ui.typed))) : null;
        return step(run, f, ui, typed ?? rollDie(f.die, Math.random), ui.resolveMode === 'step');
      }
      case 'go-typed': {
        if (!ui.typed) { showToast(t('play.typeRoll')); return false; }
        if (!awaitingStep(f, ui)) return false;
        return step(run, f, ui, Math.max(1, Math.min(dieMax(f.die), Math.round(ui.typed))), ui.resolveMode === 'step');
      }
      case 'tour-next': { const p = s.play ||= {}; if ((p.tourStep || 0) >= 3) { p.tourDone = true; } else p.tourStep = (p.tourStep || 0) + 1; return true; }
      case 'tour-skip': { (s.play ||= {}).tourDone = true; return true; }
      case 'resolve-all': {
        // The fast lane: every remaining check in the plan rolls at once. The
        // log keeps each roll; the board shows where the lane ended up. The
        // guard is the lane's own length, so a rules bug cannot spin here.
        if (!awaitingStep(f, ui)) return false;
        let guard = (ui.plan?.length || 0) + 1;
        while (f.phase === 'act' && awaitingStep(f, ui) && guard-- > 0) {
          step(run, f, ui, rollDie(f.die, Math.random));
        }
        return true;
      }

      // ── The rest of the turn ───────────────────────────────
      case 'target': ui.target = d.target === 'body' ? 'body' : Number(d.target); return true;
      // ── Breaking a part ────────────────────────────────────
      // The reward is the click; the roll is thrown here, from outside the
      // engine like every other roll in this game. A typed number wins over the
      // site's own die, which is the same contract the hero's checks have.
      case 'break': {
        if (!canBreak(f)) return false;
        const step = breakStepFor(f);
        const typed = ui.typed != null ? Math.max(1, Math.min(dieMax(f.die), Math.round(ui.typed))) : null;
        const roll = step ? (typed ?? rollDie(f.die, Math.random)) : null;
        const body0 = f.boss.body;
        const r = breakPart(f, { reward: d.reward, roll: roll ?? undefined });
        ui.typed = null;
        // A break gets its OWN effect name. Reusing 'hit'/'miss' made the resolve
        // modal think an attack had just landed, so it replayed the last attack's
        // die instead of showing the break's, and the boss flashed a damage
        // number the break never dealt.
        ui.breakRoll = { roll, ok: r.ok, reward: r.reward, step };
        ui.dealt = Math.max(0, body0 - f.boss.body);
        ui.wallFell = Math.max(0, Math.ceil(body0 / (f.boss.perCard || 100)) - Math.ceil(Math.max(0, f.boss.body) / (f.boss.perCard || 100)));
        ui.fx = r.ok ? 'break-ok' : 'break-no';
        if (f.phase === 'won') { ui.event = 'killingBlow'; ui.fx = 'boss-felled'; }
        // The Advantage card a Trophy is worth only exists where there is a
        // deck to draw it from; a First Game has none, and the Rune the engine
        // already granted is that mode's whole version of the reward.
        if (r.ok && r.draw && run.kind === 'full') {
          const drawn = run.advDeck.splice(0, r.draw);
          f.hero.advantage.push(...drawn);
          if (drawn.length) showToast(`${t('play.drew')} ${drawn.length}`);
        }
        return true;
      }
      // Declining closes the window rather than leaving the row on screen: the
      // break belonged to that attack, and the player has said no to it.
      case 'break-skip': f.hero.breakWindow = false; ui.breakOpen = false; return true;
      case 'break-open': ui.breakOpen = true; return true;
      case 'break-close': ui.breakOpen = false; ui.breakRoll = null; return true;

      case 'reroll': {
        const r = reroll(f, { roll: rollDie(f.die, Math.random) });
        ui.last = { name: t('play.reroll'), hit: r.hit, dealt: r.dealt, roll: null, auto: false };
        ui.fx = r.hit ? 'hit' : 'miss'; ui.dealt = r.dealt || 0; return true;
      }
      // A board preference, not a run one: game/run.js resets run.ui every level.
      case 'log': { (s.play ||= {}).logShown = !s.play.logShown; return true; }
      case 'hide': hide(f); return true;
      case 'adv': {
        // Barrier is a reaction: it parks in the lane's reserved slot instead.
        if (d.id === 'barrier') { ui.reaction = ui.reaction === 'barrier' ? null : 'barrier'; return true; }
        const r = playAdvantage(f, d.id);
        if (r.draw) { const drawn = run.advDeck.splice(0, r.draw); f.hero.advantage.push(...drawn); showToast(`${t('play.drew')} ${drawn.length}`); }
        return true;
      }
      case 'end-turn': {
        resetPlan(ui); ui.last = null; ui.bossSaid = null;
        endTurn(f);                                // a minion in here can fell you
        if (f.phase === 'lost') { levelLost(run); noteLoss(s, run); }
        return true;
      }
      case 'boss-roll': { ui.bossSaid = null; ui.fx = 'boss-die'; bossRoll(f, 1 + Math.floor(Math.random() * 6)); return true; }
      // The typed path for the boss's die. Hero rolls always accepted the real
      // die; the boss's was the one screen-only roll in the game, which broke
      // the project's own invariant in spirit and wasted the single best job a
      // small child can be given: throw the d6, tap the face it shows.
      case 'boss-face': { ui.bossSaid = null; ui.fx = 'boss-die'; bossRoll(f, Math.max(1, Math.min(6, Number(d.face)))); return true; }
      // Taunt, human path: the plan played the card without a face, and the
      // fight is waiting for the table to say what the real d6 showed.
      case 'foretell-face': {
        f.foretold = Math.max(1, Math.min(6, Number(d.face)));
        f.awaitForetell = false;
        showToast(`${cardName(s.cards.byId.taunt)}: ${f.foretold}`);
        return true;
      }
      case 'resolve': {
        const p = f.pending;
        const hadAlly = !!f.hero.ally;
        const hadShield = f.hero.shield > 0;
        const mark = f.log.length;
        const useBarrier = d.barrier === '1';
        // Cover is the hero stepping in front of an Ally the boss aimed at
        // (RULES.md section 7). Barrier still wins: a cancelled action deals
        // nothing to anybody, so there is nothing left to cover.
        const cover = d.cover === '1';
        const r = resolveBoss(f, { barrier: useBarrier, cover });
        if (useBarrier) ui.reaction = null;
        // The boss's line comes from the engine's own log rather than a second
        // wording here: one sentence, one author, nothing to drift apart.
        ui.bossSaid = f.log[mark]?.text || null;
        const atAlly = hadAlly && p?.at === 'ally' && !cover && !useBarrier;
        if (hadAlly && !f.hero.ally) ui.fx = 'ally-gone';
        else if (atAlly) ui.fx = 'ally-hit';
        else if (p?.dmg > 0 && !useBarrier) { ui.fx = 'hurt'; ui.took = hadShield ? 0 : p.dmg; }
        if (r === 'again') showToast(t('play.castleAgain'));
        if (f.phase === 'lost' || f.phase === 'stall') { levelLost(run); noteLoss(s, run); }
        if (f.phase === 'act') resetPlan(ui);
        ui.roundNew = true;
        if (raging(f) && !ui.rageAnnounced) { ui.rageIn = true; ui.rageAnnounced = true; }
        return true;
      }

      // ── Down, with Second Wind in play ─────────────────────
      case 'revive': {
        const st = reviveStep(f);
        const typed = ui.typed != null ? Math.max(1, Math.min(dieMax(f.die), Math.round(ui.typed))) : null;
        const roll = st ? (typed ?? rollDie(f.die, Math.random)) : null;
        const r = attemptRevive(f, roll === null ? {} : { roll });
        ui.typed = null;
        ui.last = { name: t('play.secondWind'), hit: r.ok, dealt: 0, roll, auto: !st };
        // The engine resumes the interrupted step itself and reports what that
        // step returned, so a Castle round-1 comeback still owes a second act.
        if (r.ok) {
          resetPlan(ui);
          ui.event = 'revived';
          showToast(r.resumed === 'again' ? t('play.castleAgain') : t('play.reviveTry'));
        }
        else { levelLost(run); noteLoss(s, run); }
        return true;
      }
      case 'give-up': {
        // No engine call: declining is not a failed roll, and inventing one
        // would put a die that was never thrown into the log.
        f.phase = 'lost';
        levelLost(run); noteLoss(s, run);
        return true;
      }

      // ── Level end ──────────────────────────────────────────
      case 'continue': {
        if (s.grudges) delete s.grudges[run.level];   // the boss is beaten; its Grudges go back in the box
        levelWon(run);
        if (run.stage === 'draft') revealDraft(run, s.cards);
        return true;
      }
      // Class and draft are the run's two irreversible picks, and a small
      // finger taps the wrong card constantly. Select first, confirm second.
      case 'class': ui.pickClass = ui.pickClass === d.id ? null : d.id; return true;
      case 'class-confirm': {
        if (!ui.pickClass) return false;
        chooseClass(run, ui.pickClass); ui.pickClass = null; revealDraft(run, s.cards); return true;
      }
      case 'draft': ui.pickSkill = ui.pickSkill === d.id ? null : d.id; return true;
      case 'draft-confirm': {
        if (!ui.pickSkill) return false;
        takeSkill(run, ui.pickSkill); ui.pickSkill = null; ui.drawn = drawAdvantage(run, 1); return true;
      }
      case 'next-level': nextLevel(run, s.cards); applyGrudges(s, run); return true;
      case 'lost': s.run = null; return true;
      default: return false;
    }
  } catch (err) {
    showToast(err.message);
    console.warn(err);
    return true;
  }
}

/**
 * The board's keyboard, as an alias for its buttons.
 *
 * Deliberately implemented by clicking the rendered control rather than by
 * mutating the plan directly: a key can then never do something the mouse
 * cannot, and it cannot drift from the rules the click path enforces. Digits
 * pick the nth card in hand, Enter takes the primary action, Backspace drops the
 * last queued step. Returns false always: the click it forwards re-renders.
 */
export function onPlayKey(s, e) {
  const stage = s.run && s.run.stage !== 'setup' ? s.run.stage : 'setup';
  if (stage !== 'fight') return onScreenKey(e);
  const hit = (sel, i = 0) => { const list = document.querySelectorAll(sel); const el = list[i]; if (el) { e.preventDefault(); el.click(); } };
  // Enter belongs to whatever is focused, if anything is. The board used to claim
  // it unconditionally and preventDefault it, so a keyboard user who tabbed to
  // "Abandon run" and pressed Enter resolved their turn instead: while a primary
  // action existed, which is most of a fight, NO other control on the board could
  // be reached with Enter at all. Digits are safe to keep, since a focused button
  // does nothing with them.
  const onControl = e.target?.closest?.('button, a[href], summary, [role="button"]');
  if (/^[1-9]$/.test(e.key)) hit('[data-action="play-pick"]', Number(e.key) - 1);
  else if (e.key === 'Enter' && !onControl) hit('.actions .btn--primary');
  else if (e.key === 'Backspace' || e.key === 'Delete') {
    const marks = document.querySelectorAll('[data-action="play-unqueue"]');
    if (marks.length) hit('[data-action="play-unqueue"]', marks.length - 1);
  }
  return false;
}

/**
 * Keyboard for every Play screen that is not the board: setup, the class pick,
 * the draft, the Advantage draw and the two endings. Arrows walk a roving
 * focus through the screen's own buttons in DOM order (wrapping at the ends),
 * so a choice is two keys: arrow to it, Enter or Space on it. Enter with
 * nothing focused presses the screen's primary button (Next, Start, Keep),
 * matching what Enter already means on the board. Number inputs never reach
 * this handler (isPlainKey in events.js), so the DM dial's typed fields keep
 * their native arrow behaviour.
 */
function onScreenKey(e) {
  const root = document.getElementById('viewRoot');
  if (!root) return false;
  const arrows = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
  if (e.key in arrows) {
    const ring = Array.from(root.querySelectorAll('button:not([disabled])'))
      .filter((el) => el.getClientRects().length > 0);
    if (!ring.length) return false;
    const dir = arrows[e.key];
    const at = ring.indexOf(document.activeElement);
    const next = at < 0 ? (dir > 0 ? 0 : ring.length - 1) : (at + dir + ring.length) % ring.length;
    e.preventDefault();
    ring[next].focus();
    return false;
  }
  if (e.key === 'Enter' && !e.target?.closest?.('button, a[href], input, [role="button"]')) {
    const primary = root.querySelector('.setup-nav .btn--primary')
      || root.querySelector('.confirm-bar .btn--primary')
      || root.querySelector('.btn--primary');
    if (primary) { e.preventDefault(); primary.click(); }
  }
  return false;
}
