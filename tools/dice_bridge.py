#!/usr/bin/env python3
"""
Stake - dice bridge.

Answers the question the rulebook has to answer honestly: "I don't own a
d20. What do I throw instead?"

You cannot reproduce a flat d20 with d6s. But you do not need the same
distribution - you need the same *probability*. So the four difficulty
steps were picked because every common die has a target number landing
close to them, and this script prints how close.

    python3 tools/dice_bridge.py

The table in docs/DICE-BRIDGE.md is this script's output, pasted. Re-run it
after changing any step and paste again; do not hand-edit the table.
"""

from __future__ import annotations

from fractions import Fraction
from itertools import product

# The four steps of the ladder, as target probabilities.
STEPS = [("Sure", 0.75), ("Even", 0.50), ("Hard", 0.25), ("Wild", 0.15)]

POOLS: list[tuple[str, list[int]]] = [
    ("d20", [1]),
    ("d12", [1]),
    ("d10", [1]),
    ("d8", [1]),
    ("d6", [1]),
    ("d4", [1]),
    ("2d6", [2]),
    ("3d6", [3]),
]
SIDES = {"d20": 20, "d12": 12, "d10": 10, "d8": 8, "d6": 6, "d4": 4,
         "2d6": 6, "3d6": 6}
COUNT = {"d20": 1, "d12": 1, "d10": 1, "d8": 1, "d6": 1, "d4": 1,
         "2d6": 2, "3d6": 3}


def distribution(sides: int, count: int) -> dict[int, Fraction]:
    """Exact probability of each total. Fractions, so no float drift."""
    out: dict[int, Fraction] = {}
    total = Fraction(1, sides ** count)
    for roll in product(range(1, sides + 1), repeat=count):
        out[sum(roll)] = out.get(sum(roll), Fraction(0)) + total
    return out


def at_least(dist: dict[int, Fraction], target: int) -> Fraction:
    return sum((p for v, p in dist.items() if v >= target), Fraction(0))


def best_target(dist: dict[int, Fraction], want: float) -> tuple[int, float]:
    """The target number whose real odds sit closest to `want`.

    Compared as exact Fractions, and ties break toward the LOWER target -
    the more generous one. Both matter: on 2d6 the 50% step sits exactly
    between 7+ (58.3%) and 8+ (41.7%), and comparing as floats handed the
    tie to 8+ on rounding noise alone. Two d6 is the most common fallback
    anyone owns, so that silently made the usual no-d20 table harder.
    """
    lo, hi = min(dist), max(dist)
    target = Fraction(want).limit_denominator(1000)
    best = min(range(lo, hi + 1), key=lambda t: (abs(at_least(dist, t) - target), t))
    return best, float(at_least(dist, best))


def main() -> None:
    dists = {name: distribution(SIDES[name], COUNT[name]) for name, _ in POOLS}

    width = 13
    header = "die".ljust(6) + "".join(f"{n} {int(p*100)}%".center(width)
                                      for n, p in STEPS)
    print(header)
    print("-" * len(header))

    drift: dict[str, float] = {}
    for name, _ in POOLS:
        row, worst = name.ljust(6), 0.0
        for _, want in STEPS:
            target, real = best_target(dists[name], want)
            worst = max(worst, abs(real - want))
            row += f"{target}+  ({real*100:.0f}%)".center(width)
        drift[name] = worst
        print(row)

    print("\nfidelity - worst gap between a step's stated odds and this "
          "die's real odds:")
    for name, gap in sorted(drift.items(), key=lambda kv: kv[1]):
        verdict = ("exact" if gap < 0.005 else
                   "faithful" if gap <= 0.02 else
                   "playable" if gap <= 0.06 else "coarse")
        print(f"  {name:<5} {gap*100:>5.1f} points   {verdict}")

    print("\nReading it: find your row, roll that die, meet or beat the number.")

    # The difficulty dial. Swapping dice is a weak lever - at most 10 points,
    # and not adjustable. Rolling twice is the strong one, and it needs no
    # second table: it works off whatever row you are already using.
    print("\ndifficulty dial - roll your die twice, keep the better/worse:")
    print("  step        normal    advantage   disadvantage")
    for name, p in STEPS:
        adv, dis = 1 - (1 - p) ** 2, p ** 2
        print(f"  {name:<10}{p*100:>6.0f}%{adv*100:>11.0f}%{dis*100:>14.0f}%")
    print("\n  At Even, advantage lands exactly on Sure and disadvantage")
    print("  exactly on Hard - one rung each way, no rounding. That is why")
    print("  the ladder is spaced 75/50/25 rather than evenly.")


if __name__ == "__main__":
    main()
