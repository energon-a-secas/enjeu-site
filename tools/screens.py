#!/usr/bin/env python3
"""Screenshot any view of the running site, at any size, into one folder.

    make serve                       # in another shell
    python3 tools/screens.py out/ --shot play:1440x900 --shot cards:1440x900

A shot is `<hash-path>:<W>x<H>`; the hash path may carry slashes
(`play/2`). Add `--click <data-action>` to press something before the shot,
repeatable, applied to every shot in the run.
"""
from __future__ import annotations
import argparse, sys
from pathlib import Path

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--shot", action="append", required=True)
    ap.add_argument("--click", action="append", default=[])
    ap.add_argument("--wait", type=int, default=1200)
    ap.add_argument("--port", type=int, default=8871)
    ap.add_argument("--full", action="store_true", help="full page, not just the viewport")
    a = ap.parse_args()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("pip install playwright && playwright install chromium", file=sys.stderr)
        return 2
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    bad = 0
    with sync_playwright() as p:
        b = p.chromium.launch()
        for spec in a.shot:
            view, _, size = spec.partition(":")
            w, _, h = (size or "1440x900").partition("x")
            page = b.new_page(viewport={"width": int(w), "height": int(h)}, device_scale_factor=2)
            errs: list[str] = []
            page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errs.append(str(e)))
            page.goto(f"http://localhost:{a.port}/#/{view}", wait_until="networkidle")
            page.wait_for_timeout(a.wait)
            for sel in a.click:
                loc = page.locator(f'[data-action="{sel}"]').first
                if loc.count():
                    loc.click(); page.wait_for_timeout(a.wait)
                else:
                    print(f"  (no [data-action={sel}] on {view})", file=sys.stderr)
            name = f"{view.replace('/', '-')}-{w}x{h}.png"
            page.screenshot(path=str(out / name), full_page=a.full)
            print(f"{name}  {'ERRORS: ' + '; '.join(errs) if errs else 'clean'}")
            bad += len(errs)
            page.close()
        b.close()
    return 1 if bad else 0

if __name__ == "__main__":
    raise SystemExit(main())
