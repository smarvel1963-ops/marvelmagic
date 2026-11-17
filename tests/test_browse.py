# test_browse.py
# Save to: C:\MarvelApps\marvelmagic\tests\test_browse.py
# Browse Movies + Free Tonight check (Scott 11/16 "Yes, build both"): serves the app on localhost, opens it in headless Chromium and
# checks Home's Free Tonight row (12 posters, a different 12 tomorrow), the Browse Movies page in the menu (one card per movie, the
# full list loads, Free / service / genre / decade / length / rating filters, Top rated sort, search, Show more), that a movie on
# several services opens a free one first, and Kids Lock. window.open is replaced so nothing opens. Screenshots: tests\shots\bw_*.png
# Run:  python tests\test_browse.py
import functools, http.server, json, socketserver, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "tests" / "shots"
SHOTS.mkdir(exist_ok=True)
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
total = json.loads((ROOT / "catalogs" / "browse.json").read_text(encoding="utf-8"))["count"]
FAKE_OPEN = """window.__opened = []; window.open = (u) => { const w = { closed: false, close() { this.closed = true; }, location: {} };
  Object.defineProperty(w.location, 'href', { set(v) { window.__opened.push(v); }, get() { return ''; } }); window.__opened.push(u); return w; };"""
COUNT = "document.querySelectorAll('main .lp').length"
MATCH = "(() => { const b = [...document.querySelectorAll('main p.fine b')][0]; return b ? Number(b.textContent.replace(/,/g, '')) : -1; })()"
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1672, "height": 941})
    pg.set_default_timeout(15000)
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("**/script.google.com/**", lambda r: r.abort())
    pg.add_init_script(FAKE_OPEN)
    pg.goto(f"http://127.0.0.1:{port}/index.html")
    pg.wait_for_timeout(3500)
    pg.evaluate("showTab(HOME)")
    pg.wait_for_timeout(2500)
    ft = pg.evaluate("(() => { const h = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Free Tonight')); const g = h && h.closest('.hh').nextElementSibling; return g ? [...g.querySelectorAll('.lpt b')].map(b => b.textContent) : null; })()")
    check("Home has Free Tonight with 12 posters", ft is not None and len(ft) == 12, f"{(ft or [])[:3]}")
    tomorrow = pg.evaluate("(() => { const real = Date.now; Date.now = () => real() + 86400000; const html = freeTonight(); Date.now = real; return [...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('.lpt b')].map(b => b.textContent); })()")
    check("tomorrow shows a different 12", bool(tomorrow) and tomorrow != ft, f"{tomorrow[:2]}")
    pg.locator("[data-bwfree]").scroll_into_view_if_needed()
    pg.screenshot(path=str(SHOTS / "bw_home_free_tonight.png"))
    check("menu has Browse Movies", pg.evaluate("[...document.querySelectorAll('#nav button')].some(b => b.textContent.includes('Browse Movies'))"))
    pg.click("#nav button[data-tab='11']")
    pg.wait_for_timeout(7000)
    check("Browse shows 60 posters", pg.evaluate(COUNT) == 60, f"{pg.evaluate(COUNT)}")
    m_all = pg.evaluate(MATCH)
    check(f"the full list loads ({total:,} different movies)", m_all == total, f"{m_all}")
    keys = pg.evaluate("[...document.querySelectorAll('main .lp')].map(b => items[Number(b.dataset.i)].wmId)")
    check("one card per movie (no repeats)", len(keys) == len(set(keys)))
    pg.screenshot(path=str(SHOTS / "bw_browse.png"))
    pg.click("[data-bwk='price'][data-bwv='free']")
    pg.wait_for_timeout(600)
    m_free = pg.evaluate(MATCH)
    check("Free filter", 0 < m_free < m_all, f"{m_free:,} free")
    pg.click("[data-bwk='g'][data-bwv='28']")
    pg.click("[data-bwk='dec'][data-bwv='1980']")
    pg.wait_for_timeout(600)
    m_80s = pg.evaluate(MATCH)
    yrs = pg.evaluate("[...document.querySelectorAll('main .lp')].map(b => items[Number(b.dataset.i)].year)")
    check("free 1980s action", 0 < m_80s < m_free and all(1980 <= y < 1990 for y in yrs), f"{m_80s} movies")
    pg.screenshot(path=str(SHOTS / "bw_free_80s_action.png"))
    pg.click("[data-bwk='rate'][data-bwv='7']")
    pg.click("[data-bwk='sort'][data-bwv='rate']")
    pg.wait_for_timeout(600)
    rs = pg.evaluate("[...document.querySelectorAll('main .lp')].slice(0, 12).map(b => items[Number(b.dataset.i)].rating)")
    check("rating 7+ and Top rated sort", bool(rs) and all(r >= 7 for r in rs) and rs == sorted(rs, reverse=True), f"{rs[:5]}")
    for k, v in (("price", "all"), ("g", "0"), ("dec", "0"), ("rate", "0"), ("sort", "pop")):
        pg.click(f"[data-bwk='{k}'][data-bwv='{v}']")
    pg.click("[data-bwk='svc'][data-bwv='Netflix']")
    pg.wait_for_timeout(600)
    m_nf = pg.evaluate(MATCH)
    check("service filter (Netflix)", 3000 < m_nf < 4000, f"{m_nf}")
    pg.click("[data-bwk='svc'][data-bwv='']")
    pg.fill("#bwq", "the matrix")
    pg.press("#bwq", "Enter")
    pg.wait_for_timeout(600)
    hits = pg.evaluate("[...document.querySelectorAll('main .lp .lpt b')].map(b => b.textContent)")
    check("search finds The Matrix once", hits.count("The Matrix") == 1, f"{hits[:4]}")
    # free first: a movie on a free service and a paid one opens the free one
    pick = pg.evaluate("(() => { const all = BW_ALL.items; const x = all.find(x => x.free && (x.bits & ~63)); return x ? [x.title, x.svc, x.options.map(o => o.svc)] : null; })()")
    check("free service first on a movie that's on free + paid", pick is not None and pick[1] in ("YouTube", "Tubi", "The Roku Channel", "Pluto TV", "Freevee", "Plex"), f"{pick}")
    pg.fill("#bwq", "")
    pg.press("#bwq", "Enter")
    pg.wait_for_timeout(500)
    pg.click("[data-bwmore]")
    pg.wait_for_timeout(600)
    check("Show more adds 60", pg.evaluate(COUNT) == 120)
    kid = pg.evaluate("(() => { S.kids = { on: true }; const shown = BW_ALL.items.filter(kidOk); S.kids = { on: false }; return [shown.length, shown.every(x => x.gids.includes(10751) && !x.gids.some(g => [27, 53, 80, 10752].includes(g)))]; })()")
    check("Kids Lock keeps only family movies", kid[0] > 0 and kid[1], f"{kid[0]:,}")
    check("no JavaScript errors", not errs, "; ".join(errs[:2]))
    b.close()
httpd.shutdown()
print(f"\n{len(ok)} passed, {len(bad)} failed")
sys.exit(1 if bad else 0)
