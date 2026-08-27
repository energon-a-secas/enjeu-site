# Balance

Every number in the rulebook comes out of `tools/sim.py`. This file records what was
measured, what it means, and (the part that matters most at this stage) what has **not**
been measured and could still be wrong.

Reproduce with:

```bash
python3 tools/sim.py --trials 20000
```

## The measured table

20,000 simulated fights per cell, seed 7, no affinity bonus (the pessimistic case: a
player who never gets a favourable matchup). `rounds` and `broken` are averages;
`broken` counts life cards permanently lost, out of a pool of 4 at level 1 rising to 8 at
level 5.

| Level | turtle | safe | **adaptive** | gamble | adaptive rounds | adaptive broken |
|---|---|---|---|---|---|---|
| 1 | 53.2% | 87.9% | **90.8%** | 67.4% | 3.1 | 1.0 |
| 2 | 4.3% | 78.7% | **84.1%** | 55.2% | 3.3 | 1.4 |
| 3 | 0.0% | 52.9% | **64.6%** | 55.4% | 3.3 | 2.6 |
| 4 | 0.0% | 42.6% | **59.5%** | 60.6% | 3.3 | 3.3 |
| 5 | 0.0% | 45.1% | **61.0%** | 44.6% | 3.9 | 3.8 |

The four styles are stand-ins for how a person plays:

- **turtle**: never bets. Strike ×3, every round, forever.
- **safe**: bets only down to the cards needed to guard a nominal boss hit.
- **adaptive**: plays safe, but takes a kill shot when it is likely, or when Rage is about
  to make the fight unsurvivable anyway.
- **gamble**: bets everything, every round.

### Re-measured 2026-08-27: All In retuned, twice

The first human playtest reported All In as not worth casting, and the arithmetic
agreed. At 3x the bet it returned 38 expected damage per life card against Focus's
56, for twice the actions: dominated at every bet size, so a rational player never
touched the card the game is named after.

It went to 6x, which fixed it and overshot, and then to **4x**, which is what
ships. 4x was the player's call and it is the better number for two reasons. The
arithmetic is a child's: **100 damage per card bet**, so 1, 2, 3, 4 cards read as
100, 200, 300, 400 with nothing to work out. And it still solves the original
problem, because All In is judged by the turn, not the card: All In on 4 cards
plus a Strike is 225 expected against 169 for three Focuses. At 6x that same turn
was 325, which made every other attack card decorative.

What that bought, measured at 20,000 fights per cell:

- **Fights got shorter.** Adaptive drops from 3.1 to 2.6 rounds at level 1 and
  3.3 to 2.9 at level 2. The signature move now does what it was for: end a boss
  a round early.
- **You finish less scarred** at the levels where it matters: broken cards fall
  1.1 to 0.8 at level 1, 1.5 to 1.2 at level 2.
- **The skill ordering survives.** Adaptive still beats safe at every level and
  gamble everywhere, which is the property this whole table exists to protect.
- **Gambling got much better at low levels** (level 2 gamble 48% to 65%), because
  betting everything is exactly what All In now rewards. Watch this in playtest:
  it is the one direction that could tip into recklessness-always-wins.
- **Safe play got worse** at levels 1 and 2 (89% to 83%, 78% to 71%). That is the
  *bot*, not the game: `choose()` maximises expected damage, and All In now wins
  that comparison while carrying a coin flip, so the safe line takes more variance
  than its name suggests. A human playing safe would decline it.

One rule this bends knowingly: All In now returns 75 expected damage per life
card, which is tier 1's efficiency band, on a tier 0 card available from the first
turn. It pays for that with 2 of your 3 actions and a 50% chance of nothing.
`lint_cards.py` does not catch it either way, because a variable bet has no fixed
per-card number to test.

### What the table says

**Skill is rewarded.** Adaptive is the best line at every level. That is the single most
important property here and it was not true in the first pass.

**Playing safe stops working.** The safe line holds up through level 2 (79%) and then falls
off a cliff at level 3 (53%) and level 4 (43%). From the midpoint of the campaign the game
stops letting you win by hoarding: you have to bet. That is the arc the design is for.

**Turtling is fatal.** 53% at level 1, 4% at level 2, zero after that. The Rage rule does
its job: a player who never bets runs out of clock long before the boss runs out of life.

**Gambling is not a strategy, it is a tool.** Pure gambling underperforms adaptive
everywhere. At level 4 it comes within a point (60.7% vs 61.4%), which is the one place
the game genuinely rewards recklessness: worth watching in playtest rather than
"fixing" preemptively.

