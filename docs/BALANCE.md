# Balance

**Two engines produce the numbers in this file, and every claim below says which one.**
This file used to open by saying every number came out of `tools/sim.py`. That stopped
being true when the JS engine grew the cards the Python does not know about.

- **`tools/sim.py`** is the design baseline and it produces the published table. It knows
  three attack cards (Strike, Focus, All In) and the tuned tier ladder. Nothing else.
- **`js/game/engine.js`**, driven by the harnesses in `tools/checks/`, plays the whole
  rulebook: Bubble, Run, the Hidden state, Second Wind, the Ally, classes and the
  Advantage deck. Its win rates are markedly harsher than the Python's and they are
  **not comparable** to the table below. Where one appears it is labelled.

An unlabelled number in this file is a `tools/sim.py` number.

Reproduce the table with:

```bash
python3 tools/sim.py --trials 20000
```

## The measured table

Source: `tools/sim.py`, re-measured 2026-08-28. 20,000 simulated fights per cell, seed 7,
no affinity bonus (the pessimistic case: a player who never gets a favourable matchup).
`rounds` and `broken` are averages over the adaptive line; `broken` counts life cards
permanently lost, out of a pool of 4 at level 1 rising to 8 at level 5. `rounds` averages
winning fights only, which is why turtle has no round count at levels 4 and 5: it never
wins one.

| Level | turtle | safe | **adaptive** | gamble | adaptive rounds | adaptive broken |
|---|---|---|---|---|---|---|
| 1 | 53.2% | 87.9% | **90.8%** | 67.4% | 3.1 | 1.0 |
| 2 | 4.3% | 78.7% | **84.1%** | 55.2% | 3.3 | 1.4 |
| 3 | 0.0% | 52.9% | **64.6%** | 55.4% | 3.3 | 2.6 |
| 4 | 0.0% | 42.6% | **59.5%** | 60.6% | 3.3 | 3.3 |
| 5 | 0.0% | 45.1% | **61.0%** | 44.6% | 3.9 | 3.8 |

The 2026-08-28 re-measurement reproduced this table cell for cell, so
`js/data/published.js` and the parity assertion in `tests/engine.test.mjs` are unchanged
and still correct. **The table was never the thing that was wrong. The prose under it
was**, and that prose is what this revision replaces.

The four styles are stand-ins for how a person plays:

- **turtle**: never bets. Strike x3, every round, forever.
- **safe**: bets only down to the cards needed to guard a nominal boss hit.
- **adaptive**: plays safe, but takes a kill shot when it is likely, or when Rage is about
  to make the fight unsurvivable anyway.
- **gamble**: bets everything, every round.

### All In: the retune, and a correction to what was written about it

The first human playtest reported All In as not worth casting, and the arithmetic agreed.
At 3x the bet it returned 38 expected damage per life card (75 damage per card at the Even
step) against Focus's 56, for twice the actions: dominated at every bet size, so a rational
player never touched the card the game is named after.

It went to 6x, which fixed it and overshot, and then to **4x**, which is what ships
(`data/cards.json`, `all-in`: `"damage": "4x bet"`, `"check": "even"`; `unit` is 25).
4x was the player's call and it is the better number for two reasons. The arithmetic is a
child's: **100 damage per card bet**, so 1, 2, 3, 4 cards read as 100, 200, 300, 400 with
nothing to work out. And it still solves the original problem, because All In is judged by
the turn, not the card: All In on 4 cards plus a Strike is 225 expected against 169 for
three Focuses. At 6x that same turn was 325, which made every other attack card decorative.

**The efficiency claim that used to sit here was wrong.** It said All In returns 75
expected damage per life card and therefore sits in tier 1's band while being a tier 0
card, a rule knowingly bent. That is an arithmetic error: it multiplied the 100 damage per
card by the Sure step (0.75) instead of the Even step the card actually uses. At 4x and an
Even check, All In returns **100 x 0.5 = 50 expected damage per life card**. The
`efficiency_bands` block in `data/cards.json` puts tier 0 at 50 to 65, so All In sits at
the floor of its own tier's band. **No rule is bent.** It is a tier 0 card priced like a
tier 0 card, which buys its 400-point ceiling with 2 of your 3 actions and a coin flip.
`lint_cards.py` does not test it either way, because a variable bet has no fixed per-card
number to check.

**What could not be re-measured.** The bullet list that used to close this section quoted
before-and-after deltas for the retune: adaptive rounds falling 3.1 to 2.6 at level 1,
broken cards falling 1.1 to 0.8, level 2 gamble climbing 48% to 65%, safe play sliding
89% to 83%. None of those "after" figures appears anywhere in the measured table, and
several of the "before" figures are the values the table shows **now**. They cannot be
reproduced: `tools/sim.py` hardcodes the multiplier (`4 * cards * LIFE`), so producing a 3x
or 6x column means editing the design baseline, which this document does not get to do.
The deltas are removed rather than corrected. What the shipped 4x build measures is the
table above, and nothing in this file should claim a movement it cannot show.

### What the table says

