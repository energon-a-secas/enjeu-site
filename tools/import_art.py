#!/usr/bin/env python3
"""Bring one downloaded Noun Project SVG into art/ the way the tests require.

A raw download carries two things a printed card must not: a baked-in
"Created by X / from the Noun Project" credit drawn as <text>, and the extra
strip of viewBox it sits in. Printed, that credit lands across the face of the
card. tests/cards.test.mjs fails on both, so this does both, keeps the untouched
download in art/original/, and prints the creator it found so the manifest entry
is filled from the file rather than from memory.

    python3 tools/import_art.py ~/Downloads/noun_run_1651221_@700.svg run
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


def main() -> int:
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
