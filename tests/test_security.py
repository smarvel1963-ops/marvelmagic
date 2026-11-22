# test_security.py - C:\MarvelApps\marvelmagic\tests\test_security.py
# 11/22 (Scott via Desktop: "Yes, fix safe ones", after Aikido's scan): checks the three guards added that day -
#  1. tvmSet: a TVmaze picture URL with anything but plain path characters gets no inline onerror script
#  2. webUrl: only http(s) links are used (no javascript:, data:, etc.) - openWin / whereRow / the rescue box all ask it
#  3. a public Top List with a non-number score shows 0 points, never its text
# Run:  python tests\test_security.py
import functools, http.server, socketserver, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
ok, bad = [], []


def check(name, cond, extra=""):
    (ok if cond else bad).append(name)
    print(("PASS " if cond else "FAIL ") + name + (f"  ({extra})" if extra else ""), flush=True)


class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Q, directory=str(ROOT)))
httpd.daemon_threads = True
threading.Thread(target=httpd.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(f"http://127.0.0.1:{httpd.server_address[1]}/index.html")
    pg.wait_for_timeout(2500)
    good = "https://static.tvmaze.com/uploads/images/original_untouched/123/456.jpg"
    evil = "https://static.tvmaze.com/uploads/images/original_untouched/x';alert(document.domain);'"
    r = pg.evaluate("([g, e]) => [tvmSet(g), tvmSet(e)]", [good, evil])
    check("a normal TVmaze picture still gets its sizes + fallback", "srcset=" in r[0] and "onerror=" in r[0])
    check("a TVmaze-looking URL with a quote gets no inline script at all", r[1] == "", r[1][:80])
    w = pg.evaluate("['https://www.netflix.com/title/1', 'http://a.b/c', 'javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,x', '', null].map(webUrl)")
    check("web links pass", w[0] and w[1])
    check("javascript:, data: and empty links are refused", w[2:] == ["", "", "", "", ""], str(w[2:]))
    hero = pg.evaluate("pageHero('prate', 'K', 'T', `⭐ ${Number('<img src=x onerror=alert(1)>') || 0} points`)")
    check("a text score shows as 0 points", "0 points" in hero and "<img" not in hero)
    check("no page errors", not errs, str(errs[:2]))
    b.close()
print(f"\n{len(ok)} passed, {len(bad)} failed")
sys.exit(1 if bad else 0)
