// ── Expansion modules ────────────────────────────────────────
// data/expansions.json, indexed. Deliberately a separate fetch from
// js/data/cards.js: the base game is 111 frozen cards and every count test in
// the suite depends on `physical` meaning exactly those. An expansion card is
// physical too, but it belongs to a different box.
//
// A site with no expansion module loaded behaves exactly as it did before this
// file existed, which is what makes a module droppable rather than merely
// optional.

import { MARKS, MARK_IDS } from '../game/marks.js';

let _mods = null;

export async function loadExpansions(url = 'data/expansions.json') {
  if (_mods) return _mods;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`expansions.json ${res.status}`);
  _mods = index(await res.json());
  return _mods;
}

/** Tests and workers pass the parsed JSON in directly. */
export function useExpansions(json) { _mods = index(json); return _mods; }
export function expansions() { return _mods; }

function index(json) {
  const byId = {};
  for (const m of json.modules || []) byId[m.id] = m;
  return { ...json, byId };
}

/** The module a table has switched on, or null. */
export const moduleOf = (mods, id) => mods?.byId?.[id] || null;

/**
 * The object this biome hands you, or null. Three of the seven biomes (Forest,
 * Village, Castle) have a rule of their own in the base rulebook and no object;
 * the four elemental ones had `rule: null` and nothing to do beyond an element
 * bonus, which is exactly the gap this module fills. Filling it costs no
 * reprint: a biome card face carries no text at all.
 */
export function objectFor(mods, biomeId) {
  const t = moduleOf(mods, 'terrain');
  if (!t || !biomeId) return null;
  return t.biome_object.find((o) => o.biome === biomeId) || null;
}

/** Every hazard in the terrain module, or an empty list when it is not in play. */
export const hazards = (mods) => moduleOf(mods, 'terrain')?.hazard || [];

/** One hazard, drawn with the caller's own randomness. The engine rolls nothing. */
export function drawHazard(mods, u) {
  const list = hazards(mods);
  return list.length ? list[Math.min(list.length - 1, Math.floor(u * list.length))] : null;
}

/** Every prop in the Preparation module, or nothing when it is not in play. */
export const props = (mods) => moduleOf(mods, 'prep')?.prop || [];

/**
 * One prop, drawn the same way. A prop and a biome object are the same kind of
 * thing to useObject(), which is why M2 needed no engine change to place one:
 * they share the level's single `objectUsed` slot, so a table running both
 * modules still gets one object and one use, and M2 cannot stack free damage
 * on top of M1.
 */
export function drawProp(mods, u) {
  const list = props(mods);
  return list.length ? list[Math.min(list.length - 1, Math.floor(u * list.length))] : null;
}

/**
 * Deck keys a module may carry, in print order. An array under any other key
 * (`needs`, say) is not a deck and is not printed. Naming them explicitly beats
 * "every array": a module that grows a bookkeeping list would otherwise start
 * printing it, and nobody would see that until the sheets came out of the tray.
 */
export const MODULE_DECKS = ['attack', 'skill', 'hazard', 'prop', 'reaction', 'item', 'summon', 'vehicle', 'scenario', 'aid'];

export function moduleCards(mods, id = 'terrain') {
  const m = moduleOf(mods, id);
  if (!m) return [];
  // Terrain's six Mark cards are generated from js/game/marks.js rather than
  // stored, because the rules of a Mark live in exactly one place and a printed
  // card that disagrees with the engine is the worst kind of bug: the table
  // believes the card.
  const marks = id === 'terrain' ? MARK_IDS.map((mid) => ({ ...MARKS[mid], deck: 'mark' })) : [];
  const rest = MODULE_DECKS.flatMap((deck) => (m[deck] || []).map((c) => {
    // A hazard and a prop both say "this thing gives you that Mark", so both
    // carry the Mark's own colour onto their face.
    const markId = deck === 'hazard' ? c.mark : deck === 'prop' ? c.target_mark : null;
    if (!markId) return { ...c, deck: c.deck || deck };
    const mk = MARKS[markId] || {};
    const dark = markId === 'marked' || markId === 'frozen' || markId === 'charged';
    return {
      ...c, deck: c.deck || deck,
      markIcon: mk.icon, markHex: mk.hex, markInk: dark ? '#2b2118' : '#fffdf7',
    };
  }));
  // Copies expanded, exactly as js/data/cards.js does for the base game. A
  // module that ships two of a card (M4's blanks, M7's) would otherwise print
  // one of each and nobody would notice until the sheets came out of the tray.
  const out = [];
  for (const c of [...marks, ...rest]) {
    for (let i = 0; i < (c.copies || 1); i++) out.push(c);
  }
  return out;
}

/** Sheets a module costs at nine cards per A4, which is what a household asks. */
export const moduleSheets = (mods, id = 'terrain') => Math.ceil(moduleCards(mods, id).length / 9);
