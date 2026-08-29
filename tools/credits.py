#!/usr/bin/env python3
"""
Enjeu - attribution page generator.

Reads data/art-manifest.json and writes CREDITS.md.

It REFUSES to write while any slot that has art is missing its creator or
licence. That refusal is the point of the script. Enjeu's art comes from
The Noun Project, where the free tier is CC BY and attribution is a
condition of use, not a courtesy - so a printable pack that ships with a
half-filled credits page is the one failure here with a legal edge on it.

    python3 tools/credits.py            # writes CREDITS.md, or refuses
    python3 tools/credits.py --check    # refuse-only, writes nothing
    python3 tools/credits.py --selftest # prove the refusal actually fires

Exit codes: 0 wrote (or would write), 1 refused, 2 manifest unreadable.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "data" / "art-manifest.json"
OUTPUT = ROOT / "CREDITS.md"


def load(path: Path) -> dict:
    try:
        return json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        print(f"cannot read manifest: {exc}", file=sys.stderr)
        raise SystemExit(2)


def audit(manifest: dict) -> tuple[list[dict], list[dict], list[dict]]:
    """Split slots into (ready, incomplete, gaps)."""
    ready, incomplete, gaps = [], [], []
    for slot in manifest.get("slots", []):
        if not slot.get("source"):
            gaps.append(slot)
        elif slot.get("creator") and slot.get("licence"):
            ready.append(slot)
        else:
            incomplete.append(slot)
    return ready, incomplete, gaps


def render(manifest: dict, ready: list[dict]) -> str:
    lines = [
        "# Credits",
        "",
        "Enjeu's card art comes from The Noun Project. Every icon below is used",
        "under the licence named against it. This page is generated from",
        "`data/art-manifest.json` by `tools/credits.py` - edit the manifest,",
        "not this file.",
        "",
        f"Collection: {manifest.get('collection', 'n/a')}",
        "",
        "| Icon | Used for | Creator | Licence |",
        "|---|---|---|---|",
    ]
    for slot in sorted(ready, key=lambda s: s["id"]):
        lines.append(
            f"| [`{slot['id']}`]({slot['source']}) | {slot['use']} "
            f"| {slot['creator']} | {slot['licence']} |"
        )
    lines += ["", f"{len(ready)} icons.", ""]
    return "\n".join(lines)


def report(ready: list, incomplete: list, gaps: list) -> None:
    print(f"  {len(ready):>3} complete")
    print(f"  {len(incomplete):>3} missing creator or licence")
    print(f"  {len(gaps):>3} slots with no art chosen yet")


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate CREDITS.md")
    ap.add_argument("--check", action="store_true", help="verify only, write nothing")
    ap.add_argument("--selftest", action="store_true",
                    help="prove the refusal fires on incomplete data")
    args = ap.parse_args()

    if args.selftest:
        raise SystemExit(selftest())

    manifest = load(MANIFEST)
    ready, incomplete, gaps = audit(manifest)
    report(ready, incomplete, gaps)

    if incomplete:
        print("\nREFUSING to write CREDITS.md. These slots have art but no "
              "attribution:", file=sys.stderr)
        for slot in incomplete:
            missing = [f for f in ("creator", "licence") if not slot.get(f)]
            print(f"  {slot['id']:<20} missing {', '.join(missing)}", file=sys.stderr)
        print("\nFill them in from each icon's own Noun Project page as you "
              "download it.", file=sys.stderr)
        raise SystemExit(1)

    if not ready:
        print("\nREFUSING to write an empty CREDITS.md.", file=sys.stderr)
        raise SystemExit(1)

    if args.check:
        print("\nwould write CREDITS.md")
        raise SystemExit(0)

    OUTPUT.write_text(render(manifest, ready))
    print(f"\nwrote {OUTPUT.relative_to(ROOT)} ({len(ready)} icons)")


def selftest() -> int:
    """Trip every refusal on purpose. A guard nobody has seen fail is not a guard."""
    cases = [
        ("art present, creator missing",
         {"slots": [{"id": "x", "use": "u", "source": "http://e", "licence": "CC BY"}]},
         True),
        ("art present, licence missing",
         {"slots": [{"id": "x", "use": "u", "source": "http://e", "creator": "A"}]},
         True),
        ("nothing sourced at all",
         {"slots": [{"id": "x", "use": "u", "source": None}]},
         True),
        ("fully attributed",
         {"slots": [{"id": "x", "use": "u", "source": "http://e",
                     "creator": "A", "licence": "CC BY 3.0"}]},
         False),
    ]
    failures = 0
    for name, manifest, should_refuse in cases:
        ready, incomplete, _ = audit(manifest)
        refused = bool(incomplete) or not ready
        ok = refused == should_refuse
        failures += not ok
        verb = "refused" if refused else "allowed"
        print(f"  [{'PASS' if ok else 'FAIL'}] {name:<32} -> {verb}")

    # The real manifest must pass today. It refused until 2026-08-28, when the
    # last creator and licence were filled in (66 credited, 9 in-house on
    # purpose); a regression that blanks a credit must flip this back to FAIL.
    ready, incomplete, gaps = audit(load(MANIFEST))
    live_ok = ready and not incomplete
    failures += not live_ok
    print(f"  [{'PASS' if live_ok else 'FAIL'}] "
          f"{'shipped manifest fully credited':<32} -> "
          f"{'allowed' if live_ok else 'refused'} "
          f"({len(incomplete)} incomplete, {len(gaps)} gaps)")

    print(f"\n{5 - failures}/5 passed")
    return 1 if failures else 0


if __name__ == "__main__":
    main()
