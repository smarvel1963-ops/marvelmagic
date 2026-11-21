# test_focus.py
# Save to: C:\MarvelApps\marvelmagic\tests\test_focus.py
# Remote / keyboard highlight check (11/20). styles.css gives every focused button `position:relative` (so its glow sits on top). A button
# that is pinned in place (absolute / fixed - the 👍 in a poster's corner, the Cast to TV button) lost its pin when highlighted: it dropped
# into the page, rows grew and the page jumped, so taps missed. This opens all 12 pages at TV and phone size, highlights every pinned
# button / link / box and fails if any of them moves or changes how it is placed.   Run:  python tests\test_focus.py
import functools, http.server, socketserver, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
bad = []


class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Q, directory=str(ROOT)))
httpd.daemon_threads = True
threading.Thread(target=httpd.serve_forever, daemon=True).start()
port = httpd.server_address[1]
SWEEP = """() => { const out = [], seen = new Set();
  for (const b of document.querySelectorAll('button, a, input')) {
    const p0 = getComputedStyle(b).position; if (p0 !== 'absolute' && p0 !== 'fixed' && p0 !== 'sticky') continue;
    if (!b.offsetParent && p0 !== 'fixed') continue;
    const r0 = b.getBoundingClientRect(), sy = window.scrollY;
    b.focus({ focusVisible: true, preventScroll: true }); const p1 = getComputedStyle(b).position, r1 = b.getBoundingClientRect(); b.blur(); window.scrollTo(0, sy);
    if (p1 !== p0 || Math.abs(r1.x - r0.x) > 2 || Math.abs(r1.y - r0.y) > 2) {
      const k = (b.id || b.className || b.tagName) + ' ' + p0 + '->' + p1; if (!seen.has(k)) { seen.add(k); out.push(k); } } }
  return out; }"""
n = 0
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, vp in (("tv", {"width": 1672, "height": 941}), ("phone", {"width": 390, "height": 844})):
        pg = b.new_page(viewport=vp)
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(f"http://127.0.0.1:{port}/index.html")
        pg.wait_for_timeout(3000)
        for tab in range(12):
            pg.evaluate(f"showTab({tab})")
            pg.wait_for_timeout(2500)
            moved = pg.evaluate(SWEEP)
            n += 1
            for m in moved:
                bad.append(f"{name} tab {tab}: {m}")
        if errs:
            bad.append(f"{name}: JavaScript error {errs[0][:150]}")
        pg.close()
    b.close()
httpd.shutdown()
for x in bad:
    print("FAIL", x)
print(f"{'PASS' if not bad else 'FAIL'} - {n} pages: {'no pinned button moves when highlighted' if not bad else str(len(bad)) + ' problems'}")
sys.exit(1 if bad else 0)
