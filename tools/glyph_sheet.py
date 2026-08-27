#!/usr/bin/env python3
"""
Enjeu - glyph contact sheet.

docs/CARD-LAYOUT.md sets an icon test that cannot be run by reading code:
"show an icon to somebody who has never played, three seconds, if they cannot
guess it, redesign it." That needs a picture. This renders the glyph set (or a
file of candidate glyphs) as one labelled PNG so the test has something to show.

    python3 tools/glyph_sheet.py                       # every glyph in glyphs.js
    python3 tools/glyph_sheet.py --only fire,water     # a subset
    python3 tools/glyph_sheet.py --cards               # one tile per CARD, so
                                                       # two cards sharing a
                                                       # picture sit side by side
    python3 tools/glyph_sheet.py --candidates x.json   # [{id,label,d}, ...]
    python3 tools/glyph_sheet.py --blind --only a,b    # NUMBERED, no names: the
                                                       # icon test needs a viewer
                                                       # who cannot read the answer
    python3 tools/glyph_sheet.py --out /tmp/sheet.png --cols 8 --tile 150

Needs cairosvg (pip install cairosvg). Writes print/glyph-sheet.png by default,
which .gitignore already excludes.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GLYPHS_JS = ROOT / "js" / "cards" / "glyphs.js"
CARDS = ROOT / "data" / "cards.json"
STROKE = 2.4
GRID = 24

# id: { label: '...', d: '...' }   (quoted or bare key, either field order)
ENTRY = re.compile(
    r"""^\s*'?(?P<id>[A-Za-z][\w-]*)'?\s*:\s*\{\s*"""
    r"""(?:label:\s*'(?P<label>[^']*)'\s*,\s*d:\s*'(?P<d>[^']*)'"""
    r"""|d:\s*'(?P<d2>[^']*)'\s*,\s*label:\s*'(?P<label2>[^']*)')""",
    re.M,
)


def load_glyphs() -> dict[str, dict]:
    out = {}
    for m in ENTRY.finditer(GLYPHS_JS.read_text()):
        out[m.group("id")] = {
            "label": m.group("label") or m.group("label2") or m.group("id"),
            "d": m.group("d") or m.group("d2"),
        }
    if not out:
        sys.exit(f"parsed 0 glyphs from {GLYPHS_JS.name}: the module shape changed")
    return out


def card_tiles(glyphs: dict) -> list[tuple[str, str, str]]:
    """(icon id, caption, path) per CARD, so shared pictures land side by side."""
    data = json.loads(CARDS.read_text())
    tiles = []
    for deck, items in data.items():
        if not isinstance(items, list):
            continue
        for c in items:
            if not isinstance(c, dict) or not c.get("icon"):
                continue
            g = glyphs.get(c["icon"])
            if not g:
                continue
            tiles.append((c["icon"], f'{c["name"]}\n{c["icon"]}', g["d"]))
    tiles.sort(key=lambda t: (t[0], t[1]))
    return tiles


def sheet(tiles: list[tuple[str, str, str]], cols: int, tile: int, blind: bool = False) -> str:
    """One <svg> holding every tile: the glyph drawn at 60% of the cell, captioned."""
    rows = -(-len(tiles) // cols)
    cap = 34
    cell_h = tile + cap
    w, h = cols * tile, rows * cell_h
    art = tile * 0.62
    k = art / GRID
    dup = {}
    for icon, _, _ in tiles:
        dup[icon] = dup.get(icon, 0) + 1

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
        f'viewBox="0 0 {w} {h}"><rect width="{w}" height="{h}" fill="#f6f3eb"/>'
        '<style>text{font-family:-apple-system,Helvetica,sans-serif;fill:#1c1917}'
        '.cap{font-size:11px;font-weight:700}.sub{font-size:9px;fill:#8a8175}'
        '.warn{fill:#b91c1c}</style>'
    ]
    for i, (icon, caption, d) in enumerate(tiles):
        cx, cy = (i % cols) * tile, (i // cols) * cell_h
        shared = dup.get(icon, 1) > 1 and not blind
        parts.append(
            f'<rect x="{cx + 3}" y="{cy + 3}" width="{tile - 6}" height="{cell_h - 6}" '
            f'rx="10" fill="#fffdf8" stroke="{"#b91c1c" if shared else "#e5ded0"}" '
            f'stroke-width="{2 if shared else 1}"/>'
        )
        ox, oy = cx + (tile - art) / 2, cy + (tile - art) / 2
        parts.append(
            f'<g transform="translate({ox:.1f} {oy:.1f}) scale({k:.4f})">'
            f'<path d="{d}" fill="none" stroke="#111" stroke-width="{STROKE}" '
            'stroke-linecap="round" stroke-linejoin="round"/></g>'
        )
        if blind:
            # The icon test only means something when the viewer cannot read the
            # answer under the picture. Tiles are numbered, nothing else.
            parts.append(
                f'<text class="cap" x="{cx + tile / 2}" y="{cy + tile + 14}" '
                f'text-anchor="middle">{i + 1}</text>'
            )
        else:
            name, _, sub = caption.partition("\n")
            cls = "cap warn" if shared else "cap"
            parts.append(
                f'<text class="{cls}" x="{cx + tile / 2}" y="{cy + tile + 12}" '
                f'text-anchor="middle">{esc(name)}</text>'
            )
            if sub:
                parts.append(
                    f'<text class="sub" x="{cx + tile / 2}" y="{cy + tile + 25}" '
                    f'text-anchor="middle">{esc(sub)}</text>'
                )
    parts.append("</svg>")
    return "".join(parts)


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def main() -> None:
    ap = argparse.ArgumentParser(description="Render the glyph set as one PNG")
    ap.add_argument("--only", help="comma-separated glyph ids")
    ap.add_argument("--cards", action="store_true",
                    help="one tile per card, shared pictures boxed in red")
    ap.add_argument("--candidates", help="JSON file of [{id,label,d}, ...]")
    ap.add_argument("--out", default=str(ROOT / "print" / "glyph-sheet.png"))
    ap.add_argument("--blind", action="store_true",
                    help="numbered tiles, no names: for a real icon test")
    ap.add_argument("--cols", type=int, default=8)
    ap.add_argument("--tile", type=int, default=132)
    a = ap.parse_args()

    if a.candidates:
        items = json.loads(Path(a.candidates).read_text())
        tiles = [(c["id"], f'{c.get("label", c["id"])}\n{c["id"]}', c["d"]) for c in items]
    else:
        glyphs = load_glyphs()
        if a.cards:
            tiles = card_tiles(glyphs)
        else:
            ids = [s.strip() for s in a.only.split(",")] if a.only else sorted(glyphs)
            missing = [i for i in ids if i not in glyphs]
            if missing:
                sys.exit(f"unknown glyph(s): {', '.join(missing)}")
            tiles = [(i, f'{glyphs[i]["label"]}\n{i}', glyphs[i]["d"]) for i in ids]

    try:
        import cairosvg
    except ImportError:
        sys.exit("needs cairosvg: pip install cairosvg")

    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    cairosvg.svg2png(bytestring=sheet(tiles, a.cols, a.tile, a.blind).encode(),
                     write_to=str(out), scale=2)
    print(f"{len(tiles)} tiles -> {out}")
    if a.blind:
        print("key: " + ", ".join(f"{i + 1}={t[0]}" for i, t in enumerate(tiles)))


if __name__ == "__main__":
    main()
