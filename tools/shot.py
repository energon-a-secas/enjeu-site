#!/usr/bin/env python3
"""Full-page screenshot of the card bench (tools/preview.html).

The reason this exists rather than "just scroll and screenshot": judging a
colour change means seeing forty faces at once, in one frame, at the same
moment. Scrolling a preview pane gives you three cards and a memory of the
last three, which is how a palette drifts.

    make serve                    # in another shell, port 8871
    python3 tools/shot.py out.png [--width 1500] [--cell 118] [--section Life]

Requires playwright (pip install playwright && playwright install chromium).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

PORT = 8871


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("out", nargs="?", default="bench.png")
    ap.add_argument("--width", type=int, default=1500)
    ap.add_argument("--cell", type=int, default=118, help="card width in px")
    ap.add_argument("--section", help="screenshot only the grid under this heading")
    ap.add_argument("--port", type=int, default=PORT)
    a = ap.parse_args()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("playwright not installed: pip install playwright && playwright install chromium", file=sys.stderr)
        return 2

    url = f"http://localhost:{a.port}/tools/preview.html?w={a.cell}"
    out = Path(a.out)
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page(viewport={"width": a.width, "height": 1000}, device_scale_factor=2)
        errors: list[str] = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(url, wait_until="networkidle")
        page.wait_for_selector(".sk-card", timeout=5000)
        if a.section:
            # The grid is the sibling right after its heading.
            el = page.locator("h2", has_text=a.section).first.locator("xpath=following-sibling::div[1]")
            el.screenshot(path=str(out))
        else:
            page.screenshot(path=str(out), full_page=True)
        b.close()
    if errors:
        print("console errors:", file=sys.stderr)
        for e in errors:
            print(f"  {e}", file=sys.stderr)
    print(f"{out}  ({out.stat().st_size // 1024} KB)")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
