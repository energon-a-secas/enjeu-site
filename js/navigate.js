// ── Hash router ──────────────────────────────────────────────
// Routes (contract C6 in docs/plans/2026-08-22-enjeu-site.md):
//   #/learn · #/learn/<section> · #/cards · #/cards/<deck> · #/cards/print
//   #/play · #/play/<level> · #/about · #/balance
// The hash is the source of truth for view + param; state mirrors it.

import { state } from './state.js';

export const VIEWS = ['learn', 'cards', 'play', 'about', 'balance'];

/**
 * The tabs the header actually shows. Balance is routable and unlisted: it is a
 * simulator readout for whoever is tuning the game, and it was the fourth thing
 * a child saw when they came to play. #/balance still works for anyone who wants
 * it, which is the difference between hiding a page and deleting one.
 */
export const NAV_VIEWS = ['learn', 'cards', 'play', 'about'];

/** Parse location.hash into { view, param, query }. */
export function parseHash(hash = location.hash) {
  const m = /^#\/?([a-z]*)\/?([^?]*)\??(.*)$/.exec(hash || '');
  // A hash that is not a route is an IN-PAGE ANCHOR, not a request for Learn.
  // Falling back here meant the skip link (href="#main", the first tab stop on
  // every page) and the rulebook's own #rb-* anchors threw the reader out of
  // whatever they were doing and into the Learn cover. js/views/learn.js already
  // says a non-route hash "is left exactly as the reader followed it"; the
  // router simply never got the same treatment.
  // An in-page ANCHOR has no leading slash (#main, #rb-the-boss); a ROUTE does
  // (#/cards). Only the anchor is none of the router's business: an unknown
  // route is still a route and still falls back to Learn, the way a 404 goes home.
  const named = m?.[1];
  const isRoute = /^#\//.test(hash) || hash === '' || hash === '#';
  if (!isRoute && named) return null;
  const view = VIEWS.includes(named) ? named : 'learn';
  const param = m?.[2] ? decodeURIComponent(m[2]) : null;
  const query = {};
  if (m?.[3]) for (const [k, v] of new URLSearchParams(m[3])) query[k] = v;
  return { view, param, query };
}

/** Apply the current hash to state. Returns true if view or param changed. */
export function syncFromHash() {
  const parsed = parseHash();
  // null means the hash was an in-page anchor, not a route: leave the view
  // exactly where the reader had it and let the browser do its own scrolling.
  if (!parsed) return false;
  const { view, param, query } = parsed;
  const changed = view !== state.view || param !== state.param;
  state.view = view; state.param = param; state.query = query;
  return changed;
}

export function goTo(view, param = null, query = null) {
  let h = `#/${view}`;
  if (param) h += `/${encodeURIComponent(param)}`;
  if (query) h += `?${new URLSearchParams(query)}`;
  if (location.hash === h) return;
  location.hash = h;
}

/** Scroll an in-view anchor into place after a render. */
export function reveal(id) {
  requestAnimationFrame(() => {
    const node = document.getElementById(id);
    if (!node) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    node.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    node.classList.remove('is-flash'); void node.offsetWidth; node.classList.add('is-flash');
  });
}
