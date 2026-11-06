#!/usr/bin/env python3
# Static HTTPS server of the download site (port 5006, behind the router's HTTPS proxy).
# The macOS disk images are NOT linked on the page and cannot be fetched by a browser: they are served only to `curl`
# with the secret key in the address (the key is written in install-mac.sh). Everything else is plain static files.
import http.server, ssl, os, sys
from urllib.parse import urlparse, parse_qs

ROOT = os.path.expanduser("~/total-site")
KEYFILE = os.path.expanduser("~/total-tls/mac-key.txt")


def mac_key():
    try:
        return open(KEYFILE).read().strip()
    except OSError:
        return None


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def list_directory(self, path):  # no folder listings
        self.send_error(404)
        return None

    def _allowed(self):
        u = urlparse(self.path)
        if u.path.lower().endswith(".dmg"):
            key = mac_key()
            ua = self.headers.get("User-Agent", "")
            ok = bool(key) and parse_qs(u.query).get("k", [""])[0] == key and ua.startswith("curl/")
            if not ok:
                self.send_response(403)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.end_headers()
                if self.command != "HEAD":
                    self.wfile.write(b"The macOS build is installed with one command - see the download page.\n")
                return False
        return True

    def do_GET(self):
        if self._allowed():
            super().do_GET()

    def do_HEAD(self):
        if self._allowed():
            super().do_HEAD()


if __name__ == "__main__":
    os.chdir(ROOT)
    s = http.server.ThreadingHTTPServer(("0.0.0.0", 5006), Handler)
    c = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    c.load_cert_chain(os.path.expanduser("~/total-tls/cert.pem"), os.path.expanduser("~/total-tls/key.pem"))
    s.socket = c.wrap_socket(s.socket, server_side=True)
    s.serve_forever()
