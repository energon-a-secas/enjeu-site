// ── The inspector (one popover for "what is this card") ──────
// Any element carrying data-inspect="<card id>" grows a floating card preview:
// hover on a mouse (after a small delay, so a pass-through never flickers),
// press-and-hold on touch. The element's own click keeps its job everywhere:
// queueing in the fight, opening the full detail modal on Learn and Cards.
// One popover element for the whole app, filled on show, so a hundred cards
// on screen cost nothing until one is asked about.
import { t, cardName } from '../strings.js';
import { cardFace } from '../cards/face.js';
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

function show(el) {
  const id = el.dataset.inspect;
  const c = state.cards?.byId?.[id];
  if (!c) return;
  const eff = effectFor(id);
  const p = ensurePop();
  p.innerHTML = `<div class="inspect-card">${cardFace(c, { size: 'hand' })}</div>
    <div class="inspect-text"><b>${escHtml(cardName(c))}</b>${eff ? `<p>${escHtml(eff)}</p>` : ''}</div>`;
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
