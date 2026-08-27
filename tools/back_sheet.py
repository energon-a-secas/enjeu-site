#!/usr/bin/env python3
"""
Enjeu - card back contact sheet.

A card back is judged at the size it prints, not at the size it is designed.
This lays candidate backs side by side and, with --true-size, renders them at
exactly 63 x 88 mm so the "will this hold on a home printer" question has a
picture behind it.

    python3 tools/back_sheet.py --candidates backs.json --out sheet.png
    python3 tools/back_sheet.py --candidates backs.json --out sheet.png --true-size
    python3 tools/back_sheet.py --shipped --out current.png     # what ships today

candidates JSON: [{"id": "...", "label": "...", "svg": "<svg ...>...</svg>"}, ...]

Needs cairosvg.
"""

from __future__ import annotations

import argparse
import base64
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
W, H = 630, 880
MM_W, MM_H = 63.0, 88.0
DPI = 300


def inline_art(svg: str) -> str:
    """
    Resolve href="art/x.svg" into a data: URI.

    cairosvg will not follow an <image> href to a file on disk, so a card that
    uses real art rendered as an empty frame here while looking correct in the
    browser. That made the offline sheet quietly useless for exactly the cards
    worth reviewing.
    """
    def sub(m):
        rel = m.group(2)
        f = ROOT / rel
        if not f.exists():
            return m.group(0)
        b64 = base64.b64encode(f.read_bytes()).decode()
        return f'{m.group(1)}"data:image/svg+xml;base64,{b64}"'
    return re.sub(r'((?:xlink:)?href=)"((?:art|print)/[^"]+)"', sub, svg)


def inner(svg: str) -> str:
    """The guts of a candidate <svg>, so it can be nested in the sheet."""
    m = re.search(r"<svg[^>]*>(.*)</svg>", svg, re.S)
    return m.group(1) if m else svg


def esc(s: str) -> str:
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def main() -> None:
    ap = argparse.ArgumentParser(description="Render candidate card backs")
    ap.add_argument("--candidates")
    ap.add_argument("--shipped", action="store_true", help="render the back face.js draws today")
    ap.add_argument("--out", required=True)
    ap.add_argument("--cols", type=int, default=4)
    ap.add_argument("--true-size", action="store_true",
                    help="render each at 63x88mm/300dpi, the size it actually prints")
    a = ap.parse_args()

    if a.shipped:
        js = (ROOT / "js" / "cards" / "face.js").read_text()
        m = re.search(r"export function cardBack[\s\S]*?\n}", js)
        items = [{"id": "shipped", "label": "current cardBack()",
                  "svg": "<svg/>", "_note": "rendered from source is not attempted; "
                  "pass --candidates instead"}]
        if not m:
            sys.exit("could not find cardBack() in face.js")
        print("--shipped only reports that cardBack() exists; pass --candidates to compare art")
        items = []
    else:
        if not a.candidates:
            sys.exit("need --candidates FILE")
        items = json.loads(Path(a.candidates).read_text())

    if not items:
        sys.exit("nothing to render")

    try:
        import cairosvg
    except ImportError:
        sys.exit("needs cairosvg: pip install cairosvg")

    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    if a.true_size:
        # one card per tile at exactly the printed size, on paper-coloured stock
        px_w = int(MM_W / 25.4 * DPI)
        px_h = int(MM_H / 25.4 * DPI)
        cols = min(a.cols, len(items))
        rows = -(-len(items) // cols)
        cap = 46
        cw, ch = px_w + 40, px_h + cap
        sheet_w, sheet_h = cols * cw, rows * ch
        parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{sheet_w}" height="{sheet_h}" '
            f'viewBox="0 0 {sheet_w} {sheet_h}"><rect width="{sheet_w}" height="{sheet_h}" fill="#e8e2d5"/>'
            '<style>text{font-family:-apple-system,Helvetica,sans-serif;fill:#1c1917;font-size:22px;font-weight:700}</style>'
        ]
        for i, it in enumerate(items):
            ox, oy = (i % cols) * cw + 20, (i // cols) * ch + 8
            k = px_w / W
            parts.append(f'<g transform="translate({ox} {oy}) scale({k:.5f})">{inner(inline_art(it["svg"]))}</g>')
            parts.append(f'<text x="{ox + px_w / 2}" y="{oy + px_h + 30}" text-anchor="middle">'
                         f'{esc(it.get("label", it["id"]))}</text>')
        parts.append("</svg>")
        cairosvg.svg2png(bytestring="".join(parts).encode(), write_to=str(out))
        print(f"{len(items)} backs at true 63x88mm ({px_w}x{px_h}px) -> {out}")
        return

    tile = 300
    cap = 40
    cols = min(a.cols, len(items))
    rows = -(-len(items) // cols)
    th = int(tile * H / W)
    sheet_w, sheet_h = cols * (tile + 24), rows * (th + cap)
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{sheet_w}" height="{sheet_h}" '
        f'viewBox="0 0 {sheet_w} {sheet_h}"><rect width="{sheet_w}" height="{sheet_h}" fill="#e8e2d5"/>'
        '<style>text{font-family:-apple-system,Helvetica,sans-serif;fill:#1c1917;font-size:15px;font-weight:700}</style>'
    ]
    for i, it in enumerate(items):
        ox, oy = (i % cols) * (tile + 24) + 12, (i // cols) * (th + cap) + 8
        k = tile / W
        parts.append(f'<g transform="translate({ox} {oy}) scale({k:.5f})">{inner(inline_art(it["svg"]))}</g>')
        parts.append(f'<text x="{ox + tile / 2}" y="{oy + th + 24}" text-anchor="middle">'
                     f'{esc(it.get("label", it["id"]))}</text>')
    parts.append("</svg>")
    cairosvg.svg2png(bytestring="".join(parts).encode(), write_to=str(out), scale=2)
    print(f"{len(items)} backs -> {out}")


if __name__ == "__main__":
    main()
