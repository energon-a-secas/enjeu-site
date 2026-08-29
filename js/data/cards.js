// ── Card data ────────────────────────────────────────────────
// data/cards.json is the ONE source for every card, shared with the Python
// tools. Nothing here re-declares a number; it only indexes what is there.

export const DECKS = ['attack', 'skill', 'class', 'advantage', 'boss', 'biome', 'life', 'mode', 'aid'];

let _data = null;

/** Fetch once (the app is served over HTTP; file:// blocks ES modules anyway). */
export async function loadCards(url = 'data/cards.json') {
  if (_data) return _data;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`cards.json ${res.status}`);
  _data = index(await res.json());
  return _data;
}

/** Tests and workers pass the parsed JSON in directly. */
export function useCards(json) { _data = index(json); return _data; }
export function cards() { return _data; }

/**
 * Add derived indexes without touching the data: every card knows its deck,
 * `byId` resolves any card, and `physical` is the deck expanded to copies
 * (110 entries), which is what the print sheet and the count test consume.
 */
function index(json) {
  const byId = {};
  const physical = [];
  for (const deck of DECKS) {
    for (const c of json[deck] || []) {
      c.deck = deck;
      byId[c.id] = c;
      const n = c.copies || 1;
      for (let i = 0; i < n; i++) physical.push(c);
    }
  }
  return { ...json, byId, physical };
}

/** Human label for a check step, or null for "always lands". */
export const CHECKS = ['sure', 'even', 'hard', 'wild'];

/** The four elements in cycle order, each beating the next (from cards.json). */
export function elementBeats(data, attacker, defender) {
  return attacker && defender && data.element_cycle[attacker] === defender;
}
