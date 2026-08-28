// ── Events ───────────────────────────────────────────────────
// One delegated click listener reads data-action; views never bind their
// own. Keyboard: Esc closes the modal, Tab is trapped inside it.

import { state, save } from './state.js';
import { render } from './render.js';
import { syncFromHash, goTo } from './navigate.js';
import { onCardsAction } from './views/cards.js';
import { onPlayAction, onPlayKey } from './views/play.js';
import { onLearnAction, onLearnKey } from './views/learn.js';
import { onBalanceAction } from './views/balance.js';

/**
 * ── The view seam ────────────────────────────────────────────
 * A view owns its own interactions, and this file only routes to them. Two
 * conventions, and both are contracts a view must not break:
 *
 *   data-action="<view>-<act>"  arrives as onXAction(state, act, el, event) and
 *                               returns true when the view must re-render.
 *   a keypress on the active view arrives as onXKey(state, event) and returns
 *                               true when the view must re-render.
 *
 * The key handlers exist because Learn is a slide deck and Play is a board:
 * both are driven by arrows and digits, and a global keydown listener that
 * knew about either one would have to know about both.
 *
 * There used to be six unprefixed Cards actions handled here directly, left over
 * from before the seam existed. Two of them were the reason the print toggle
 * (`backs`, writing `state.withBacks`) and the screen toggle (`cards-backs`,
 * writing `state.browse.backs`) could sit one letter apart in two files without
 * anyone noticing. They are `cards-*` now and live next to each other in the
 * view, so the difference is readable at the point of decision.
 */
const ACTIONS = { learn: onLearnAction, cards: onCardsAction, play: onPlayAction, bal: onBalanceAction };
// Cards is a browsable grid: native tab order is the right keyboard for it, so
// it registers an action handler and no key handler.
const KEYS = { learn: onLearnKey, play: onPlayKey };

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

/** A keystroke the page may claim: not in a field, not with a modifier held. */
function isPlainKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  const el = e.target;
  if (el?.isContentEditable) return false;
  const tag = el?.tagName;
  return tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT';
}

function onKeydown(e) {
  if (e.key === 'Enter' && e.target?.dataset?.change === 'play-typed') {
    e.preventDefault();
    document.querySelector('[data-action="play-go-typed"]')?.click();
    return;
  }
  const modal = openModalEl();
  if (modal) {
    if (e.key === 'Escape') { e.preventDefault(); closeModal(modal.id); return; }
    if (e.key !== 'Tab') return;
    const list = focusable(modal.querySelector('.modal__dialog') || modal);
    if (!list.length) return;
    const first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    return;
  }
  // No modal: the active view gets first refusal on the key.
  const handler = KEYS[state.view];
  if (!handler || !isPlainKey(e)) return;
  if (handler(state, e)) { save(state); render(state); }
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

  // `go` is the one action no view owns: it changes which view is on screen, so
  // it belongs to the router. Everything else is `<view>-<act>`.
  if (a === 'go') {
    goTo(el.dataset.view, el.dataset.param || null, el.dataset.q ? Object.fromEntries(new URLSearchParams(el.dataset.q)) : null);
    return;
  }
  dispatch(s, a, el, e);
}

/** Route `<view>-<act>` to the owning view. Returns false if nothing claimed it. */
function dispatch(s, a, el, e) {
  const cut = a.indexOf('-');
  if (cut < 0) return false;
  const handler = ACTIONS[a.slice(0, cut)];
  if (!handler) return false;
  if (handler(s, a.slice(cut + 1), el, e)) { save(s); render(s); }
  else save(s);
  return true;
}

function onChange(e) {
  const el = e.target.closest('[data-change]');
  if (!el) return;
  // Persist every handled change (a select that only stores its value still
  // has to survive a reload); re-render only when the handler asks.
  dispatch(state, el.dataset.change, el, e);
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
  // After printing, empty the sheet so 94 SVGs do not sit in the DOM.
  window.addEventListener('afterprint', () => { const h = document.getElementById('printSheet'); if (h) h.innerHTML = ''; });
}
