#!/usr/bin/env python3
"""Build qr-studio-offline.html: the whole app in one file.

Inlines the stylesheet, every script and the icons, and drops the parts that
only make sense on a web server (manifest, service worker). The result opens by
double-click from a phone or computer with no internet and no server.

Run from the repo root after changing any app file:

    python3 tools/build-offline.py
"""
import base64
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "qr-studio-offline.html"


def data_uri(rel):
    path = ROOT / rel
    mime = {".svg": "image/svg+xml", ".png": "image/png"}[path.suffix]
    return "data:%s;base64,%s" % (mime, base64.b64encode(path.read_bytes()).decode("ascii"))


def inline_script(match):
    code = (ROOT / match.group(1)).read_text(encoding="utf-8")
    # A literal "</script" inside the code would end the inline block early.
    code = re.sub(r"</(script)", r"<\\/\1", code, flags=re.I)
    return "<script>\n%s\n</script>" % code


def main():
    html = (ROOT / "index.html").read_text(encoding="utf-8")

    html = re.sub(r'\s*<link rel="manifest"[^>]*>', "", html)
    html = re.sub(r'\s*<link rel="apple-touch-icon"[^>]*>', "", html)
    html = re.sub(r'(<link rel="icon" href=")([^"]+)(")',
                  lambda m: m.group(1) + data_uri(m.group(2)) + m.group(3), html)
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">',
                  lambda m: "<style>\n%s\n</style>" % (ROOT / m.group(1)).read_text(encoding="utf-8"), html)
    html = re.sub(r'<script src="([^"]+)"></script>', inline_script, html)
    html = re.sub(r'(<img[^>]+src=")(icons/[^"]+)(")',
                  lambda m: m.group(1) + data_uri(m.group(2)) + m.group(3), html)
    html = html.replace("<head>", '<head>\n  <!-- Built by tools/build-offline.py from index.html. Do not edit by hand. -->', 1)

    markup = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", html, flags=re.S | re.I)
    leftovers = re.findall(r'(?:src|href)="(?!data:|https?:|#|mailto:|tel:)([^"]+)"', markup)
    leftovers = [l for l in leftovers if l not in ("qr-studio-offline.html",)]
    if leftovers:
        raise SystemExit("Unresolved local references: %s" % leftovers)

    OUT.write_text(html, encoding="utf-8")
    print("Wrote %s (%.1f KB)" % (OUT.name, OUT.stat().st_size / 1024))


if __name__ == "__main__":
    main()
