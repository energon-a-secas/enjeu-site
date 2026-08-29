// ── Print scopes (v1.3) ──────────────────────────────────────
// Which physical cards a table actually needs. Three answers:
//
//   all         the whole box, 110 cards
//   essentials  everything but the 7 biome cards: a biome is a place, and any
//               object on the table can stand for a place, while every other
//               deck is numbers the game reads. Life cards always stay (a
//               flipped life card is how Broken looks on a table) and so do
//               the player-count cards (Sidekick is the 2-player game).
//   first       exactly what the First Game deals, derived from the same
//               rosters js/game/run.js plays from, so the printed starter and
//               the on-screen First Game can never drift apart: the six attack
//               cards, all four elements' life (you pick yours at the table),
//               the level 1 boss and its life, the minion card a Summon needs,
//               Second Wind (the First Game defaults it on), and the aids.
//
// The scope filters FACES; the backs setting rides along unchanged, and backs
// mirror the filtered list (js/cards/sheet.js), so skipping the biome faces
// skips their backs with no second rule.
import { BOSSES, MINION } from '../data/placeholders.js';

export const SCOPES = ['all', 'essentials', 'first'];

/** The physical (copies-expanded) list a scope prints, in cards.json order. */
export function scopeCards(data, scope) {
  const physical = data.physical;
  if (scope === 'essentials') return physical.filter((c) => c.deck !== 'biome');
  if (scope === 'first') {
    const roster = BOSSES[0];
    const boss = data.byId[roster.card];
    const want = new Set([
      ...data.attack.map((c) => c.id),
      roster.card, MINION.card, 'second-wind',
      ...data.aid.map((c) => c.id),
    ]);
    let bossLife = boss.life_cards;
    return physical.filter((c) => {
      if (want.has(c.id)) return true;
      if (c.deck !== 'life') return false;
      if (c.id === 'life-boss') return bossLife-- > 0;
      return c.id !== 'life-extra'; // the four element sets; extras are earned later
    });
  }
  return physical;
}

/** Faces-only sheet count, for the button label (the toast reports real pages). */
export const scopeSheets = (data, scope) => Math.ceil(scopeCards(data, scope).length / 9);
