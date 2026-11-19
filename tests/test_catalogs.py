# test_catalogs.py
# Save to: C:\MarvelApps\marvelmagic\tests\test_catalogs.py
# Full movie lists check (Scott 11/16: Free on YouTube "Yes, build it"; all services "Yes, every 2 weeks"): serves the app on localhost,
# opens it in headless Chromium and checks the Free on YouTube shelf, a See all page (Show more, search, genre chip, Back), a paid
# service's full list in On Your Services (Netflix ticked), opening a movie (goes to that service), Movies & Shows search across every
# list, Free TV's "Every Free Movie" buttons (Tubi's whole list), and Kids Lock. window.open is replaced so nothing really opens.
# --live also asks the real relay for one movie's own YouTube page (one Watchmode lookup on the relay, cached there).
# Screenshots: tests\shots\ml_*.png.   Run:  python tests\test_catalogs.py [--live]
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
    print(("PASS " if cond else "FAIL ") + name + (f"  ({extra})" if extra else ""), flush=True)


class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Q, directory=str(ROOT)))
httpd.daemon_threads = True
threading.Thread(target=httpd.serve_forever, daemon=True).start()
port = httpd.server_address[1]
FAKE_OPEN = """window.__opened = []; window.open = (u) => { const w = { closed: false, close() { this.closed = true; }, location: {} };
  Object.defineProperty(w.location, 'href', { set(v) { window.__opened.push(v); }, get() { return ''; } }); window.__opened.push(u); return w; };"""
