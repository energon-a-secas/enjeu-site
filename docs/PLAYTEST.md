# Playtest log

**No human has played Enjeu yet.** Everything in [BALANCE.md](BALANCE.md) comes from a
simulator, which can tell you a line is mathematically dominant and cannot tell you whether
anyone enjoyed the twenty minutes.

Log every session here, newest at the top. One entry per run, even the abandoned ones,
especially the abandoned ones, since *where* somebody stopped is the most useful signal
this document ever collects.

## What to write down

| Field | Why |
|---|---|
| Date, version (`data/cards.json` → `version`) | So a result can be tied to the rules that produced it |
| Player, and whether they had played before | First plays and repeat plays measure different things |
| Element, class, biomes drawn | The asymmetric parts, all currently untested |
| Level reached | The headline number |
| Minutes per level | The simulator says 3–4 rounds; it cannot say how long a round takes |
| Broken cards at each boss's death | Compare against 1.1 → 3.8 from the sim |
| Rules looked up mid-game, and which | Every lookup is a rulebook defect |
| Icons asked about | Every question is an icon defect: see [CARD-LAYOUT.md](CARD-LAYOUT.md) |
| Where they hesitated longest | Where the real decision is |
| What they said out loud | The whole point of a text-free deck |

## The six questions

Carried from [BALANCE.md](BALANCE.md). These are what the first sessions exist to answer.

1. **How long is a fight in minutes?** 3–4 rounds is right only if a round is quick. If
   players are doing arithmetic for six minutes a round, the design is wrong regardless of
   the win rate.
2. **Does the guard line get felt?** The intended moment is looking at your Ready cards,
   wanting to bet one more, and not. If nobody hesitates there, the core mechanic is not
   landing and nothing else matters.
3. **Is a 19% run completion too brutal?** Play six full runs. If nobody clears one, raise
   the Advantage draw or soften levels 4–5.
4. **Do the cards read without the rulebook?** Show the corners to somebody who has never
   played. Three seconds. If they cannot *guess* (not work out) what a glyph means, it is
   the wrong glyph.
5. **Does anyone actually cast All In?** It is the signature move and the game's name. If
   players find it too frightening to ever use, its odds or its multiplier need work.
6. **Which class gets picked twice?** That is the overpowered one.

## Running a blind test

From the board-game-design reference, and the reason friendly tests mislead: friends adapt
to broken mechanics without noticing, and they already heard you explain the game. Hand
somebody the rulebook and the cards. Leave. Answer nothing. Watch where they stop and
reread: that spot is a rulebook defect, not a player defect.

Weight blind sessions at roughly half of all feedback, guided sessions at a fifth.

---

## Sessions

### 2026-08-27 - v0.1.0 - the designer, first play ever

The first time a human played this. Everything above this line was simulated.

- **Reached:** not recorded
- **What was played:** enough to form a judgement on the Attack cards
- **The finding:** **All In was not worth casting.** In the player's words, Focus
  for 75 with no armour spent "is basically the same damage and less risk". That
  is exactly right and the arithmetic backs it: at 3x the bet, All In returned 38
  expected damage per life card against Focus's 56, and cost two actions instead
  of one. Dominated at every bet size. The card the game is named after was a trap.
- **Changed as a result:** All In pays **6x** the bet, not 3x. Re-measured at
  20,000 fights per cell: fights shortened (adaptive 3.1 to 2.6 rounds at level 1),
  fewer cards broken, skill ordering intact. Full write-up in
  [BALANCE.md](BALANCE.md).
- **Also raised:** a defensive "bubble" card, a safe mode with a shield worth 25.
  Not yet designed; the exact effect is an open question.

**What this session proves about the method:** four play styles and 20,000
simulated fights per cell never found this, because the simulator's `choose()`
ranks options by expected damage and simply never picked a dominated card, which
looks identical to a card being fine. One person playing for a few minutes found
it immediately. Question 5 on the list below ("does anyone actually cast All In?")
was the right question and the sim could not answer it.

<!--
### YYYY-MM-DD - v0.1.0 - <player>
- **Reached:** level N of 5
- **Element / class / biomes:**
- **Minutes per level:**
- **Broken at each kill:**
- **Looked up:**
- **Asked about icons:**
- **Longest pause:**
- **Said out loud:**
- **Changed as a result:**
-->
