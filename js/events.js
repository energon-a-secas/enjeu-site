// ── Events ───────────────────────────────────────────────────
// One delegated click listener reads data-action; views never bind their
// own. Keyboard: Esc closes the modal, Tab is trapped inside it.

import { state, save } from './state.js';
import { render } from './render.js';
import { syncFromHash, goTo } from './navigate.js';
import { printCards, showCardDetail } from './views/cards.js';
import { onPlayAction } from './views/play.js';
import { onBalanceAction } from './views/balance.js';
import { showToast } from './utils.js';

// ── Modal (from the fleet template) ──────────────────────────
function focusable(root) {
  return Array.from(root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'))
    .filter((el) => el.getClientRects().length > 0);
}
let _lastFocus = null;
export function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  _lastFocus = document.activeElement;
  modal.removeAttribute('hidden');
  document.body.classList.add('modal-open');
  const list = focusable(modal.querySelector('.modal__dialog') || modal);
  const close = modal.querySelector('.modal__header [data-modal-close]');
  (close || list[0])?.focus();
}
export function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.setAttribute('hidden', '');
  document.body.classList.remove('modal-open');
  _lastFocus?.focus?.();
  _lastFocus = null;
}
const openModalEl = () => document.querySelector('.modal:not([hidden])');

function onKeydown(e) {
  if (e.key === 'Enter' && e.target?.dataset?.change === 'play-typed') {
    e.preventDefault();
    document.querySelector('[data-action="play-go-typed"]')?.click();
    return;
  }
  const modal = openModalEl();
  if (!modal) return;
  if (e.key === 'Escape') { e.preventDefault(); closeModal(modal.id); return; }
  if (e.key !== 'Tab') return;
  const list = focusable(modal.querySelector('.modal__dialog') || modal);
  if (!list.length) return;
  const first = list[0], last = list[list.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

// ── Delegated actions ────────────────────────────────────────
function onClick(e) {
  // The second click of a double-click lands on whatever the re-render put at
  // those pixels (a draft card where a class card was). No control here needs
  // a double-click, so trailing clicks of a burst are ignored outright.
  if (e.detail > 1) return;
  const closeBtn = e.target.closest('[data-modal-close]');
  if (closeBtn) { const m = closeBtn.closest('.modal'); if (m) closeModal(m.id); return; }

  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  const s = state;

  switch (a) {
    // Cards view
    case 'deck-filter': s.deckFilter = el.dataset.deck; save(s); render(s); return;
    case 'card-detail': showCardDetail(s, el.dataset.id); return;
    case 'print-all': { const n = printCards(s); showToast(`${n} sheets`); return; }
    case 'print-deck': { const n = printCards(s, el.dataset.deck); showToast(`${n} sheet${n === 1 ? '' : 's'}`); return; }
    case 'paper': s.paper = el.dataset.paper; save(s); render(s); return;
    case 'toggle-backs': s.withBacks = !s.withBacks; save(s); render(s); return;
    // Navigation helpers used by Learn
    case 'go': goTo(el.dataset.view, el.dataset.param || null, el.dataset.q ? Object.fromEntries(new URLSearchParams(el.dataset.q)) : null); return;
    default:
      if (a.startsWith('play-')) { if (onPlayAction(s, a.slice(5), el, e)) { save(s); render(s); } return; }
      if (a.startsWith('bal-')) { if (onBalanceAction(s, a.slice(4), el, e)) { save(s); render(s); } return; }
  }
}

function onChange(e) {
  const el = e.target.closest('[data-change]');
  if (!el) return;
  const a = el.dataset.change;
  // Persist every handled change (a select that only stores its value still
  // has to survive a reload); re-render only when the handler asks.
  if (a.startsWith('play-')) { const r = onPlayAction(state, a.slice(5), el, e); save(state); if (r) render(state); }
  else if (a.startsWith('bal-')) { const r = onBalanceAction(state, a.slice(4), el, e); save(state); if (r) render(state); }
}

function onHashChange() {
  if (syncFromHash()) { window.scrollTo({ top: 0 }); }
  render(state);
}

export function bindEvents() {
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('input', onChange);
  document.addEventListener('keydown', onKeydown);
  window.addEventListener('hashchange', onHashChange);
  // Views that finish loading something (the rulebook) ask for a repaint this way
  // instead of importing render.js into a module render.js already imports.
  document.addEventListener('enjeu:rerender', () => render(state));
  // After printing, empty the sheet so 90 SVGs do not sit in the DOM.
  window.addEventListener('afterprint', () => { const h = document.getElementById('printSheet'); if (h) h.innerHTML = ''; });
}
