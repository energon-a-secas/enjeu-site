# The Dice Bridge

> *"I don't have a d20. How many d6 do I throw?"*

**Three.** But the real answer is more useful than that, so here is the whole thing.

## The problem

You cannot reproduce a flat d20 with d6s. Three d6 give you a bell curve (10 and 11 come
up far more often than 3 or 18), and no amount of arithmetic turns that into a flat
distribution.

But you do not need the same *distribution*. You need the same *probability*. A check only
ever asks one question: did you make it or not. So the fix is to pick the difficulty steps
first, choosing values that every common die can hit closely, and then print a target
number per die.

That is what this is. Four steps, eight dice, one table.

## The ladder

| Step | Odds | d20 | d12 | d10 | d8 | d6 | d4 | 2d6 | 3d6 |
|---|---|---|---|---|---|---|---|---|---|
| ● **Sure** | 75% | 6+ | 4+ | 3+ | 3+ | 2+ | 2+ | 6+ | 9+ |
| ●● **Even** | 50% | 11+ | 7+ | 6+ | 5+ | 4+ | 3+ | 7+ | 11+ |
| ●●● **Hard** | 25% | 16+ | 10+ | 8+ | 7+ | 5+ | 4+ | 9+ | 13+ |
| ●●●● **Wild** | 15% | 18+ | 11+ | 9+ | 8+ | 6+ | 4+ | 10+ | 14+ |

Find your row. Roll. Meet or beat the number.

This table is generated, not typed. Regenerate it with:

```bash
python3 tools/dice_bridge.py
```

## How faithful is each die?

The worst gap between a step's stated odds and what your die actually delivers:

| Die | Worst gap | |
|---|---|---|
| **d20** | 0.0 points | exact |
| **3d6** | 1.2 points | faithful |
| **d12** | 1.7 points | faithful |
| **d8** | 2.5 points | playable |
| **d10** | 5.0 points | playable |
| **d6** | 8.3 points | coarse |
| **2d6** | 8.3 points | coarse |
| **d4** | 10.0 points | coarse |

**Three d6 is the closest substitute for a d20 in the game**, within 1.2 points at every
step, and exactly 50% at the Even step, because 3d6 ≥ 11 is 108 of 216 outcomes. That is not
a coincidence anyone arranged; it is why the ladder was built around 50% in the first place.

**One d6 works.** It is coarse (Sure comes out at 83% instead of 75%, Hard at 33% instead
of 25%), but every error runs *in your favour*. If a d6 is all you have, play with it. The
game is slightly kinder and nothing breaks.

**A d4 has no Wild step.** Hard and Wild are both `4+`. If you are playing on a d4, treat
the two hardest steps as identical.

## Tuning the difficulty

Swapping dice is a **weak** lever: at most 10 points, and not adjustable. Here are the two
real ones.

### Advantage and disadvantage

Roll your die **twice** and keep the better result (advantage) or the worse (disadvantage).
This works off whatever row you are already using. No second table.

| Step | Normal | Advantage | Disadvantage |
|---|---|---|---|
| ● Sure | 75% | 94% | 56% |
| ●● Even | 50% | **75%** | **25%** |
| ●●● Hard | 25% | 44% | 6% |
| ●●●● Wild | 15% | 28% | 2% |

At the Even step, advantage lands **exactly** on Sure and disadvantage **exactly** on Hard,
one rung each way, no rounding. That is why the ladder is spaced 75/50/25 rather than
evenly, and it is the reason "roll twice" needs no explanation at the table.

### The mode dial

Shift every check one rung for the whole game:

- **Story**: one rung easier. Sure becomes automatic, Even becomes Sure, Hard becomes
  Even, Wild becomes Hard. For younger players, or a first run.
- **Standard**: the table as printed.
- **Nightmare**: one rung harder. Sure becomes Even, Even becomes Hard, Hard becomes Wild,
  Wild stays Wild.

If you own more dice than a d6, this is what to spend them on: keep the ladder, roll two
of whatever you have, and dial the run to the table.

## Why four steps

Four is enough to separate "probably", "coin flip", "unlikely" and "desperate", and few
enough that the whole ladder fits on one player aid card in pips: ● ●● ●●● ●●●●.

A fifth step would need a fifth target per die, and the dice start disagreeing. The gaps
in the fidelity table above are already at 10 points on a d4. Four is where the arithmetic
stays honest.
