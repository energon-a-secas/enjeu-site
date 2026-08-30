// ── The inspector (one popover for "what is this card") ──────
// Any element carrying data-inspect="<card id>" grows a floating card preview:
// hover on a mouse (after a small delay, so a pass-through never flickers),
// press-and-hold on touch. The element's own click keeps its job everywhere:
// queueing in the fight, opening the full detail modal on Learn and Cards.
// One popover element for the whole app, filled on show, so a hundred cards
// on screen cost nothing until one is asked about.
import { t, cardName } from '../strings.js';
import { cardFace, riskDots } from '../cards/face.js';
import { effectiveStep, attackDamage } from '../game/engine.js';
import { targetFor } from '../game/rules.js';
import { state } from '../state.js';
import { escHtml } from '../utils.js';

const HOVER_DELAY = 180;
const HOLD_DELAY = 450;

let pop = null;
let showTimer = 0;
let holdTimer = 0;
let holdShown = false;   // a hold that showed the popover must not also click
let shownFor = null;

const effectFor = (id) => {
  const e = t(`cards.effect.${id}`);
  return e.startsWith('[') ? '' : e;
};

function ensurePop() {
  if (pop) return pop;
  pop = document.createElement('div');
  pop.id = 'inspectPop';
  pop.setAttribute('role', 'tooltip');
  pop.hidden = true;
  document.body.appendChild(pop);
  return pop;
}

/**
 * The numbers this card carries INTO the fight that is on screen, which is not
 * the same as the numbers printed on it: the mode dial and a Roar move the
 * check, Hidden halves the damage, an affinity or a Relic adds to it. The
 * printed face in the popover is 84px wide, so its pips are a few pixels each
 * and cannot be the answer to "what does this actually do right now".
 *
 * Returns '' outside a fight, where a card has no this-turn version of itself.
 */
function liveLine(c) {
  // Only on the board. The inspector is installed globally and fires on any
  // [data-inspect], so gating on the fight alone put this-turn numbers from a
  // PAUSED run under a card in the Cards catalogue, where they contradicted the
  // printed face beside them: a Focus reading 25 damage next to a card that
  // says 75, because the hero happens to be hidden in a fight nobody is looking at.
  if (state.view !== 'play') return '';
  const f = state.run?.fight;
  const a = f?.hero?.attacks?.find((x) => x.id === c.id);
  if (!f || !a || f.phase !== 'act') return '';
  const step = effectiveStep(f, a);
  const bet = a.bet === 'any' ? 1 : (a.bet || 0);
  const bits = [`${a.actions} ${t(a.actions > 1 ? 'play.manyActions' : 'play.oneAction')}`];
  if (a.bet === 'any') bits.push(`${t('play.bet')} ${t('play.betAny')}`);
  else if (bet) bits.push(`${t('play.bet')} ${bet}`);
  const dmg = attackDamage(f, a, bet);
  if (dmg > 0) bits.push(`${dmg}${a.damage === '4x bet' ? ' +' : ''} ${t('play.damage')}`);
  const need = step ? `${riskDots(step)} <b>${targetFor(f.die, step)}+</b> ${escHtml(f.die)}` : `<b>${escHtml(t('play.lands'))}</b>`;
  return `<p class="inspect-live">${escHtml(bits.join(' \u00b7 '))} \u00b7 ${need}</p>`;
}

function show(el) {
  const id = el.dataset.inspect;
  const c = state.cards?.byId?.[id];
  if (!c) return;
  const eff = effectFor(id);
  const p = ensurePop();
  p.innerHTML = `<div class="inspect-card">${cardFace(c, { size: 'hand', title: cardName(c) })}</div>
    <div class="inspect-text"><b>${escHtml(cardName(c))}</b>${eff ? `<p>${escHtml(eff)}</p>` : ''}${liveLine(c)}</div>`;
  p.hidden = false;
  shownFor = el;
  // Position after paint: above the element when there is room, else below,
  // clamped to the viewport either way.
  const r = el.getBoundingClientRect();
  const pw = p.offsetWidth, ph = p.offsetHeight;
  const above = r.top - ph - 10;
  const top = above >= 8 ? above : Math.min(r.bottom + 10, window.innerHeight - ph - 8);
  const left = Math.max(8, Math.min(r.left + r.width / 2 - pw / 2, window.innerWidth - pw - 8));
  p.style.top = `${Math.max(8, top)}px`;
  p.style.left = `${left}px`;
}

