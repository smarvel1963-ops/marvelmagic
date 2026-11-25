# test_which_service.py
# Save to: C:\MarvelApps\marvelmagic\tests\test_which_service.py
# Scott 11/25: "you show a program say like its on prime i click it and tries to open it on you tube it should go to one you show or open a window
# and lets you pick from which service you wanna see it from not the wrong one". Watch opens the service the card names; a Prime/Netflix original
# is never sent to a live bundle (YouTube TV); a card naming none of yours, with 2+ of yours carrying it, asks which.   Run:  python tests\test_which_service.py
import functools, http.server, socketserver, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Q, directory=str(ROOT))); httpd.daemon_threads = True
threading.Thread(target=httpd.serve_forever, daemon=True).start(); port = httpd.server_address[1]
ok = bad = 0
def check(c, m):
    global ok, bad
    print(("  PASS  " if c else "  FAIL  ") + m); ok += c; bad += (not c)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1672, "height": 941}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.add_init_script("localStorage.setItem('mm_mine', JSON.stringify(['YouTube TV','Prime Video','Netflix','Peacock'])); localStorage.setItem('mm_setup', JSON.stringify(['YouTube TV','Prime Video','Netflix','Peacock']));")
    pg.goto(f"http://127.0.0.1:{port}/index.html?tv=1"); pg.wait_for_timeout(2500)
    pg.evaluate("window.__op = []; openWin = (u, svc) => __op.push(svc); needsReady = () => false; if ($('back').open) $('back').close();")
    now = "Date.now()"
    # 1. a Prime Video original in the guide (TVmaze channel 'Prime Video'), card says Prime Video
    pg.evaluate(f"openNow({{ key: 'e1', title: 'Reacher', net: 'Prime Video', svc: 'Prime Video', start: {now}, end: {now} + 3e6, series: true }}, null)")
    check(pg.evaluate("__op.at(-1)") == "Prime Video", "Prime original opens Prime Video, not YouTube TV")
    check(not pg.evaluate("pkgHas('YouTube TV', 'Prime Video')") and pg.evaluate("pkgHas('YouTube TV', 'AMC')"), "live bundles carry channels, not Prime/Netflix originals")
    # 2. a live channel whose card shows Peacock (NBC: YouTube TV + Peacock both yours) opens Peacock
    pg.evaluate(f"openNow({{ key: 'e2', title: 'News', net: 'NBC', svc: 'Peacock', start: {now}, end: {now} + 3e6 }}, null)")
    check(pg.evaluate("__op.at(-1)") == "Peacock", "NBC card showing Peacock opens Peacock")
    pg.evaluate(f"openNow({{ key: 'e3', title: 'News', net: 'NBC', svc: 'YouTube TV', start: {now}, end: {now} + 3e6 }}, null)")
    check(pg.evaluate("__op.at(-1)") == "YouTube TV", "NBC card showing YouTube TV opens YouTube TV")
    # 3. a movie on Netflix and Prime, card names a service you don't have -> pick window
    n0 = pg.evaluate("__op.length")
    pg.evaluate("openNow({ key: 'm1', title: 'Film', svc: 'Hulu', exact: 'https://x.test/a', options: [{ svc: 'Netflix', url: 'https://www.netflix.com/title/1' }, { svc: 'Prime Video', url: 'https://www.amazon.com/dp/1' }] }, null)")
    check(pg.evaluate("$('back').open && $('back').querySelectorAll('[data-pk]').length") == 2 and pg.evaluate("__op.length") == n0, "named service not yours, 2 of yours have it -> asks which (nothing opened yet)")
    pg.click("#back [data-pk='1']")
    check(pg.evaluate("__op.at(-1)") == "Prime Video" and not pg.evaluate("$('back').open"), "picking Prime Video opens Prime Video")
    # 4. card names one of yours -> opens it straight away, no window
    pg.evaluate("openNow({ key: 'm2', title: 'Film', svc: 'Netflix', exact: 'https://www.netflix.com/title/1', options: [{ svc: 'Netflix', url: 'https://www.netflix.com/title/1' }, { svc: 'Prime Video', url: 'https://www.amazon.com/dp/1' }] }, null)")
    check(pg.evaluate("__op.at(-1)") == "Netflix" and not pg.evaluate("$('back').open"), "card naming Netflix opens Netflix with no question")
    check(not errs, f"no page errors ({errs[:1]})")
    b.close()
httpd.shutdown(); print(f"\n{ok} passed, {bad} failed"); sys.exit(1 if bad else 0)
