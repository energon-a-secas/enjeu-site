# Stake

A printable, open-source boss-rush card game for **one player**, a **single die**, and
whatever construction-toy figures and bricks you already own.

You build the boss out of bricks. The cards handle the damage. You handle the story.

> Not affiliated with, endorsed by, or connected to the LEGO Group. Stake works with any
> construction toy — it ships no figures and never names a brand on a card.

---

## The idea

**Your life is your ammunition and your armour.**

You bet life cards to attack, and they come back at the start of your next turn. So betting
costs you nothing — right up until the boss swings and you have nothing Ready left to guard
with. Then those cards break for good.

That single asymmetry is the entire game. Every turn asks the same question: *how much do I
dare spend, knowing I have to survive what comes next?*

There is no way to win by playing it safe. From the boss's **Rage** round onward its damage
doubles and ignores your guard, so hoarding just changes how you lose. The simulator puts
a pure defensive line at **53% at level 1 and 0% from level 3 onward**.

## Start here

| | |
|---|---|
| **[RULES.md](RULES.md)** | The rulebook. Complete, ~10 minutes to read. |
| **[docs/DICE-BRIDGE.md](docs/DICE-BRIDGE.md)** | *"I don't have a d20 — what do I throw?"* Three d6. Here is why, and every other die. |
| **[docs/BALANCE.md](docs/BALANCE.md)** | What was measured, and what has not been. |
| **[docs/CARD-LAYOUT.md](docs/CARD-LAYOUT.md)** | The four-corner grammar. No body text on any card. |
| **[data/cards.json](data/cards.json)** | All 90 cards as data. |

## Any die you own

The four difficulty steps were chosen so every common die lands close to them. Pick your
row, roll, meet or beat:

| Step | Odds | d20 | d12 | d10 | d8 | d6 | d4 | 2d6 | 3d6 |
|---|---|---|---|---|---|---|---|---|---|
| ● Sure | 75% | 6+ | 4+ | 3+ | 3+ | 2+ | 2+ | 6+ | 9+ |
| ●● Even | 50% | 11+ | 7+ | 6+ | 5+ | 4+ | 3+ | 7+ | 11+ |
| ●●● Hard | 25% | 16+ | 10+ | 8+ | 7+ | 5+ | 4+ | 9+ | 13+ |
| ●●●● Wild | 15% | 18+ | 11+ | 9+ | 8+ | 6+ | 4+ | 10+ | 14+ |

**Three d6 tracks a d20 within 1.2 percentage points at every step.** One lone d6 works
too, and errs in your favour. Own more dice? They are not the difficulty lever — rolling
*twice* is. At the Even step, keeping the better roll lands exactly on Sure and the worse
exactly on Hard, which is why the ladder is spaced 75/50/25 rather than evenly.

## Tools

Everything is standard-library Python 3. No install, no dependencies.

```bash
python3 tools/sim.py              # balance simulator - the source of every number
python3 tools/dice_bridge.py      # regenerate the dice table
python3 tools/lint_cards.py       # check card data against the balance ladder
python3 tools/credits.py          # build the art attribution page
```

Each of the three checkers has a `--selftest` that breaks its own rules on purpose and
confirms it notices. A check nobody has watched fail is not a check.

## Status

**Baseline. Never played by a human.**

The numbers come from 20,000 simulated fights per level, which is enough to say the
*shape* is right — skilled play beats safe play beats turtling, fights land at 3–4 rounds,
the difficulty curve descends — and not nearly enough to say the game is fun. The
simulator does not model the Advantage deck, the class passives, or a person's nerve.

[docs/BALANCE.md](docs/BALANCE.md) lists what is untested.
[docs/PLAYTEST.md](docs/PLAYTEST.md) is where the first real session goes.

## Licence

Two halves, because they cannot be one:

| What | Licence |
|---|---|
| Rules, card data, tools, all text | **MIT** — see [LICENSE](LICENSE) |
| Card art in `art/` | per **[CREDITS.md](CREDITS.md)** — CC BY unless a slot says otherwise |

The art is sourced from The Noun Project, where the free tier requires attribution as a
condition of use. **If you fork or redistribute this, the credits page goes with it.**
`tools/credits.py` refuses to generate that page while any icon is missing its creator, so
an incomplete one cannot ship by accident. Details and the alternative that was considered:
[docs/ART.md](docs/ART.md).
