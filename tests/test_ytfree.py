# test_ytfree.py
# Save to: C:\MarvelApps\marvelmagic\tests\test_ytfree.py
# Free on YouTube check (Scott 11/16 "Yes, build it"): serves the app on localhost, opens Movies & Shows and Free TV in headless Chromium,
# and checks the shelf (posters), See all (search, genre chip, Show more, Back), search on Movies & Shows, Kids Lock, and that opening a
# movie goes to YouTube. Opening is caught (window.open is replaced) so nothing really opens. --live also asks the real relay for one
# movie's YouTube page (one Watchmode lookup on the relay, cached there). Screenshots go to tests\shots\yt_*.png.
# Run:  python tests\test_ytfree.py [--live]
import functools, http.server, socketserver, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "tests" / "shots"
SHOTS.mkdir(exist_ok=True)
LIVE = "--live" in sys.argv
ok, bad = [], []


def check(name, cond, extra=""):
    (ok if cond else bad).append(name)
    print(("PASS " if cond else "FAIL ") + name + (f"  ({extra})" if extra else ""))


class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Q, directory=str(ROOT)))
httpd.daemon_threads = True
threading.Thread(target=httpd.serve_forever, daemon=True).start()
port = httpd.server_address[1]
FAKE_OPEN = """window.__opened = []; window.open = (u) => { const w = { closed: false, close() { this.closed = true; }, location: {} };
  Object.defineProperty(w.location, 'href', { set(v) { window.__opened.push(v); }, get() { return ''; } }); window.__opened.push(u); return w; };"""
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1672, "height": 941})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    if not LIVE:   # keep the relay out of it: the lookup fails fast, the app falls back to a YouTube search
        pg.route("**/script.google.com/**", lambda r: r.abort())
    pg.add_init_script(FAKE_OPEN)   # survives the page's own reload on start
    pg.goto(f"http://127.0.0.1:{port}/index.html")
    pg.wait_for_timeout(2500)
    pg.evaluate("showTab(1)")
    pg.wait_for_timeout(2500)
    n = pg.evaluate("[...document.querySelectorAll('h2')].filter(h => h.textContent.includes('Free on YouTube')).length")
    check("Movies & Shows has the Free on YouTube shelf", n == 1)
    posters = pg.evaluate("(() => { const h = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Free on YouTube')); const g = h && h.closest('.hh').nextElementSibling; return g ? g.querySelectorAll('.lp img').length : 0; })()")
    check("shelf shows 12 posters", posters == 12, f"{posters}")
    pg.locator("[data-ytall]").first.scroll_into_view_if_needed()
    pg.screenshot(path=str(SHOTS / "yt_shelf.png"))
    pg.click("[data-ytall]")
    pg.wait_for_timeout(3500)
    cnt = pg.evaluate("document.querySelectorAll('main .lp').length")
    check("See all shows 60 posters", cnt == 60, f"{cnt}")
    pg.screenshot(path=str(SHOTS / "yt_all.png"))
    pg.click("[data-ytmore]")
    pg.wait_for_timeout(600)
    check("Show more adds 60", pg.evaluate("document.querySelectorAll('main .lp').length") == 120)
    pg.fill("#ytq", "forrest gump")
    pg.press("#ytq", "Enter")
    pg.wait_for_timeout(600)
    titles = pg.evaluate("[...document.querySelectorAll('main .lp .lpt b')].map(b => b.textContent)")
    check("search finds Forrest Gump", "Forrest Gump" in titles, f"{titles[:3]}")
    pg.fill("#ytq", "")
    pg.press("#ytq", "Enter")
    pg.wait_for_timeout(400)
    pg.click("[data-ytg='16']")
    pg.wait_for_timeout(500)
    first = pg.evaluate("[...document.querySelectorAll('main .lp .lpt b')].slice(0, 4).map(b => b.textContent)")
    check("Animation chip filters", len(first) > 0, f"{first}")
    pg.screenshot(path=str(SHOTS / "yt_animation.png"))
    # pick a movie: first tap selects (detail card), second tap opens
    pg.click("main .lp >> nth=0")
    pg.wait_for_timeout(800 if not LIVE else 6000)
    pg.screenshot(path=str(SHOTS / "yt_selected.png"))
    pg.click("main .lp.on")
    pg.wait_for_timeout(1500 if LIVE else 11500)
    opened = pg.evaluate("window.__opened")
    check("opening a movie goes to YouTube", any("youtube.com" in u for u in opened), f"{opened[-1:] if opened else 'nothing opened'}")
    if LIVE:
        check("the relay found the movie's own YouTube page", any("youtube.com/watch" in u for u in opened), f"{opened}")
    pg.evaluate("document.getElementById('back').open && document.getElementById('back').close()")   # the came-back question
    pg.click("[data-ytback]")
    pg.wait_for_timeout(500)
    check("Back returns to Movies & Shows", pg.evaluate("!document.querySelector('#ytfind')"))
    pg.fill("#q", "corpse bride")
    pg.press("#q", "Enter")
    pg.wait_for_timeout(4000)
    found = pg.evaluate("(() => { const h = [...document.querySelectorAll('h3.lsub')].find(h => h.textContent === 'Free on YouTube'); const g = h && h.nextElementSibling; return g ? [...g.querySelectorAll('.lpt b')].map(b => b.textContent) : []; })()")
    check("Movies & Shows search lists free YouTube matches", "Corpse Bride" in found, f"{found[:3]}")
    pg.evaluate("showTab(4)")
    pg.wait_for_timeout(2500)
    check("Free TV has the Free on YouTube shelf", pg.evaluate("[...document.querySelectorAll('h2')].some(h => h.textContent.includes('Free on YouTube'))"))
    pg.locator("[data-ytall]").first.scroll_into_view_if_needed()
    pg.screenshot(path=str(SHOTS / "yt_freetv.png"))
    # Kids Lock: only Family movies that aren't Horror / Thriller / Crime / War
    kid = pg.evaluate("(() => { S.kids = { on: true }; const all = (YT_ALL.items || []); const shown = all.filter(kidOk); S.kids = { on: false }; return [all.length, shown.length, shown.every(x => x.gids.includes(10751) && !x.gids.some(g => [27, 53, 80, 10752].includes(g)))]; })()")
    check("Kids Lock keeps only family movies", kid[1] > 0 and kid[1] < kid[0] and kid[2], f"{kid[1]} of {kid[0]}")
    check("no JavaScript errors", not errs, "; ".join(errs[:2]))
    b.close()
httpd.shutdown()
print(f"\n{len(ok)} passed, {len(bad)} failed")
sys.exit(1 if bad else 0)
