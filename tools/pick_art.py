#!/usr/bin/env python3
"""Choose Noun Project art for the expansion slots, and record the choice.

    python3 tools/pick_art.py            # show the picks, write nothing
    python3 tools/pick_art.py --write    # write them into data/art-manifest.json

WHAT THIS DOES AND DOES NOT DO, because the API has a hard limit worth stating
once rather than rediscovering:

  search      works on this key. `/v2/icon?query=` returns id, term, creator,
              licence and permalink.
  download    does NOT. `/v2/icon/{id}/download` answers 403 "You are not
              authorized to edit this icon" for every icon tried, for BOTH svg
              and png, and the single-icon endpoint exposes only a 200px PNG
              thumbnail. SVG download is a paid tier. Verified across 18 icons.

So this picks and attributes; a human still downloads the SVG from the permalink
and runs tools/import_art.py, which is the same path the existing 70 icons took.

It deliberately writes `source` and a `$pick` block but LEAVES creator AND
licence null, because js/cards/glyphs.js serves art/<id>.svg the moment those two
are filled, and tests/cards.test.mjs fails a slot that is attributed with no file
on disk. Until the file lands, the in-house glyph stays, which is exactly what
the swap contract in the manifest's own header describes.

CONSISTENCY. The existing art is one collection and mostly one hand: Maxicons
drew 34 of the 70 attributed slots. Results are ranked to prefer a creator the
deck already uses, so a new card looks like it came out of the same box.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from nounproject import search  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "data/art-manifest.json"

# slot id -> what to search for, and what the card has to READ as at 30mm.
# The query is not the slot name: "marked" returns marker pens, "prepare"
# returns checklists, and "parley" returns nothing useful at all.
WANTED = {
    # M1 Terrain: the six Marks
    "mark-poison": "poison",
    "mark-burning": "campfire flame",
    "mark-frozen": "snowflake",
    "mark-marked": "target crosshair",
    "mark-charged": "lightning bolt",
    "mark-snared": "net trap",
    # M1 Terrain: the eight Hazards
    "haz-tar-pit": "swamp",
    "haz-frozen-lake": "ice",
    "haz-thorn-nest": "thorn bush",
    "haz-ember-field": "embers",
    "haz-sulphur-vent": "volcano vent steam",
    "haz-bramble-wall": "bush",
    "haz-open-ground": "desert sun",
    "haz-cold-spring": "water spring",
    # M3 Wits
    "wits-scout": "spyglass lookout",
    "wits-analyze": "magnifying glass search",
    "wits-parley": "speech bubbles conversation",
    "wits-board": "dice",
    # M2 Preparation
    "prep-prepare": "coiled spring",
    "prop-brazier": "brazier fire bowl",
    "prop-pitch-barrel": "barrel",
    "prop-fishing-net": "fishing net",
    "prop-cart": "wooden cart",
    "prop-signal-bell": "bell",
    "prop-rope-bridge": "rope bridge",
    "prop-millstone": "millstone wheel",
    "prop-chandelier": "chandelier",
    # M6 The Boss Seat. `strike` is deliberately absent: faces 2 and 3 reuse the
    # base deck's own Strike art, because these cards ARE the die's table and
    # borrowing its vocabulary is the point.
    "seat-brace": "shield guard",
    "seat-summon": "split clone",
    "seat-roar": "roar shout",
    "seat-ruin": "impact crack",
    "seat-aid": "hand of cards",
}


def house_creators(slots: list[dict]) -> list[str]:
    """Creators the deck already uses, commonest first. This is the house style."""
    c = Counter(s["creator"] for s in slots if s.get("creator"))
    return [name for name, _ in c.most_common()]


def rank(icons: list[dict], house: list[str], want: str) -> list[dict]:
    """Prefer a hand the deck already uses, then a term that matches the ask."""
    words = set(want.lower().split())

    def score(i):
        creator = ((i.get("creator") or {}).get("name")) or ""
        house_rank = house.index(creator) if creator in house else len(house) + 5
        term = (i.get("term") or "").lower()
        tokens = set(term.replace("-", " ").split())
        overlap = len(words & tokens)
        # Term relevance FIRST, house style as the tie-breaker. Ranking the other
        # way round picked "Halloween" for poison and "Bucket Loader" for a tar
        # pit, purely because those two creators were already in the deck: a
        # wrong picture in the house style is still a wrong picture, and on this
        # deck the picture IS the name.
        return (-overlap, house_rank, len(term))

    return sorted(icons, key=score)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--write", action="store_true", help="write the picks into the manifest")
    ap.add_argument("--limit", type=int, default=20, help="results to consider per slot")
    ap.add_argument("--only", default=None, help="one slot id, for a single retry")
    ap.add_argument("--urls", action="store_true",
                    help="print the download list already recorded, without calling the API")
    args = ap.parse_args()

    manifest = json.loads(MANIFEST.read_text())
    slots = manifest["slots"]
    by_id = {s["id"]: s for s in slots}

    if args.urls:
        # No API calls: just read back what was already chosen. This is the list
        # a human works through, and the filenames come down carrying the icon
        # id, which is how `import_art.py --batch` matches them to their slots.
        pending = [x for x in slots if (x.get("$pick") or {}).get("source") and not x.get("creator")]
        print(f"{len(pending)} icons to download, then: python3 tools/import_art.py --batch ~/Downloads\n")
        for x in pending:
            pk = x["$pick"]
            print(f"  {x['id']:<20} {pk['source']}")
            print(f"  {'':<20} {pk.get('term','')} by {pk.get('creator','')}  ({pk.get('licence','')})")
        return 0
    house = house_creators(slots)
    print(f"house style: {', '.join(house[:4])} and {len(house) - 4} others\n")

    wanted = {args.only: WANTED[args.only]} if args.only else WANTED
    picks, missing = [], []
    for slot_id, query in wanted.items():
        try:
            found = search(query, args.limit)
        except SystemExit as e:
            print(f"  {slot_id:<20} search failed: {e}")
            missing.append(slot_id)
            continue
        if not found:
            print(f"  {slot_id:<20} nothing for {query!r}")
            missing.append(slot_id)
            continue
        best = rank(found, house, query)[0]
        creator = (best.get("creator") or {}).get("name") or "?"
        mark = "*" if creator in house else " "
        print(f" {mark}{slot_id:<20} {best.get('term','')[:26]:<26} by {creator[:22]:<22} {best.get('permalink','')}")
        picks.append((slot_id, best, query))

    if args.write:
        for slot_id, best, query in picks:
            row = by_id.get(slot_id)
            if row is None:
                row = {"id": slot_id, "use": query}
                slots.append(row)
                by_id[slot_id] = row
            # `source` stays NULL, and the chosen URL lives in $pick instead.
            # tools/credits.py treats a slot WITH a source and no creator as an
            # uncredited icon and refuses to write CREDITS.md, which is exactly
            # right for art that ships and exactly wrong for art that has only
            # been chosen. Nothing is distributed until the file lands, so
            # nothing is owed yet. Filling source here made `make check` fail
            # with 27 phantom credit gaps.
            row.setdefault("source", None)
            row.setdefault("creator", None)
            row.setdefault("licence", None)
            row["$pick"] = {
                "source": "https://thenounproject.com" + (best.get("permalink") or ""),
                "icon_id": best.get("id"),
                "term": best.get("term"),
                "creator": (best.get("creator") or {}).get("name"),
                "licence": best.get("license_description"),
                "attribution": best.get("attribution"),
                "$note": "Chosen through the API; the SVG still has to be downloaded by hand "
                         "(the key's plan refuses /icon/{id}/download) and imported with "
                         "tools/import_art.py, which fills creator and licence.",
            }
        MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
        print(f"\nwrote {len(picks)} picks into {MANIFEST.relative_to(ROOT)}")
    else:
        print("\n(dry run: pass --write to record these)")

    matched = sum(1 for _, b, _ in picks if ((b.get("creator") or {}).get("name")) in house)
    print(f"\n{len(picks)} picked, {matched} by a hand the deck already uses, {len(missing)} unresolved")
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
