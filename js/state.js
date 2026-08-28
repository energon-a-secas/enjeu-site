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
  // Learn view: which slide of the stepper you were on
  learnStep: 0,
  // Cards view
  deckFilter: 'all',
  browse: {
    sort: 'deck',        // deck | element | tier | class | check | damage | name
    element: 'all',      // all | fire | water | earth | wind | none
    tier: 'all',         // all | 0 | 1 | 2 | 3 | 4
    klass: 'all',        // all | knight | hunter | mage | necromancer | none
    backs: false,        // show the printed BACK of each card instead of its face
  },
  paper: 'a4',
  withBacks: 'none',   // none | few (4) | all  (what the PRINT sheet appends)
  // Play view preferences (persisted) and the run itself (persisted)
  die: 'd20',
  mode: 'standard',
  element: 'fire',
  runKind: 'first',
  secondWind: true,     // the gentle-mode card in play; default follows runKind
  run: null,            // see game/engine.js newRun()
  // Board preferences. NOT in run.ui: game/run.js resets that object every
  // level, and a preference that resets every level is not a preference.
  play: { logOpen: true },
  // Balance view settings
  balance: { trials: 2000, bonus: 0, legacy: false, advantage: false, klass: 'none' },
};

/**
 * Second Wind is a safety net for a first game, not a fixture of the campaign:
 * on for the First Game, off for the five-level run. The setup screen shows a
 * toggle either way, so this only decides where that toggle starts.
 */
export const secondWindDefault = (kind) => kind === 'first';

const PERSIST = ['lang', 'learnStep', 'deckFilter', 'browse', 'paper', 'withBacks', 'die', 'mode', 'element', 'runKind', 'secondWind', 'run', 'play', 'balance'];

// The nested settings, defaults captured before anything can overwrite them.
const NESTED = ['balance', 'browse', 'play'];
const DEFAULTS = Object.fromEntries(NESTED.map((k) => [k, { ...state[k] }]));

export function loadSaved(s) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    for (const k of PERSIST) if (saved[k] !== undefined) s[k] = saved[k];
    // Nested settings are MERGED onto their defaults, never replaced. A save
    // written by an older build is missing whatever key this build added, and a
    // wholesale assignment hands the view an undefined it renders as a blank
    // control. The defaults have to come from DEFAULTS and not from s: the loop
    // above has already replaced s.balance by the time this runs, which is why
    // the merge that read s.balance was a no-op for as long as it existed.
    for (const k of NESTED) if (saved[k]) s[k] = { ...DEFAULTS[k], ...saved[k] };
  } catch { /* corrupted or unavailable storage: start fresh */ }
}

export function save(s) {
  try {
    const out = {};
    for (const k of PERSIST) out[k] = s[k];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
  } catch { /* quota or private mode */ }
}
