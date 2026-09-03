#!/usr/bin/env python3
"""The six box panels as print-ready PNGs, from the same page the cards use.

    make serve
    python3 tools/export_box.py                 # Spanish
    python3 tools/export_box.py --lang en --dpi 600

The service asks for six faces and offers to link the two spines and the two
lids. This writes four distinct designs and then the six files it wants, so the
linked pairs are literally the same image and an unlinked pair still has a file.

Output: print/box-<lang>/frente.png, dorso.png, lomo-izquierdo.png,
lomo-derecho.png, tapa-superior.png, tapa-inferior.png, MANIFEST.txt
"""
from __future__ import annotations
import argparse, base64, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Panel -> the filename the service's own labels imply, and which design it uses.
FACES = [
    ("frente", "front"), ("dorso", "back"),
    ("lomo-izquierdo", "spine"), ("lomo-derecho", "spine"),
    ("tapa-superior", "lid"), ("tapa-inferior", "lid"),
]

RENDER = """
async ([panel, lang, dpi]) => {
  const box = await import('/js/cards/box.js');
  const png = await import('/js/cards/png.js');
  const svg = box.boxPanels(box.BOX_COPY[lang])[panel];
  const s = box.panelSize(panel, dpi);
  const blob = await png.toPngBlob(svg, s.width, s.height);
  const b64 = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = () => rej(new Error('could not read the image back'));
    r.readAsDataURL(blob);
  });
  return { b64, w: s.width, h: s.height, mm: `${s.widthMm}x${s.heightMm}`, bytes: blob.size };
}
"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", default="es", choices=["es", "en"])
    ap.add_argument("--dpi", type=int, default=300)
    ap.add_argument("--url", default="http://localhost:8871/")
    args = ap.parse_args()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("pip install playwright && playwright install chromium", file=sys.stderr)
        return 2

    out = ROOT / "print" / f"box-{args.lang}"
    out.mkdir(parents=True, exist_ok=True)
    rows, total = [], 0
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        page = b.new_page()
        errors = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.goto(args.url, wait_until="networkidle")
        page.wait_for_function(
            "async () => { const m = await import('/js/data/cards.js'); return !!m.cards(); }", timeout=20000)
        cache = {}
        for filename, panel in FACES:
            if panel not in cache:
                cache[panel] = page.evaluate(RENDER, [panel, args.lang, args.dpi])
            r = cache[panel]
            (out / f"{filename}.png").write_bytes(base64.b64decode(r["b64"]))
            total += r["bytes"]
            rows.append((filename, panel, r))
            print(f"  {filename:<18} {panel:<6} {r['mm']}mm  {r['w']}x{r['h']}px  {r['bytes']//1024}K")
        b.close()
    if errors:
        print(f"\n{len(errors)} console error(s):", *errors[:4], sep="\n  ", file=sys.stderr)

    lines = ["Enjeu, box panels", "", f"language   {args.lang}", f"dpi        {args.dpi}",
             f"box        65 x 90 x 38 mm internal, sized for 111 cards at ~0.32mm each", "",
             "The two spines share one design and the two lids share one, so the",
             "service's 'same design on both' boxes can stay ticked. Unticked, each",
             "file is still there and can be replaced individually.", "",
             "file                 panel   mm        px"]
    for f, p, r in rows:
        lines.append(f"{f:<20} {p:<7} {r['mm']:<9} {r['w']}x{r['h']}")
    (out / "MANIFEST.txt").write_text("\n".join(lines) + "\n")
    print(f"\nwrote {len(rows)} files, {total/1048576:.1f} MB\n  {out}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
