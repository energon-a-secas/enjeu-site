#!/usr/bin/env python3
"""
Enjeu - dev server.

python -m http.server sends Last-Modified and nothing else, so browsers apply
heuristic freshness and happily serve week-old ES modules after the files have
changed on disk. During this site's build that produced pages running a mix of
old and new modules, whose buttons do nothing and whose errors point nowhere.

Same server, one added header: Cache-Control: no-cache. The browser then
revalidates every request (304 when unchanged, so it stays fast) and an edit
is always live on the next plain reload.

    python3 tools/serve.py [port]     # default 8871, serves the repo root
"""
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler


class FreshHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8871
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    print(f"Serving (no-cache) on http://localhost:{port}")
    HTTPServer(('', port), FreshHandler).serve_forever()


if __name__ == '__main__':
    main()
