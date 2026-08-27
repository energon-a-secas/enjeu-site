#!/usr/bin/env python3
"""
Enjeu - card data linter.

Checks data/cards.json against the balance rules in docs/BALANCE.md, so that
"a new card must fit the ladder" is a thing the repo enforces rather than a
thing a document asks for politely.

    python3 tools/lint_cards.py
    python3 tools/lint_cards.py --selftest   # prove each check can fail

Exit codes: 0 clean, 1 violations found, 2 data unreadable.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CARDS = ROOT / "data" / "cards.json"
ART = ROOT / "data" / "art-manifest.json"
UNIT = 25


def load(path: Path) -> dict:
    try:
        return json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        print(f"cannot read {path.name}: {exc}", file=sys.stderr)
        raise SystemExit(2)


def check_multiples(data: dict) -> list[str]:
    """Every printed value is a multiple of 25, so damage is payable in cards."""
    bad = []
    for deck in ("attack", "skill"):
        for c in data.get(deck, []):
            d = c.get("damage")
            if isinstance(d, int) and d % UNIT:
                bad.append(f"{c['id']}: damage {d} is not a multiple of {UNIT}")
    for b in data.get("boss", []):
        for field in ("per_card", "hp", "damage"):
            v = b.get(field)
            if isinstance(v, int) and v % UNIT:
                bad.append(f"{b['id']}: {field} {v} is not a multiple of {UNIT}")
    return bad


def check_ladder(data: dict) -> list[str]:
    """Expected damage per life card bet must rise with tier, inside its band.

    This is the check that catches the defect the first balance pass shipped:
    a Tier 1 card that was more card-efficient than a Tier 4 meteor, which
    quietly made every level-up a downgrade.
    """
    ladder = data["ladder"]
    bands = {int(k): v for k, v in data["efficiency_bands"].items()
             if k.isdigit()}
    bad = []
    for deck in ("attack", "skill"):
        for c in data.get(deck, []):
            bet, dmg = c.get("bet"), c.get("damage")
            if not isinstance(bet, int) or bet == 0 or not isinstance(dmg, int):
                continue  # Strike bets nothing; All In bets a variable amount
            hit = ladder.get(c["check"], 1.0) if c.get("check") else 1.0
            per_card = dmg * hit / bet
            lo, hi = bands[c["tier"]]
            if not lo <= per_card <= hi:
                bad.append(
                    f"{c['id']}: {per_card:.1f} damage per life card is outside "
                    f"tier {c['tier']}'s band {lo}-{hi}")
    return bad


def check_bands_rise(data: dict) -> list[str]:
    """The bands themselves must not overlap or invert."""
    bands = sorted((int(k), v) for k, v in data["efficiency_bands"].items()
                   if k.isdigit())
    bad = []
    for (t1, (lo1, hi1)), (t2, (lo2, hi2)) in zip(bands, bands[1:]):
        if lo2 <= hi1:
            bad.append(f"tier {t2}'s band starts at {lo2}, at or below "
                       f"tier {t1}'s ceiling of {hi1}")
    return bad


def check_icons(data: dict, art: dict) -> list[str]:
    """Every icon a card asks for must exist as a slot in the art manifest."""
    slots = {s["id"] for s in art.get("slots", [])}
    bad = []
    for deck, items in data.items():
        if not isinstance(items, list):
            continue
        for c in items:
            icon = isinstance(c, dict) and c.get("icon")
            if icon and icon not in slots:
                bad.append(f"{c['id']}: icon '{icon}' has no slot in the art manifest")
    return bad


def check_classes(data: dict) -> list[str]:
    """A class-locked card must name a class that exists."""
    known = {c["id"] for c in data.get("class", [])}
    return [f"{c['id']}: locked to unknown class '{c['class']}'"
            for c in data.get("skill", [])
            if c.get("class") and c["class"] not in known]


def count(data: dict) -> tuple[int, list[str]]:
    """Physical card count, matching the component table in RULES.md."""
    lines, total = [], 0
    for deck in ("attack", "skill", "class", "advantage", "boss", "biome",
                 "life", "aid"):
        n = sum(c.get("copies", 1) for c in data.get(deck, []))
        lines.append(f"  {deck:<12}{n:>4}")
        total += n
    return total, lines


CHECKS = [
    ("values are multiples of 25", check_multiples),
    ("cards sit inside their tier's efficiency band", check_ladder),
    ("efficiency bands rise without overlapping", check_bands_rise),
    ("class locks name a real class", check_classes),
]


def main() -> None:
    ap = argparse.ArgumentParser(description="Lint Enjeu card data")
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()
    if args.selftest:
        raise SystemExit(selftest())

    data, art = load(CARDS), load(ART)
    problems = []
    for label, fn in CHECKS:
        found = fn(data)
        print(f"  [{'FAIL' if found else 'ok'}] {label}")
        problems += found
    found = check_icons(data, art)
    print(f"  [{'FAIL' if found else 'ok'}] icons resolve to art-manifest slots")
    problems += found

    total, lines = count(data)
    print(f"\ncard count:")
    print("\n".join(lines))
    print(f"  {'TOTAL':<12}{total:>4}")

    if problems:
        print(f"\n{len(problems)} problem(s):", file=sys.stderr)
        for p in problems:
            print(f"  {p}", file=sys.stderr)
        raise SystemExit(1)
    print("\nclean")


def selftest() -> int:
    """Break each rule on purpose and confirm the matching check notices."""
    ladder = {"sure": 0.75, "even": 0.5}
    bands = {"0": [50, 65], "1": [66, 80], "2": [81, 92]}
    cases = [
        ("damage not a multiple of 25", check_multiples,
         {"attack": [{"id": "x", "damage": 70}], "skill": [], "boss": []}),
        ("card too efficient for its tier", check_ladder,
         {"ladder": ladder, "efficiency_bands": bands, "attack": [],
          "skill": [{"id": "x", "tier": 0, "bet": 1, "damage": 400, "check": "sure"}]}),
        ("card too weak for its tier", check_ladder,
         {"ladder": ladder, "efficiency_bands": bands, "attack": [],
          "skill": [{"id": "x", "tier": 2, "bet": 1, "damage": 25, "check": "sure"}]}),
        ("bands overlap", check_bands_rise,
         {"efficiency_bands": {"0": [50, 80], "1": [66, 90]}}),
        ("lock names a class that does not exist", check_classes,
         {"class": [{"id": "mage"}], "skill": [{"id": "x", "class": "druid"}]}),
    ]
    failures = 0
    for name, fn, broken in cases:
        caught = bool(fn(broken))
        failures += not caught
        print(f"  [{'PASS' if caught else 'FAIL'}] {name:<38} -> "
              f"{'caught' if caught else 'MISSED'}")

    # And the shipped data must be clean, or the checks are calibrated wrong.
    data = load(CARDS)
    clean = not any(fn(data) for _, fn in CHECKS)
    failures += not clean
    print(f"  [{'PASS' if clean else 'FAIL'}] {'shipped card data passes':<38} -> "
          f"{'clean' if clean else 'VIOLATIONS'}")
    print(f"\n{6 - failures}/6 passed")
    return 1 if failures else 0


if __name__ == "__main__":
    main()
