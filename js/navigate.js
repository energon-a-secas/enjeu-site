// ── Hash router ──────────────────────────────────────────────
// Routes (contract C6 in docs/plans/2026-08-22-enjeu-site.md):
//   #/learn · #/learn/<section> · #/cards · #/cards/<deck> · #/cards/print
//   #/play · #/play/<level> · #/balance
// The hash is the source of truth for view + param; state mirrors it.

import { state } from './state.js';

export const VIEWS = ['learn', 'cards', 'play', 'balance'];

/** Parse location.hash into { view, param, query }. */
export function parseHash(hash = location.hash) {
  const m = /^#\/?([a-z]*)\/?([^?]*)\??(.*)$/.exec(hash || '');
  const view = VIEWS.includes(m?.[1]) ? m[1] : 'learn';
  const param = m?.[2] ? decodeURIComponent(m[2]) : null;
  const query = {};
  if (m?.[3]) for (const [k, v] of new URLSearchParams(m[3])) query[k] = v;
  return { view, param, query };
}

/** Apply the current hash to state. Returns true if view or param changed. */
export function syncFromHash() {
  const { view, param, query } = parseHash();
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
