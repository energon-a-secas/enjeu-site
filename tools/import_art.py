#!/usr/bin/env python3
"""Bring one downloaded Noun Project SVG into art/ the way the tests require.

A raw download carries two things a printed card must not: a baked-in
"Created by X / from the Noun Project" credit drawn as <text>, and the extra
strip of viewBox it sits in. Printed, that credit lands across the face of the
card. tests/cards.test.mjs fails on both, so this does both, keeps the untouched
download in art/original/, and prints the creator it found so the manifest entry
is filled from the file rather than from memory.

    python3 tools/import_art.py ~/Downloads/noun_run_1651221_@700.svg run

Or, once tools/pick_art.py has chosen the art, point it at the whole download
folder and let it match each file to its slot by the icon id in the filename:

    python3 tools/import_art.py --batch ~/Downloads

That form also fills creator and licence from the pick, which is the step that
actually makes the card stop drawing the in-house glyph.
"""
from __future__ import annotations

import re
import shutil
import sys
from pathlib import Path

CREDIT = re.compile(r"<text\b[^>]*>.*?</text>", re.S)


def crop(view_box: str) -> str:
    """Drop the credit strip: the download is 4:5, the art occupies the top square."""
    parts = [float(n) for n in view_box.replace(",", " ").split()]
    if len(parts) != 4:
        return view_box
    x, y, w, h = parts
    return f"{x:g} {y:g} {w:g} {w:g}" if h > w else view_box


def convert(svg: str) -> tuple[str, str | None]:
    """Strip the baked-in credit and crop the credit strip. Returns (svg, creator)."""
    creators = re.findall(r"<text[^>]*>Created by ([^<]+)</text>", svg)
    svg = CREDIT.sub("", svg)
    vb = re.search(r'viewBox="([^"]+)"', svg)
    if vb:
        svg = svg.replace(f'viewBox="{vb.group(1)}"', f'viewBox="{crop(vb.group(1))}"', 1)
    return svg, (creators[0] if creators else None)


def batch(folder: Path) -> int:
    """Match every SVG in a folder to a slot by the icon id in its filename.

    A Noun Project download is named with its numeric icon id, and pick_art.py
    recorded that id against each slot, so the two sides can be joined without
    the human renaming a single file.
    """
    import json
    manifest_path = Path("data/art-manifest.json")
    manifest = json.loads(manifest_path.read_text())
    by_icon = {}
    for slot in manifest["slots"]:
        pick = slot.get("$pick") or {}
        if pick.get("icon_id"):
            by_icon[str(pick["icon_id"])] = slot

    files = sorted(folder.expanduser().glob("*.svg"))
    if not files:
        print(f"no .svg files in {folder}", file=sys.stderr)
        return 2
    Path("art/original").mkdir(parents=True, exist_ok=True)
    done, skipped = 0, []
    for f in files:
        ids = re.findall(r"(\d{4,})", f.name)
        slot = next((by_icon[i] for i in ids if i in by_icon), None)
        if slot is None:
            skipped.append(f.name)
            continue
        svg, found = convert(f.read_text())
        assert "<text" not in svg, f"credit line survived the strip in {f.name}"
        shutil.copy2(f, Path("art/original") / f"{slot['id']}.svg")
        (Path("art") / f"{slot['id']}.svg").write_text(svg)
        pick = slot["$pick"]
        # Now the file is on disk, so the credit is owed and can be filled. This
        # is the moment the card stops drawing the in-house glyph.
        slot["source"] = pick.get("source")
        slot["creator"] = found or pick.get("creator")
        slot["licence"] = LICENCE_NAME.get(pick.get("licence"), pick.get("licence"))
        slot["title"] = pick.get("term")
        done += 1
        print(f"  {slot['id']:<20} <- {f.name[:46]:<46} by {slot['creator']}")
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"\nimported {done}, unmatched {len(skipped)}")
    for n in skipped[:8]:
        print(f"  no slot for {n}")
    print("\nNow run: make check   (credits.py will refuse if any credit is still blank)")
    return 0


# The API says `creative-commons-attribution`; CREDITS.md and the existing
# manifest rows say `CC BY 3.0`, which is what the licence URI table keys on.
LICENCE_NAME = {"creative-commons-attribution": "CC BY 3.0", "public-domain": "Public Domain"}


def main() -> int:
    if len(sys.argv) == 3 and sys.argv[1] == "--batch":
        return batch(Path(sys.argv[2]))
    if len(sys.argv) != 3:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    src, slot = Path(sys.argv[1]).expanduser(), sys.argv[2]
    if not src.exists():
        print(f"no such file: {src}", file=sys.stderr)
        return 2
    svg = src.read_text()

    creators = re.findall(r"<text[^>]*>Created by ([^<]+)</text>", svg)
    if creators:
        print(f"creator: {creators[0]}")
    else:
        print("WARNING: no 'Created by' line found. Fill the manifest by hand.", file=sys.stderr)

    Path("art/original").mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, Path("art/original") / f"{slot}.svg")

    svg = CREDIT.sub("", svg)
    vb = re.search(r'viewBox="([^"]+)"', svg)
    if vb:
        svg = svg.replace(f'viewBox="{vb.group(1)}"', f'viewBox="{crop(vb.group(1))}"', 1)
    out = Path("art") / f"{slot}.svg"
    out.write_text(svg)

    assert "<text" not in svg, "credit line survived the strip"
    print(f"wrote {out} ({out.stat().st_size // 1024} KB), original kept at art/original/{slot}.svg")
    print("Now add the slot to data/art-manifest.json with creator AND licence, "
          "or the card keeps drawing the in-house glyph.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