**Skill is rewarded, with one exception the table refutes.** Adaptive beats safe at all
five levels. It beats gamble at four of them. **At level 4 it does not: gamble takes
60.6% against adaptive's 59.5%.** The claim that used to stand here, that adaptive is the
best line at every level, is false and the table has always said so. What survives is the
weaker and still important claim: **adaptive is the best line over a run.** Multiplying
each column gives adaptive 17.90%, safe 7.03%, gamble 5.57%, turtle 0%. Gambling every
round finishes a run less than a third as often as playing adaptive, so level 4 is one
good cell bought with four bad ones, not a strategy.

**Playing safe stops working.** The safe line holds up through level 2 (78.7%) and then
falls off a cliff at level 3 (52.9%) and level 4 (42.6%). From the midpoint of the
campaign the game stops letting you win by hoarding: you have to bet. That is the arc the
design is for.

**Turtling is fatal.** 53.2% at level 1, 4.3% at level 2, zero at 3, 4 and 5. The Rage rule
does its job: a player who never bets runs out of clock long before the boss runs out of
life.

**Gambling is not a strategy, it is a tool.** Pure gambling underperforms adaptive at
levels 1, 2, 3 and 5, and over a whole run it lands at 5.57% against adaptive's 17.90%.
Level 4 is the one place the game genuinely rewards recklessness, and it rewards it by
1.1 points. Worth watching in playtest rather than "fixing" preemptively.

**Fights are 3 to 4 rounds** on the adaptive line (3.1, 3.3, 3.3, 3.3, 3.9), and the final
fight is the longest. About 9 to 12 decisions per boss. Gambling ends fights faster (1.5
rounds at level 1) because it ends them one way or the other.

**You finish scarred.** Broken cards climb **1.0 to 3.8** across the campaign on the
adaptive line. By the last level you are routinely ending fights on half your pool.

### Run completion

Multiplying the adaptive column, 0.908 x 0.841 x 0.646 x 0.595 x 0.610:

> **A full five-level run completes 17.90% of the time.**

The figure quoted here before was "about 19%", which its own column does not support. The
same product for the other lines: safe 7.03%, gamble 5.57%, turtle 0.00%.

That is roguelike territory, and it is probably too harsh for the audience this is aimed
at. Two things to know before reacting to it:

- `tools/sim.py` **does not model the Advantage deck.** A run **draws five** Advantage cards
  and can play all five: one at setup, then one after each of levels 1, 2, 3 and 4. There is
  no sixth. `levelWon` sends the run to `done` at level 5 and returns before it ever reaches
  the draft, which is the only other place `drawAdvantage` is called
  (`js/game/run.js`, `js/views/play.js`). This paragraph previously said six drawn and five
  playable, with a sixth drawn after the final boss; both halves were wrong.
  A Chest draws two more on top. Cure, Barrier, Rune and Relic are all substantial. 17.90%
  is a floor, not an estimate.
- Broken cards fully reset between levels, so the run is five independent fights. There is
  no attrition spiral across levels.

The JS engine can switch the Advantage deck on (`opts.advantage` in `js/game/sim.js`), but
no harness in `tools/checks/` reports a full-run figure with it on. Until one
does, the run-completion figure should not be quoted as the real one.

## The design rules the numbers produced

**Damage per life card must rise with tier.** The first pass had:

| | bet | damage | check | expected | per card |
|---|---|---|---|---|---|
| Focus | 1 | 75 | Sure | 56 | 56 |
| Tier 1 | 1 | 100 | Sure | 75 | **75** |
| Tier 2 | 2 | 150 | Sure | 112 | 56 |
| Tier 3 | 2 | 250 | Even | 125 | 62 |
| Tier 4 | 3 | 400 | Even | 200 | 67 |

Tier 1 was the most card-efficient attack in the game. Because life cards, not actions, are
the binding constraint under careful play, that made every level-up a *downgrade*. The
shiny new meteor was worse per card than the thing you already had. The tuned ladder, every
row of it read back out of `data/cards.json`:

| | bet | damage | check | expected | per card | tier band |
|---|---|---|---|---|---|---|
| Strike | 0 | 25 | none | 25 | none | none |
| Focus | 1 | 75 | Sure | 56 | 56 | 50 to 65 |
| All In | any | 100 per card | Even | 50 per card | 50 | 50 to 65 |
| Tier 1 | 1 | 100 | Sure | 75 | 75 | 66 to 80 |
| Tier 2 | 2 | 225 | Sure | 169 | 84 | 81 to 92 |
| Tier 3 | 2 | 400 | Even | 200 | 100 | 93 to 112 |
| Tier 4 | 3 | 750 | Even | 375 | 125 | 113 to 135 |

The bands are the `efficiency_bands` block in `data/cards.json`, and every row above lands
inside its own. Strike bets nothing, so it has no per-card number and no band.

**Any new card must fit that ladder.** Take its expected damage (damage x hit chance),
divide by the cards it bets, and check the result sits in its tier's band. A card that
beats 135 per life card is stronger than a Tier 4 meteor regardless of what its picture
says.

