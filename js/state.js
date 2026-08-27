// ── State ────────────────────────────────────────────────────
// One shared mutable object. The run in progress, the chosen die and mode,
// and the cards filter all live here so a reload lands where you were.

const STORAGE_KEY = 'enjeu-state';

export const state = {
  view: 'learn',        // learn | cards | play | balance
  param: null,          // second path segment, e.g. a deck or a level
  query: {},            // ?k=v after the hash
  cards: null,          // parsed data/cards.json (not persisted)
  lang: 'en',
  // Cards view
  deckFilter: 'all',
  paper: 'a4',
  withBacks: 'none',   // none | few (4) | all
  // Play view preferences (persisted) and the run itself (persisted)
  die: 'd20',
  mode: 'standard',
  element: 'fire',
  runKind: 'first',
  run: null,            // see game/engine.js newRun()
  // Balance view settings
  balance: { trials: 2000, bonus: 0, legacy: false, advantage: false, klass: 'none' },
};

const PERSIST = ['lang', 'deckFilter', 'paper', 'withBacks', 'die', 'mode', 'element', 'runKind', 'run', 'balance'];

export function loadSaved(s) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    for (const k of PERSIST) if (saved[k] !== undefined) s[k] = saved[k];
    if (saved.balance) s.balance = { ...s.balance, ...saved.balance };
  } catch { /* corrupted or unavailable storage: start fresh */ }
}

export function save(s) {
  try {
    const out = {};
    for (const k of PERSIST) out[k] = s[k];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
  } catch { /* quota or private mode */ }
}
