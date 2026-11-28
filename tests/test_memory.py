# test_memory.py
# Save to: C:\MarvelApps\marvelmagic\tests\test_memory.py
# Memory check (Scott 11/21: "do we need to monitor memory use on fire stick and make sure our guides dont slow everything down if memory
# is low" -> "Yes, all 3"). Serves the app on localhost at the Fire TV's page size (960x540 at 2x) with the TV app's bridge faked, outside
# pictures answered with a tiny local PNG. Checks: Free TV's channel art / logos ask the wsrv.nl resizer for ~2x the shown size and fall
# back to the original when wsrv fails (low-memory mode: dropped instead); low-memory mode turns on from the TV app's reading, from its warning (mmLowMemory) and by hand
# (Settings > TV App), and then uses half-size pictures and fewer cards; the memory line shows in Settings (TV app 1.6.3) and not on an
# older app; coming back from a show (mmResume) reloads the guide only when it is over 5 minutes old.
# Run:  python tests\test_memory.py
import base64, functools, http.server, socketserver, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
ok, bad = [], []
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


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
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")
UA = "Mozilla/5.0 (Linux; Android 9; AFTKA Build/PS7633; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.102 Mobile Safari/537.36"


def bridge(mem):
    m = f"memory: () => '{mem}', " if mem else ""
    return ("window.MMNative = { platform: () => 'firetv', has: () => true, open: () => {}, version: () => '1.6.3', checkUpdate: () => {}, "
            f"store: () => false, {m}}};")


NORMAL = '{"avail":1200,"total":1894,"threshold":216,"low":false,"lowRam":false,"trim":0}'
LOW = '{"avail":180,"total":1894,"threshold":216,"low":true,"lowRam":false,"trim":0}'
state = {"wsrv": True}


def route(r):
    u = r.request.url
    if u.startswith(f"http://127.0.0.1:{port}/"):
        return r.continue_()
    if r.request.resource_type == "image":
        if "wsrv.nl" in u and not state["wsrv"]:
            return r.abort()
        return r.fulfill(status=200, content_type="image/png", body=PNG)
    return r.abort()


FREE = """(() => { const art = [...document.querySelectorAll('.flart img:not(.fllogo)')], logo = [...document.querySelectorAll('.flart img.fllogo')];
  const w = i => { const m = /[?&]w=(\\d+)/.exec(i.getAttribute('src') || ''); return m ? Number(m[1]) : 0; };
  return { cards: document.querySelectorAll('.flc').length, rows: document.querySelectorAll('.flgrid').length, art: art.length, logo: logo.length,
    artW: [...new Set(art.map(w))], logoW: [...new Set(logo.map(w))], allWsrv: [...art, ...logo].every(i => (i.getAttribute('src') || '').startsWith('https://wsrv.nl/')),
    keepsOrig: [...art, ...logo].every(i => /^https?:\\/\\//.test(i.dataset.o || '')) }; })()"""


def open_app(b, mem):
    ctx = b.new_context(viewport={"width": 960, "height": 540}, device_scale_factor=2, user_agent=UA)
    ctx.add_init_script(bridge(mem))
    pg = ctx.new_page()
    pg.set_default_timeout(15000)
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("**/*", route)
    pg.goto(f"http://127.0.0.1:{port}/index.html")
    pg.wait_for_timeout(3000)
    return ctx, pg, errs


def free_tv(pg):
    pg.evaluate("showTab(4)")
    # 11/27: wait for the cards themselves (a fixed 4 s failed whenever the free-channel lists were slow to come in), then let them settle
    try: pg.wait_for_function("document.querySelectorAll('.flc').length >= 8", timeout=20000)
    except Exception: pass
    pg.wait_for_timeout(800)
    return pg.evaluate(FREE)