/**
 * Dragging a plan step onto another one reorders the lane.
 *
 * Installed here rather than in events.js because it is the same kind of thing
 * the inspector is: one delegated listener on the document, installed once, that
 * hangs off an attribute the board renders. render() replaces the lane's markup
 * wholesale on every click, so anything bound to a step element itself would be
 * dead the moment the lane changed.
 *
 * The drop dispatches the SAME data-action the two nudge buttons use, so the
 * mouse can never do something the keyboard cannot, and the rules of a legal
 * lane are checked in exactly one place (play-plan.js moveStep).
 */
let dragFrom = null;
export function initLaneDrag(onAction) {
  if (typeof document === 'undefined' || document._laneDrag) return;
  document._laneDrag = true;
  const stepOf = (e) => e.target?.closest?.('[data-step-i]');
  document.addEventListener('dragstart', (e) => {
    const el = stepOf(e);
    if (!el) return;
    dragFrom = Number(el.dataset.stepI);
    el.classList.add('is-dragging');
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(dragFrom)); } catch { /* Safari */ } }
  });
  document.addEventListener('dragend', () => {
    dragFrom = null;
    for (const el of document.querySelectorAll('.is-dragging, .is-over')) el.classList.remove('is-dragging', 'is-over');
  });
  document.addEventListener('dragover', (e) => {
    const el = stepOf(e);
    if (!el || dragFrom === null) return;
    e.preventDefault();                       // without this the drop never fires
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    for (const o of document.querySelectorAll('.is-over')) o.classList.remove('is-over');
    if (Number(el.dataset.stepI) !== dragFrom) el.classList.add('is-over');
  });
  document.addEventListener('drop', (e) => {
    const el = stepOf(e);
    if (!el || dragFrom === null) return;
    e.preventDefault();
    const to = Number(el.dataset.stepI);
    const from = dragFrom;
    dragFrom = null;
    if (from !== to) onAction('play-move-step', { dataset: { i: String(from), to: String(to) } });
  });
}

export function hideInspector() {
  clearTimeout(showTimer);
  if (pop) pop.hidden = true;
  shownFor = null;
}

export function initInspector() {
  const hoverable = window.matchMedia?.('(hover: hover)').matches;
  if (hoverable) {
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest?.('[data-inspect]');
      if (!el || el === shownFor) return;
      clearTimeout(showTimer);
      showTimer = setTimeout(() => show(el), HOVER_DELAY);
    });
    document.addEventListener('mouseout', (e) => {
      const el = e.target.closest?.('[data-inspect]');
      if (!el) return;
      if (e.relatedTarget && el.contains(e.relatedTarget)) return;
      hideInspector();
    });
  }
  // Touch: hold to peek. The flag swallows exactly the click a hold produces,
  // so a plain tap still queues the card or opens its modal.
  document.addEventListener('touchstart', (e) => {
    const el = e.target.closest?.('[data-inspect]');
    if (!el) return;
    holdShown = false;
    holdTimer = setTimeout(() => { holdShown = true; show(el); }, HOLD_DELAY);
  }, { passive: true });
  const endHold = () => { clearTimeout(holdTimer); if (shownFor) setTimeout(hideInspector, 600); };
  document.addEventListener('touchend', endHold, { passive: true });
  document.addEventListener('touchcancel', endHold, { passive: true });
  document.addEventListener('click', (e) => {
    if (holdShown) { e.preventDefault(); e.stopPropagation(); holdShown = false; return; }
    // A click anywhere else dismisses a lingering popover.
    if (pop && !pop.hidden && !e.target.closest?.('[data-inspect]')) hideInspector();
  }, true);
  document.addEventListener('scroll', hideInspector, { passive: true, capture: true });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideInspector(); });
}