**Boss Damage sets the betting budget.** The cards you may safely bet equal your pool minus
the cards needed to guard one nominal hit. Boss Damage is chosen so that budget grows
2 to 4 across the campaign. Holding it flat (the first attempt) made every level-up
cosmetic, because the extra life card went straight into guarding the bigger hit.

**The ladder is spaced 75/50/25, not evenly.** At the 50% step, rolling twice and keeping
the better result gives exactly 75%, and keeping the worse gives exactly 25%: advantage
and disadvantage move you exactly one rung with no second table and no rounding. See
[DICE-BRIDGE.md](DICE-BRIDGE.md).

## Two defects the spec had

Recorded because both were invisible until the numbers were run, and both would have
shipped.

**The special attack was worse than the free one.** As specified, 50 damage on d20 >= 15,
it returns 30% x 50 = 15 expected damage, against a basic attack dealing 25 guaranteed for
no life at all. Nobody would ever have used it. Retuned to 75 damage at the Sure step.

**Turtling was immortal.** Under full regeneration, a player who never bets always has a
full pool to guard with, and guarding costs nothing permanent. The first model had no way
to kill such a player at all. Rage (double damage that ignores guards) is the answer, and
the sim confirms it works.

## What `tools/sim.py` does not model

Read this before trusting any number above. Where the JS engine does model something, a
harness in `tools/checks/` measures it and the figure is given here with its source.

**Those JS figures run the rulebook, not the Python's simplifications**, which is a
markedly harsher game (`legacy` mode in `js/game/engine.js` exists precisely to reproduce
the Python for the parity test). Read them as deltas against their own baseline. **Do not
compare them to the 17.90% above.**

- **The Advantage deck.** Five drawn per run, all five playable, all of them meaningful. This is
  the big one. The JS engine models it; no harness in `tools/checks/` reports a run figure with it
  on, so nothing measured is quoted here yet.
- **Class passives.** All four are unmodelled by the Python, so classes are entirely
  untested against each other. The JS engine models them (`opts.klass`), but again no
  harness in `tools/checks/` reports per-class win rates. Asymmetric abilities need those before
  anyone claims they are balanced.
- **Bubble.** The Python builds its hand from Strike, Focus and All In and never sees it.
  The JS engine has it, and `tools/checks/bubble-effect.mjs` measures it at 4,000 fights
  per cell: the adaptive line moves **-0.7 to -2.5 points** with Bubble in the deck, and
  turtle and gamble do not move at all. That is the heuristic spending actions on a brake,
  not evidence the card is bad. It is the reason the card exists under Rage, which a win
  rate cannot show.
- **Run, and the Hidden state it sets.** Also absent from the Python. `tools/checks/run-card.mjs`
  at 8,000 fights per cell: the adaptive full run goes **5.32% without Run to 6.08% with
  it**, and adaptive stays the best line over a run either way. The Forest biome grants the
  same Hidden state, so the Python models neither.
- **Second Wind.** The gentle-mode card is absent from the Python entirely.
  `tools/checks/second-wind.mjs` at 4,000 fights per cell puts the full five-level adaptive
  run at **6.1% without it and 28.9% with it**, and it helps a reckless player most (level 3
  gamble moves +45.9 points), which is the point of a safety net.
- **Element and biome affinity.** The simulator accepts a `--bonus` flag but the table
  above runs at zero. A +25 or +50 run has not been characterised.
- **Aiming at minions.** The sim always hits the boss body, which understates the player
  slightly: clearing a minion stops its chip damage.
- **Brace beyond the simple halving.** Move needs no model: the rulebook gives it no
  mechanical effect (RULES.md section 5), so there is nothing to simulate.
- **A human being.** The adaptive strategy is a heuristic with perfect arithmetic and no
  nerve. Real players misjudge the guard line, and that is where the drama lives.

## Playtest checklist

The simulator cannot answer any of these. Log them in [PLAYTEST.md](PLAYTEST.md).

1. **How long does a fight actually take in minutes?** The sim says 3 to 4 rounds. If a
   round takes six minutes of arithmetic, the design is wrong regardless of the win rate.
2. **Does the guard line get *felt*?** The intended experience is looking at your Ready
   cards, wanting to bet one more, and not. If players do not experience that hesitation,
   the core mechanic is not landing.
3. **Is 17.9% too brutal?** Play six full runs. If nobody clears one, raise the Advantage
   draw, ship Second Wind by default, or soften levels 4 and 5.
4. **Do the cards read without the rulebook?** Show the corner pips to somebody who has
   never played. If they ask what any icon means, that icon is wrong
   ([CARD-LAYOUT.md](CARD-LAYOUT.md)).
5. **Does anyone actually cast All In?** It is the game's signature move, and it is priced
   at the floor of tier 0 rather than above its band. If players find it too frightening to
   ever use, its odds or its multiplier need work.
6. **Is level 4 the recklessness hole?** It is the one cell where gamble beats adaptive
   (60.6% against 59.5%). Watch whether a human finds that, or whether it is an artifact of
   a bot with perfect arithmetic.
7. **Which class do people pick twice?** That is the overpowered one.