with sync_playwright() as p:
    b = p.chromium.launch()
    # 1. a TV with normal memory: full-size small pictures, all cards
    ctx, pg, errs = open_app(b, NORMAL)
    check("normal memory: low-memory mode is off", pg.evaluate("S.lite") is False and not pg.evaluate("document.documentElement.classList.contains('lite')"))
    f = free_tv(pg)
    check("Free TV shows channel cards", f["cards"] >= 8, f"{f['cards']} cards")
    names = pg.evaluate("[...document.querySelectorAll('.flc .flnm')].map(n => n.textContent)")
    check("no channel shows twice on Free TV", len(names) == len(set(names)), f"{len(names)} cards, {len(set(names))} channels")
    check("every channel picture comes through the resizer", f["allWsrv"] and f["art"] > 0 and f["logo"] > 0, f"{f['art']} art, {f['logo']} logos")
    check("channel art is asked at 600 px (290-px box at 2x)", f["artW"] == [600], f"{f['artW']}")
    check("logos are asked at 256 px", f["logoW"] == [256], f"{f['logoW']}")
    check("each picture keeps its original as the fallback", f["keepsOrig"])
    full = f
    # the TV says memory is low (onTrimMemory -> mmLowMemory): the page on screen redraws lighter
    pg.evaluate("mmLowMemory(10)")
    pg.wait_for_timeout(1500)
    f = pg.evaluate(FREE)
    check("the TV's low-memory warning turns low-memory mode on", pg.evaluate("S.lite") is True and pg.evaluate("S.liteWhy") == "the TV said memory is low", pg.evaluate("S.liteWhy"))
    check("...and Free TV redraws with fewer cards", f["cards"] < full["cards"] and f["cards"] <= 12, f"{full['cards']} -> {f['cards']}")
    check("...and half-size pictures (300 / 128 px)", f["artW"] == [300] and f["logoW"] == [128], f"{f['artW']} {f['logoW']}")
    # Settings > TV App: the memory line + the by-hand switch
    pg.evaluate("showTab(10)")
    pg.wait_for_timeout(1500)
    box = pg.evaluate("(() => { const h = [...document.querySelectorAll('h3')].find(h => h.textContent.includes('TV App')); return h ? h.parentElement.innerText : ''; })()")
    check("Settings > TV App shows the TV's free memory", "1,200 MB free" in box and "1,894 MB" in box, box.replace("\n", " | ")[:160])
    check("...and says low-memory mode is on, and why", "Low-memory mode: on" in box and "memory is low" in box)
    ctx.close()

    # 2. a TV that is low on memory when Marvel Magic opens; the by-hand switch
    ctx, pg, errs2 = open_app(b, LOW)
    check("low memory at start: low-memory mode is on", pg.evaluate("S.lite") is True and pg.evaluate("document.documentElement.classList.contains('lite')"), pg.evaluate("S.liteWhy"))
    f = free_tv(pg)
    check("...Free TV starts with fewer cards and half-size pictures", f["cards"] <= 12 and f["artW"] == [300], f"{f['cards']} cards, {f['artW']}")
    pg.evaluate("showTab(10)")
    pg.wait_for_timeout(1200)
    box = pg.evaluate("(() => { const h = [...document.querySelectorAll('h3')].find(h => h.textContent.includes('TV App')); return h ? h.parentElement.innerText : ''; })()")
    check("Settings says memory is low right now", "low right now" in box, box.replace("\n", " | ")[:160])
    ctx.close()

    # 3. an older TV app (no memory reading): no memory line, the switch still works
    ctx, pg, errs3 = open_app(b, None)
    check("older TV app: low-memory mode off", pg.evaluate("S.lite") is False)
    pg.evaluate("showTab(10)")
    pg.wait_for_timeout(1200)
    box = pg.evaluate("(() => { const h = [...document.querySelectorAll('h3')].find(h => h.textContent.includes('TV App')); return h ? h.parentElement.innerText : ''; })()")
    check("older TV app: no memory line", "MB free" not in box and "Low-memory mode: off" in box, box.replace("\n", " | ")[:160])
    pg.click("[data-liteforce]")
    pg.wait_for_timeout(800)
    check("'Always use low-memory mode' turns it on and is saved", pg.evaluate("S.lite") is True and pg.evaluate("load('liteForce', false)") is True and pg.evaluate("S.liteWhy") == "you turned it on")
    pg.click("[data-liteforce]")
    pg.wait_for_timeout(800)
    check("...pressed again it turns off", pg.evaluate("S.lite") is False and pg.evaluate("load('liteForce', false)") is False)
    # resizer down: the original picture loads instead
    state["wsrv"] = False
    pg.evaluate("showTab(4)")
    pg.wait_for_timeout(4000)
    fell = pg.evaluate("(() => { const i = [...document.querySelectorAll('.flart img')].slice(0, 6); return i.map(x => (x.getAttribute('src') || '').startsWith('https://wsrv.nl/') ? 'wsrv' : 'orig'); })()")
    check("if the resizer fails, the first pictures fall back to the original", bool(fell) and all(x == "orig" for x in fell), f"{fell}")
    pg.evaluate("save('liteForce', true); liteCheck(); draw()")
    pg.wait_for_timeout(4000)
    gone = pg.evaluate("(() => ({ left: [...document.querySelectorAll('.flart img')].filter(x => x.complete && x.naturalWidth && !(x.getAttribute('src') || '').startsWith('https://wsrv.nl/')).length, cards: document.querySelectorAll('.flc').length }))()")
    check("low-memory mode: a picture the resizer can't shrink is dropped, never loaded full size", gone["left"] == 0 and gone["cards"] > 0, f"{gone}")
    pg.evaluate("save('liteForce', false); liteCheck(); draw()")
    state["wsrv"] = True
    # coming back from a show: the guide reloads only when it is stale
    calls = pg.evaluate("""(() => { let n = 0; const real = loadGuide; window.loadGuide = loadGuide = () => { n++; };
      S.guideAt = Date.now() - 60000; mmResume(); const fresh = n; S.guideAt = Date.now() - 6 * 60000; mmResume(); const stale = n - fresh;
      loadGuide = window.loadGuide = real; return { fresh, stale }; })()""")
    check("back from a show: a 1-minute-old guide is not reloaded", calls["fresh"] == 0, f"{calls}")
    check("back from a show: a 6-minute-old guide reloads", calls["stale"] == 1, f"{calls}")
    ctx.close()
    allerr = errs + errs2 + errs3
    check("no page errors", not allerr, f"{allerr[:3]}")
    b.close()
print(f"\n{len(ok)} passed, {len(bad)} failed")
sys.exit(1 if bad else 0)
