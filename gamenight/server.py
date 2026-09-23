"""Static server for the built SPA + /api/health for the watchdog.

Serves frontend/dist on 127.0.0.1:<port>. There is deliberately no other API:
the site is read-only and the research pipeline runs offline (research.py),
rewriting data/games.json and rebuilding dist. Because files are read from
disk per request, a rebuild goes live without a restart.
"""

import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from . import DIST_DIR, __version__
from .data import load_games


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST_DIR), **kwargs)

    def do_GET(self):
        if self.path.split("?", 1)[0] == "/api/health":
            try:
                games = len(load_games())
            except Exception:
                games = None
            body = json.dumps({"ok": True, "games": games, "version": __version__}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def end_headers(self):
        # Vite emits content-hashed filenames under /assets/ — cache those hard;
        # everything else (index.html, manifest, icons) must revalidate so a
        # rebuild shows up immediately.
        if self.path.startswith("/assets/"):
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        else:
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        print(f"{self.address_string()} {fmt % args}", flush=True)


def serve(port=5004):
    if not (DIST_DIR / "index.html").exists():
        raise SystemExit(f"no build at {DIST_DIR} - run: cd frontend && npm run build")
    httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"gamenight {__version__} serving {DIST_DIR} on http://127.0.0.1:{port}", flush=True)
    httpd.serve_forever()