SHELF = "(() => { const h = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Free on YouTube')); const g = h && h.closest('.hh').nextElementSibling; return g ? g.querySelectorAll('.lp img').length : -1; })()"
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1672, "height": 941})
    pg.set_default_timeout(15000)
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    if not LIVE:   # keep the relay out of it: the lookup fails fast and the app falls back to the service's own search
        pg.route("**/script.google.com/**", lambda r: r.abort())
    pg.add_init_script(FAKE_OPEN)   # survives the page's own reload on start
    pg.goto(f"http://127.0.0.1:{port}/index.html")
    pg.wait_for_timeout(2500)
    pg.evaluate("showTab(1)")
    pg.wait_for_timeout(2500)
    check("Movies & Shows: Free on YouTube shelf, 12 posters", pg.evaluate(SHELF) == 12, f"{pg.evaluate(SHELF)}")
    pg.locator("[data-mlall='YouTube']").first.scroll_into_view_if_needed()
    pg.screenshot(path=str(SHOTS / "ml_youtube_shelf.png"))
    pg.click("[data-mlall='YouTube']")
    pg.wait_for_timeout(3500)
    check("YouTube See all: 60 posters", pg.evaluate("document.querySelectorAll('main .lp').length") == 60)
    pg.click("[data-mlmore]")
    pg.wait_for_timeout(600)
    check("Show more adds 60", pg.evaluate("document.querySelectorAll('main .lp').length") == 120)
    pg.fill("#mlq", "forrest gump")
    pg.press("#mlq", "Enter")
    pg.wait_for_timeout(600)
    titles = pg.evaluate("[...document.querySelectorAll('main .lp .lpt b')].map(b => b.textContent)")
    check("See all search finds Forrest Gump", "Forrest Gump" in titles, f"{titles[:3]}")
    pg.fill("#mlq", "")
    pg.press("#mlq", "Enter")
    pg.wait_for_timeout(400)
    pg.click("[data-mlg='16']")
    pg.wait_for_timeout(500)
    check("Animation chip filters", pg.evaluate("document.querySelectorAll('main .lp').length") > 0)
    pg.click("main .lp >> nth=0")
    pg.wait_for_timeout(800 if not LIVE else 6000)
    pg.click("main .lp.on")
    pg.wait_for_timeout(1500 if LIVE else 3000)
    opened = pg.evaluate("window.__opened") or []
    check("a YouTube movie opens on YouTube", any("youtube.com" in u for u in opened), f"{opened[-1:]}")
    if LIVE:
        check("the relay found the movie's own YouTube page", any("youtube.com/watch" in u for u in opened), f"{opened}")
    pg.evaluate("document.getElementById('back').open && document.getElementById('back').close()")   # the came-back question
    pg.click("[data-mlback]")
    pg.wait_for_timeout(500)
    check("Back returns to Movies & Shows", pg.evaluate("!document.querySelector('#mlfind')"))
    # a paid service: Netflix ticked -> On Your Services > Movies is Netflix's full list
    pg.evaluate("S.mine = ['Netflix']; S.catSvc = 'Netflix'; S.catKind = 'movie'; draw()")
    pg.wait_for_timeout(2500)
    nf = pg.evaluate("[...document.querySelectorAll('[data-mlall=\"Netflix\"]')].map(b => b.textContent)")
    check("On Your Services shows Netflix's full list", bool(nf) and "movies" in nf[0], f"{nf}")
    pg.locator("[data-mlall='Netflix']").first.scroll_into_view_if_needed()
    pg.screenshot(path=str(SHOTS / "ml_netflix_services.png"))
    pg.click("[data-mlall='Netflix']")
    pg.wait_for_timeout(3500)
    n_nf = pg.evaluate("document.querySelectorAll('main .lp').length")
    check("Netflix See all: 60 posters", n_nf == 60, f"{n_nf}")
    pg.screenshot(path=str(SHOTS / "ml_netflix_all.png"))
    before = len(pg.evaluate("window.__opened") or [])
    pg.click("main .lp >> nth=0")
    pg.wait_for_timeout(800)
    pg.click("main .lp.on")
    pg.wait_for_timeout(3000)
    opened = (pg.evaluate("window.__opened") or [])[before:]
    check("a Netflix movie opens on Netflix", any("netflix.com" in u for u in opened), f"{opened[-1:]}")
    pg.evaluate("document.getElementById('back').open && document.getElementById('back').close()")
    pg.click("[data-mlback]")
    pg.wait_for_timeout(500)
    # search: every list this person can watch (Netflix + the free ones)
    pg.fill("#q", "the matrix")
    pg.press("#q", "Enter")
    pg.wait_for_timeout(9000)
    found = pg.evaluate("(() => { const h = [...document.querySelectorAll('h3.lsub')].find(h => h.textContent.startsWith('Watch Now')); const g = h && h.nextElementSibling; return g ? [...g.querySelectorAll('.lpt')].map(e => e.textContent) : []; })()")
    check("Movies & Shows search lists Watch Now matches", len(found) > 0, f"{found[:3]}")
    pg.screenshot(path=str(SHOTS / "ml_search.png"))
    # Free TV: a button for every free service; Tubi's whole list
    pg.evaluate("S.q = ''; S.results = null; S.movies = null; showTab(4)")
    pg.wait_for_timeout(3000)
    # 11/19: Free TV first says "Loading free channels…", then the live channel rows arrive ABOVE these buttons and push them ~2,400 px
    # down. A tap that raced that landed on the channel text, so "Tubi See all" read 12 (the page never left Free TV). Wait for the rows.
    pg.wait_for_function("!/Loading (free )?channels/.test(document.querySelector('main').innerText)", timeout=30000)
    pg.wait_for_timeout(500)
    chips = pg.evaluate("[...document.querySelectorAll('[data-mlall]')].map(b => b.textContent)")
    check("Free TV: Every Free Movie buttons for 6 free services", sum(1 for c in chips if "movies" in c) >= 6, f"{chips[:7]}")
    pg.locator("[data-mlall='Tubi']").first.scroll_into_view_if_needed()
    pg.screenshot(path=str(SHOTS / "ml_freetv.png"))
    pg.click("[data-mlall='Tubi']")
    pg.wait_for_timeout(5000)
    n_tubi = pg.evaluate("document.querySelectorAll('main .lp').length")
    check("Tubi See all: 60 posters", n_tubi == 60, f"{n_tubi}")
    pg.screenshot(path=str(SHOTS / "ml_tubi_all.png"))
    kid = pg.evaluate("(() => { S.kids = { on: true }; const all = (ML['Tubi|all'] || {}).items || []; const shown = all.filter(kidOk); S.kids = { on: false }; return [all.length, shown.length, shown.every(x => x.gids.includes(10751) && !x.gids.some(g => [27, 53, 80, 10752].includes(g)))]; })()")
    check("Kids Lock keeps only family movies", kid[1] > 0 and kid[1] < kid[0] and kid[2], f"{kid[1]} of {kid[0]}")
    check("no JavaScript errors", not errs, "; ".join(errs[:2]))
    b.close()
httpd.shutdown()
print(f"\n{len(ok)} passed, {len(bad)} failed")
sys.exit(1 if bad else 0)
