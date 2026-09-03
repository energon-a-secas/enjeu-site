#!/usr/bin/env python3
"""Every card as a PNG a printing service will take, face and back, paired.

    make serve                     # in another shell, port 8871
    python3 tools/export_cards.py                    # Spanish, standard size
    python3 tools/export_cards.py --lang en --size bleed
    python3 tools/export_cards.py --unique           # 69 distinct cards, not 111

Why a browser and not rsvg-convert or cairosvg, both of which are installed:
the cards set font-family to the system stack, and only the browser resolves
that stack the way the site does. A librsvg render silently substitutes a
different face for every numeral on every card, and the deck you print stops
matching the deck you designed. Chromium renders what you saw.

It also means the tool and the site's own download button run the SAME code:
js/cards/png.js is imported into the live page here, so a file written by this
script is what a visitor gets when they click Download.

Output (gitignored):

    print/cards-<lang>-<size>/faces/001-strike-face-es.png
    print/cards-<lang>-<size>/backs/001-strike-back-es.png
    print/cards-<lang>-<size>/MANIFEST.txt

faces/ and backs/ hold the same filenames in the same order, so a service that
wants "one folder of fronts, one of backs" pairs them by position with nothing
to line up by hand.

Requires playwright (pip install playwright && playwright install chromium).
"""
from __future__ import annotations

import argparse
import base64
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_URL = "http://localhost:8871/"

# Built in the live page so the export path is the site's own. The modules are
# already loaded and their art is already fetched, so importing them here hands
# back the SAME singletons the page is rendering from.
PREPARE = """
async (lang) => {
  const [cardsMod, face, png, rules, strings, sheet] = await Promise.all([
    import('/js/data/cards.js'),
    import('/js/cards/face.js'),
    import('/js/cards/png.js'),
    import('/js/game/rules.js'),
    import('/js/strings.js'),
    import('/js/cards/sheet.js'),
  ]);
  const data = cardsMod.cards();
  if (!data) throw new Error('the card data has not loaded yet');
  strings.setLang(lang);
  const aid = rules.aidFor(data, strings.reactionNames(), strings.breakNames(), strings.dmNames());
  window.__ex = { data, face, png, sheet, aid };
  const glyphs = await import('/js/cards/glyphs.js');
  // How many of the deck's own icons resolved to the attributed art rather than
  // falling back to the in-house glyph. Zero means loadArt did not finish or
  // did not find the files, and the export would be quietly wrong.
  const icons = [...new Set(data.physical.map((c) => c.icon).filter(Boolean))];
  return {
    physical: data.physical.length,
    unique: new Set(data.physical.map((c) => c.id)).size,
    art: icons.filter((id) => glyphs.artBody(id)).length,
    icons: icons.length,
  };
}
"""

RENDER = """
async ([index, unique, size, lang]) => {
  const { data, face, png, sheet, aid } = window.__ex;
  const list = unique
    ? data.physical.filter((c, i, a) => a.findIndex((x) => x.id === c.id) === i)
    : data.physical;
  const card = list[index];
  const faceSvg = face.cardFace(card, { size: 'sheet', aid });
  const backSvg = face.cardBack(sheet.backKind(card), { size: 'sheet' });
  const blobs = await Promise.all([png.cardPng(faceSvg, size), png.cardPng(backSvg, size)]);
  const b64 = await Promise.all(blobs.map((b) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = () => rej(new Error('could not read the image back'));
    r.readAsDataURL(b);
  })));
  return {
    faceName: png.cardFileName(card, index, 'face', lang),
    backName: png.cardFileName(card, index, 'back', lang),
    id: card.id, deck: card.deck, back: sheet.backKind(card),
    face: b64[0], backImg: b64[1],
    bytes: [blobs[0].size, blobs[1].size],
  };
}
"""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--lang", default="es", choices=["es", "en"], help="which language the reference cards print in")
    ap.add_argument("--size", default="standard", choices=["standard", "bleed", "high"])
    ap.add_argument("--unique", action="store_true", help="one file per distinct card (69) rather than per printed card (111)")
    ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("playwright is not installed: pip install playwright && playwright install chromium", file=sys.stderr)
        return 2

    out = Path(args.out) if args.out else ROOT / "print" / f"cards-{args.lang}-{args.size}"
    faces, backs = out / "faces", out / "backs"
    faces.mkdir(parents=True, exist_ok=True)
    backs.mkdir(parents=True, exist_ok=True)

    written: list[dict] = []
    total_bytes = 0
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(device_scale_factor=1)
        errors: list[str] = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.goto(args.url, wait_until="networkidle")
        # js/app.js awaits loadArt() before its first render. Without that, cards
        # still draw, but with the in-house glyph instead of the attributed
        # picture, and the export would be quietly wrong rather than empty.
        # Not a selector: the default view is Learn, which renders a .deck and
        # never a .container, so waiting on markup waits for the wrong thing.
        # The real precondition is that the card data parsed and the art fetch
        # settled, and only the modules can say so.
        page.wait_for_function(
            "async () => { const m = await import('/js/data/cards.js'); return !!m.cards(); }",
            timeout=20000,
        )
        counts = page.evaluate(PREPARE, args.lang)
        print(f"art: {counts['art']} of {counts['icons']} card icons resolved to the attributed files")
        if not counts.get("art"):
            print("warning: the attributed art has not loaded; cards would export "
                  "with the in-house glyphs instead", file=sys.stderr)
        n = counts["unique"] if args.unique else counts["physical"]
        print(f"{n} cards, {args.lang}, {args.size}")

        for i in range(n):
            r = page.evaluate(RENDER, [i, args.unique, args.size, args.lang])
            (faces / r["faceName"]).write_bytes(base64.b64decode(r["face"]))
            (backs / r["backName"]).write_bytes(base64.b64decode(r["backImg"]))
            total_bytes += sum(r["bytes"])
            written.append(r)
            print(f"  {i + 1:>3}/{n}  {r['id']:<16} back:{r['back']:<10} "
                  f"{r['bytes'][0] // 1024}K + {r['bytes'][1] // 1024}K", flush=True)

        size_px = page.evaluate("(s) => window.__ex.png.printSize(s)", args.size)
        browser.close()

    if errors:
        print(f"\n{len(errors)} console error(s) during export:", file=sys.stderr)
        for e in errors[:5]:
            print(f"  {e}", file=sys.stderr)

    lines = [
        "Enjeu, cards for printing",
        "",
        f"language        {args.lang}",
        f"size            {size_px['width']} x {size_px['height']} px "
        f"(bleed {size_px['bleedMm']}mm, about {size_px['dpi']} DPI on a 63 x 88 mm card)",
        f"cards           {len(written)} "
        f"({'one per distinct card' if args.unique else 'one per printed card, copies included'})",
        f"total           {total_bytes / 1048576:.1f} MB",
        "",
        "faces/ and backs/ hold the same filenames in the same order: face N pairs",
        "with back N. Every image is opaque and runs to the edge, so a service can",
        "trim and round the corners without cutting into transparent pixels.",
        "",
        "index  card             deck        back",
    ]
    for i, r in enumerate(written):
        lines.append(f"{i + 1:>5}  {r['id']:<16} {r['deck']:<11} {r['back']}")
    (out / "MANIFEST.txt").write_text("\n".join(lines) + "\n")

    print(f"\nwrote {len(written) * 2} files, {total_bytes / 1048576:.1f} MB")
    print(f"  {faces}")
    print(f"  {backs}")
    print(f"  {out / 'MANIFEST.txt'}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
