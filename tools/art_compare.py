#!/usr/bin/env python3
"""
Enjeu - stock art vs in-house glyph, side by side.

Every card face today draws an original glyph from js/cards/glyphs.js, while
data/art-manifest.json records the Noun Project icon meant to replace it.
Nobody had ever seen the two next to each other, which is the only way to judge
whether the swap is an upgrade.

Fetches each sourced slot's PUBLIC 512px preview (no account needed; the vector
download is behind a login) into a cache directory, then renders one sheet:
stock on the left, the glyph that ships today on the right.

    python3 tools/art_compare.py                    # all sourced slots
    python3 tools/art_compare.py --only fire,water
    python3 tools/art_compare.py --cache DIR --out sheet.png

The previews are for REVIEW. Nothing here writes into art/ and nothing fills in
a licence: see $verified in the manifest for why that field belongs to whoever
clicks download.
"""

from __future__ import annotations

import argparse
import base64
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "data" / "art-manifest.json"
GLYPHS_JS = ROOT / "js" / "cards" / "glyphs.js"
PREVIEW = "https://static.thenounproject.com/png/{slug}-icon-{id}-512.png"
ENTRY = re.compile(r"^\s*'?([A-Za-z][\w-]*)'?\s*:\s*\{\s*label:\s*'([^']*)'\s*,\s*d:\s*'([^']*)'", re.M)


def slug_and_id(source: str):
    """https://thenounproject.com/icon/element-fire-2360070/ -> (element-fire, 2360070)"""
    m = re.search(r"/icon/([a-z0-9-]+?)-(\d+)/?$", source)
    return (m.group(1), m.group(2)) if m else (None, None)


def fetch(url: str, dest: Path) -> str:
    if dest.exists() and dest.stat().st_size > 0:
        return "cached"
    req = urllib.request.Request(url, headers={"User-Agent": "enjeu-art-review/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
    except Exception as exc:                      # noqa: BLE001 - report, never guess
        return f"FAILED {exc}"
    dest.write_bytes(data)
    return f"{len(data)} bytes"


def esc(s: str) -> str:
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def main() -> None:
    ap = argparse.ArgumentParser(description="Stock art beside the shipping glyph")
    ap.add_argument("--only", help="comma-separated slot ids")
    ap.add_argument("--cache", default=None)
    ap.add_argument("--out", default=None)
    ap.add_argument("--cols", type=int, default=4)
    a = ap.parse_args()

    manifest = json.loads(MANIFEST.read_text())
    glyphs = {m.group(1): {"label": m.group(2), "d": m.group(3)}
              for m in ENTRY.finditer(GLYPHS_JS.read_text())}
    slots = [s for s in manifest["slots"] if s.get("source")]
    if a.only:
        want = {x.strip() for x in a.only.split(",")}
        slots = [s for s in slots if s["id"] in want]

    cache = Path(a.cache) if a.cache else ROOT / "print" / "art-preview"
    cache.mkdir(parents=True, exist_ok=True)

    rows, failed = [], []
    for s in slots:
        slug, sid = slug_and_id(s["source"])
        if not slug:
            failed.append((s["id"], "source URL does not parse"))
            continue
        dest = cache / f"{s['id']}.png"
        status = fetch(PREVIEW.format(slug=slug, id=sid), dest)
        if status.startswith("FAILED"):
            failed.append((s["id"], status))
            continue
        rows.append((s, dest, glyphs.get(s["id"])))
        print(f"  {s['id']:<18} {status}")

    if not rows:
        sys.exit("nothing fetched")

    tile_w, tile_h, cap = 300, 170, 34
    cols = a.cols
    n_rows = -(-len(rows) // cols)
    W, H = cols * tile_w, n_rows * (tile_h + cap)
    art = 118
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
        f'width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
        f'<rect width="{W}" height="{H}" fill="#f6f3eb"/>'
        '<style>text{font-family:-apple-system,Helvetica,sans-serif;fill:#1c1917}'
        '.cap{font-size:12px;font-weight:700}.sub{font-size:9.5px;fill:#8a8175}</style>'
    ]
    for i, (slot, png, glyph) in enumerate(rows):
        ox, oy = (i % cols) * tile_w, (i // cols) * (tile_h + cap)
        parts.append(f'<rect x="{ox+4}" y="{oy+4}" width="{tile_w-8}" height="{tile_h+cap-8}" rx="10" fill="#fffdf8" stroke="#e5ded0"/>')
        b64 = base64.b64encode(png.read_bytes()).decode()
        parts.append(f'<image x="{ox+22}" y="{oy+26}" width="{art}" height="{art}" '
                     f'xlink:href="data:image/png;base64,{b64}"/>')
        parts.append(f'<line x1="{ox+tile_w/2}" y1="{oy+20}" x2="{ox+tile_w/2}" y2="{oy+tile_h-4}" stroke="#e5ded0" stroke-width="1"/>')
        if glyph:
            k = art / 24
            parts.append(f'<g transform="translate({ox+tile_w/2+22} {oy+26}) scale({k:.4f})">'
                         f'<path d="{glyph["d"]}" fill="none" stroke="#111" stroke-width="2.4" '
                         'stroke-linecap="round" stroke-linejoin="round"/></g>')
        else:
            parts.append(f'<text class="sub" x="{ox+tile_w*0.75}" y="{oy+90}" text-anchor="middle">no glyph</text>')
        parts.append(f'<text class="cap" x="{ox+tile_w/2}" y="{oy+tile_h+8}" text-anchor="middle">{esc(slot["id"])}</text>')
        parts.append(f'<text class="sub" x="{ox+tile_w/2}" y="{oy+tile_h+22}" text-anchor="middle">{esc(slot["use"])}</text>')
        parts.append(f'<text class="sub" x="{ox+tile_w*0.25}" y="{oy+16}" text-anchor="middle">stock</text>')
        parts.append(f'<text class="sub" x="{ox+tile_w*0.75}" y="{oy+16}" text-anchor="middle">ships today</text>')
    parts.append("</svg>")

    try:
        import cairosvg
    except ImportError:
        sys.exit("needs cairosvg")
    out = Path(a.out) if a.out else cache / "compare.png"
    cairosvg.svg2png(bytestring="".join(parts).encode(), write_to=str(out), scale=1.5)
    print(f"\n{len(rows)} slots -> {out}")
    if failed:
        print(f"{len(failed)} could not be fetched:")
        for sid, why in failed:
            print(f"  {sid}: {why}")


if __name__ == "__main__":
    main()
