// ── The Boss Seat ────────────────────────────────────────────
// Somebody has been rolling the boss's d6 this whole time. This is the module
// that gives that job to a person (docs/EXPANSIONS.md M6, RULES.seat.md).
//
// The boss's die becomes six cards, one per face, two of them Strike. The boss
// player holds a hand, commits one FACE DOWN before the hero acts, and turns it
// over when the boss acts. The engine is untouched: this hands bossRoll the
// same 1..6 it would have got from a die, so every reaction, signature, Rage
// and Brace branch is byte-identical and `legacy` never sees a seat at all.
//
// THREE THINGS THIS FILE GETS RIGHT BECAUSE THE FIRST DESIGN GOT THEM WRONG.
//
// 1. The sweep fires when the HAND empties, not the pile. With a hand of three,
//    the pile runs out on round 4 while two cards are still held, so "nothing
//    left to draw" arrived two rounds before the hand was empty and left the
//    table with no rule for the cards still in it.
//
// 2. The Row is swept every THREE cards, not every six. A fight is 3.4 rounds
//    at level 1 and 5.5 at level 5, so a six-card cycle essentially never
//    completed: the boss played its best three to five cards and the hero never
//    met the rest. Worse, drawing without replacement deletes the variance the
//    game's difficulty is made of, and measured out EASIER than the die rather
//    than harder. Three bites inside a real fight.
//
// 3. It does not claim the seat can never hit harder than the die. That claim
//    is true across a completed cycle and false inside a fight, which is the
//    only place anybody plays. What it claims instead is checkable: the same
//    face cannot come twice before a sweep, and Ruin cannot open a fight.
//
// A second player choosing well SHOULD be harder than a die. The handicap is
// the hand size, not a promise about the odds.

/**
 * The six faces of the boss's die, as cards. Two Strikes because the shared
 * table (data/cards.json boss_reaction) gives Strike rolls 2 and 3, and the
 * whole point is that the deck IS the die rather than a new distribution.
 */
export const SEAT_DECK = [
  { face: 1, id: 'brace' },
  { face: 2, id: 'strike' },
  { face: 3, id: 'strike' },
  { face: 4, id: 'summon' },
  { face: 5, id: 'roar' },
  { face: 6, id: 'ruin' },
];

/** How many cards the boss player holds. The hand size IS the difficulty dial. */
export const HAND_FOR = { friendly: 1, assisted: 2, hardcore: 3 };

/** The Row is swept back in after this many cards. See note 2 above. */
export const CYCLE = 3;

/** A fresh seat. `shuffle` is injected: this file rolls nothing of its own. */
export function newSeat(style = 'assisted', shuffle = (a) => a) {
  const hand = Math.max(1, Math.min(3, HAND_FOR[style] ?? 2));
  const pile = shuffle([...SEAT_DECK]);
  return {
    style, handSize: hand,
    hand: pile.splice(0, hand),
    pile,
    row: [],           // cards played this cycle, face up
    committed: null,   // the face-down card waiting for the boss's turn
    faceUp: false,     // from Rage on, the commitment is made in the open
  };
}

/**
 * Cards the boss player may legally commit right now.
 *
 * Ruin cannot open a fight. That is the one gate, and it is a gate about the
 * first round rather than about position in the Row: a child meeting double
 * damage before they have taken a turn learns nothing except that the game is
 * unfair. After that it is available like anything else.
 */
export function playable(seat, round) {
  if (!seat) return [];
  return seat.hand.filter((c) => !(c.id === 'ruin' && round <= 1));
}

/** Put one card face down (or face up, under Rage). Returns the seat. */
export function commit(seat, index, raging = false) {
  if (!seat) throw new Error('no seat');
  if (seat.committed) throw new Error('a card is already lying there');
  const card = seat.hand[index];
  if (!card) throw new Error('no such card in hand');
  seat.hand.splice(index, 1);
  seat.committed = card;
  seat.faceUp = !!raging;
  return seat;
}

/**
 * Turn the committed card over and hand back its face for bossRoll.
 *
 * Everything after this is the base game: the face goes into bossRoll exactly
 * as a die result would, so there is no second resolution path to keep in step.
 */
export function reveal(seat) {
  if (!seat?.committed) return null;
  const card = seat.committed;
  seat.committed = null;
  seat.faceUp = false;
  seat.row.push(card);
  return card.face;
}

/**
 * Draw back up, and sweep when the HAND is empty or the cycle is complete.
 * Called once the boss's card has been revealed.
 */
export function refill(seat, shuffle = (a) => a) {
  if (!seat) return seat;
  while (seat.hand.length < seat.handSize && seat.pile.length) {
    seat.hand.push(seat.pile.shift());
  }
  // Sweep on either condition, and say which so a table can follow it: the Row
  // reaching three is the usual one, an empty hand is the backstop when a small
  // pile ran out first.
  if (seat.row.length >= CYCLE || (!seat.hand.length && !seat.pile.length)) {
    const all = shuffle([...SEAT_DECK]);
    seat.row = [];
    seat.hand = all.splice(0, seat.handSize);
    seat.pile = all;
    return { ...seat, swept: true };
  }
  return seat;
}

/** True when this seat is the one supplying the boss's number. */
export const seatOf = (f) => f?.seat || null;