**Fights are 3–4 rounds**, and the final fight is the longest (3.9). About 9–12 decisions
per boss.

**You finish scarred.** Broken cards climb 1.1 → 3.8 across the campaign. By the last
level you are routinely ending fights on half your pool.

### Run completion

Multiplying the adaptive column: **a full five-level run completes about 19% of the time.**

That is roguelike territory, and it is probably too harsh for the audience this is aimed
at. Two things to know before reacting to it:

- The sim **does not model the Advantage deck**, and the player draws six of them over a
  run. Cure, Barrier, Rune and Relic are all substantial. The 19% is a floor, not an
  estimate.
- Broken cards fully reset between levels, so the run is five independent fights. There is
  no attrition spiral across levels.

Modelling Advantage cards is the first thing to do to this simulator, and until that
happens the run-completion figure should not be quoted as the real one.

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
shiny new meteor was worse per card than the thing you already had. The tuned ladder:

| | bet | damage | check | expected | per card |
|---|---|---|---|---|---|
| Strike | 0 | 25 | none | 25 | none |
| Focus | 1 | 75 | Sure | 56 | 56 |
| Tier 1 | 1 | 100 | Sure | 75 | 75 |
| Tier 2 | 2 | 225 | Sure | 169 | 84 |
| Tier 3 | 2 | 400 | Even | 200 | 100 |
| Tier 4 | 3 | 750 | Even | 375 | 125 |

**Any new card must fit that ladder.** Take its expected damage (damage × hit chance),
divide by the cards it bets, and check the result sits between its neighbours. A card that
beats 125 per life card is stronger than a Tier 4 meteor regardless of what its picture says.

**Boss Damage sets the betting budget.** The cards you may safely bet equal your pool minus
the cards needed to guard one nominal hit. Boss Damage is chosen so that budget grows
2 → 4 across the campaign. Holding it flat (the first attempt) made every level-up
cosmetic, because the extra life card went straight into guarding the bigger hit.

**The ladder is spaced 75/50/25, not evenly.** At the 50% step, rolling twice and keeping
the better result gives exactly 75%, and keeping the worse gives exactly 25%: advantage
and disadvantage move you exactly one rung with no second table and no rounding. See
[DICE-BRIDGE.md](DICE-BRIDGE.md).

## Two defects the spec had

Recorded because both were invisible until the numbers were run, and both would have
shipped.

**The special attack was worse than the free one.** As specified, 50 damage on d20 ≥ 15,
it returns 30% × 50 = 15 expected damage, against a basic attack dealing 25 guaranteed for
no life at all. Nobody would ever have used it. Retuned to 75 damage at the Sure step.

**Turtling was immortal.** Under full regeneration, a player who never bets always has a
full pool to guard with, and guarding costs nothing permanent. The first model had no way
to kill such a player at all. Rage (double damage that ignores guards) is the answer, and
the sim confirms it works.

## What this simulator does not model

Read this before trusting any number above.

- **The Advantage deck.** Six cards per run, all of them meaningful. This is the big one.
- **Class passives.** All four are unmodelled, so classes are entirely untested against
  each other. Asymmetric abilities need per-class win rates before anyone claims they are
  balanced.
- **Element and biome affinity.** The simulator accepts a `--bonus` flag but the table
  above runs at zero. A +25 or +50 run has not been characterised.
- **Aiming at minions.** The sim always hits the boss body, which understates the player
  slightly: clearing a minion stops its chip damage.
- **Hide, Move, and Brace interactions** beyond the simple halving.
- **A human being.** The adaptive strategy is a heuristic with perfect arithmetic and no
  nerve. Real players misjudge the guard line, and that is where the drama lives.

## Playtest checklist

The simulator cannot answer any of these. Log them in [PLAYTEST.md](PLAYTEST.md).

1. **How long does a fight actually take in minutes?** The sim says 3–4 rounds. If a round
   takes six minutes of arithmetic, the design is wrong regardless of the win rate.
2. **Does the guard line get *felt*?** The intended experience is looking at your Ready
   cards, wanting to bet one more, and not. If players do not experience that hesitation,
   the core mechanic is not landing.
3. **Is 19% too brutal?** Play six full runs. If nobody clears one, raise the Advantage
   draw or soften levels 4–5.
4. **Do the cards read without the rulebook?** Show the corner pips to somebody who has
   never played. If they ask what any icon means, that icon is wrong
   ([CARD-LAYOUT.md](CARD-LAYOUT.md)).
5. **Does anyone actually cast All In?** It is the game's signature move. If players find it
   too frightening to ever use, its odds or its multiplier need work.
6. **Which class do people pick twice?** That is the overpowered one.
