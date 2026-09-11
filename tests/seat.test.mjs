// The Boss Seat (docs/EXPANSIONS.md M6, RULES.seat.md): a person supplies the
// boss's number instead of a die.
//
// The load-bearing claim is that the ENGINE never learns about any of this.
// reveal() hands bossRoll the same 1..6 a die would, so every reaction,
// signature, Rage and Brace branch is byte-identical and `legacy` cannot see a
// seat at all. Most of this file is about the three rules that a review found
// broken in the first design, each of which would have stalled a real table.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { useCards } from '../js/data/cards.js';
import { useExpansions, moduleOf, moduleCards } from '../js/data/expansions.js';
import { newFight, bossRoll, resolveBoss } from '../js/game/engine.js';
import { SEAT_DECK, HAND_FOR, CYCLE, newSeat, playable, commit, reveal, refill } from '../js/game/seat.js';
import { hasGlyph } from '../js/cards/glyphs.js';
import { rng } from '../js/utils.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = useCards(JSON.parse(readFileSync(join(root, 'data/cards.json'), 'utf8')));
const mods = useExpansions(JSON.parse(readFileSync(join(root, 'data/expansions.json'), 'utf8')));
const L1 = data.boss.find((b) => b.size === 'M');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}

// A deterministic shuffle, so a test states an outcome rather than a tendency.
const shuffleWith = (next) => (a) => {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// ── The deck IS the die ──────────────────────────────────────

test('six cards, one per face, and two of them Strike', () => {
  assert.equal(SEAT_DECK.length, 6);
  assert.deepEqual(SEAT_DECK.map((c) => c.face), [1, 2, 3, 4, 5, 6]);
  // The shared table gives Strike rolls 2 and 3, so the deck must too, or the
  // module quietly ships a different boss.
  const table = data.boss_reaction;
  for (const card of SEAT_DECK) {
    const row = table.find((r) => (Array.isArray(r.roll) ? r.roll.includes(card.face) : r.roll === card.face));
    assert.ok(row, `no reaction for face ${card.face}`);
    assert.equal(card.id, row.id, `face ${card.face} is ${card.id} here and ${row.id} in cards.json`);
  }
  assert.equal(SEAT_DECK.filter((c) => c.id === 'strike').length, 2);
});

test('the hand size is the whole difficulty dial, and it is the game\'s own dial', () => {
  assert.deepEqual(HAND_FOR, { friendly: 1, assisted: 2, hardcore: 3 });
  for (const [style, n] of Object.entries(HAND_FOR)) {
    assert.equal(newSeat(style).hand.length, n);
    assert.equal(newSeat(style).pile.length, 6 - n, 'the rest is the pile');
  }
  assert.equal(newSeat('nonsense').hand.length, 2, 'an unknown style falls back to assisted');
});

// ── The three rules a review found broken ────────────────────

test('the sweep fires when the HAND empties, not when the pile does', () => {
  // With a hand of three the pile runs out on round 4 while two cards are still
  // held, so "nothing left to draw" arrived two rounds before the hand was
  // empty and left the table with no rule for the cards still in it.
  const seat = newSeat('hardcore');
  assert.equal(seat.pile.length, 3);
  let s = seat, sweeps = 0;
  for (let round = 1; round <= 6; round++) {
    commit(s, 0);
    reveal(s);
    const before = s.row.length;
    s = refill(s);
    if (s.swept) { sweeps++; delete s.swept; }
    assert.ok(s.hand.length > 0, `round ${round}: the boss player must always have a card to commit`);
    assert.ok(before <= CYCLE, 'the Row never grows past the cycle');
  }
  assert.ok(sweeps >= 1, 'and it did sweep');
});

test('the Row is swept every three cards, so the cycle bites inside a real fight', () => {
  // Fights are 3.4 rounds at level 1 and 5.5 at level 5. A six-card cycle
  // essentially never completed: the boss played its best three cards and the
  // hero never met the rest.
  assert.equal(CYCLE, 3);
  let s = newSeat('assisted');
  for (let i = 0; i < 3; i++) { commit(s, 0); reveal(s); s = refill(s); }
  assert.equal(s.row.length, 0, 'three played, Row swept');
  assert.equal(s.hand.length, 2, 'and a fresh hand dealt');
  assert.equal(s.hand.length + s.pile.length, 6, 'all six are back in play');
});

test('Ruin cannot open a fight, and is available after that', () => {
  const seat = { ...newSeat('hardcore'), hand: [{ face: 6, id: 'ruin' }, { face: 2, id: 'strike' }] };
  assert.deepEqual(playable(seat, 1).map((c) => c.id), ['strike'], 'round 1: no Ruin');
  assert.deepEqual(playable(seat, 2).map((c) => c.id), ['ruin', 'strike'], 'round 2: anything');
  assert.deepEqual(playable(null, 1), [], 'no seat, nothing playable');
});

test('a committed card is not replaced by another, and Rage turns it face up', () => {
  const s = newSeat('assisted');
  commit(s, 0);
  assert.ok(s.committed, 'one lies there');
  assert.equal(s.faceUp, false);
  assert.throws(() => commit(s, 0), /already lying there/, 'a Frozen boss leaves its card down; nothing stacks on it');

  const r = newSeat('assisted');
  commit(r, 0, true);
  assert.equal(r.faceUp, true, 'from Rage on, the child can see the worst coming');
});

// ── The engine never learns about any of this ────────────────

test('reveal hands bossRoll exactly what a die hands it', () => {
  for (const face of [1, 2, 3, 4, 5, 6]) {
    const seat = { ...newSeat('friendly'), hand: [{ face, id: 'x' }], committed: null };
    commit(seat, 0);
    const got = reveal(seat);
    assert.equal(got, face, 'the face goes through untouched');

    // And the fight resolves it identically to a rolled die.
    const bySeat = newFight(data, {
      level: 1, boss: L1, noSignatures: true,
      hero: { element: 'fire', klass: null, pool: ['fire', 'fire', 'fire', 'fire'], attacks: data.attack },
      die: 'd20', mode: 'standard',
    });
    const byDie = newFight(data, {
      level: 1, boss: L1, noSignatures: true,
      hero: { element: 'fire', klass: null, pool: ['fire', 'fire', 'fire', 'fire'], attacks: data.attack },
      die: 'd20', mode: 'standard',
    });
    bySeat.phase = byDie.phase = 'boss';
    const a = bossRoll(bySeat, got);
    const b = bossRoll(byDie, face);
    assert.deepEqual({ ...a }, { ...b }, `face ${face} resolves differently through the seat`);
  }
});

test('reveal on an empty seat is null, not a crash', () => {
  assert.equal(reveal(newSeat('assisted')), null, 'nothing committed');
  assert.equal(reveal(null), null);
  assert.equal(refill(null), null);
});

test('over many cycles the seat deals every face, and no face twice before a sweep', () => {
  const next = rng(11);
  const shuffle = shuffleWith(next);
  let s = newSeat('assisted', shuffle);
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    const opts = playable(s, 2);
    const pick = s.hand.indexOf(opts[Math.floor(next() * opts.length)]);
    commit(s, pick < 0 ? 0 : pick);
    const face = reveal(s);
    seen.add(face);
    // Inside a cycle the same face may not repeat: that is the module's one
    // honest guarantee, and the reason it is honest is that a cycle is three.
    const faces = s.row.map((c) => c.face);
    assert.equal(new Set(faces).size, faces.length, `a face repeated inside a cycle: ${faces}`);
    s = refill(s, shuffle);
    delete s.swept;
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6], 'every face turns up');
});

// ── Components ───────────────────────────────────────────────

test('seven cards on one sheet, and the numeral on each is its die face', () => {
  const cards = moduleCards(mods, 'seat');
  assert.equal(cards.length, 7);
  assert.equal(moduleOf(mods, 'seat').sheets, 1);
  const reactions = cards.filter((c) => c.deck === 'reaction');
  assert.deepEqual(reactions.map((c) => c.face), [1, 2, 3, 4, 5, 6]);
  for (const c of cards) assert.ok(hasGlyph(c.icon), `${c.id} names "${c.icon}", which is not a glyph`);
  const baseIds = new Set(data.physical.map((c) => c.id));
  for (const c of cards) assert.equal(baseIds.has(c.id), false, `${c.id} collides with a base card`);
  assert.equal(data.physical.length, 111);
  assert.deepEqual(moduleOf(mods, 'seat').needs, [], 'the seat needs no other module');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
