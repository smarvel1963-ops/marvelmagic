# test_channel.py
# Save to: C:\MarvelApps\marvelmagic\tests\test_channel.py
# Channel check (Scott 11/21: "when a show list a particular channel and you open it thar that channel is one of the choices we said").
# Serves the app on localhost, opens it in headless Chromium with every outside call blocked, then fakes one airing: an NBC show
# ("Law & Order") re-running on TNT, with Sling Orange + Peacock ticked. The title lookup is faked to answer "Peacock" - the old swap.
# Checks: the Movies & Shows card says "On TNT" and opens your way to TNT (Sling Orange), its choices are ways to TNT, tapping it does
# NOT swap the choices for the show's streaming home, Watch opens Sling (not Peacock), a guide cell on TNT keeps TNT's ways, and a
# show on a channel you can't reach doesn't show. window.open is replaced so nothing opens.
# Run:  python tests\test_channel.py
import functools, http.server, json, socketserver, sys, threading
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
ok, bad = [], []
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")   # the Watch on: row carries a check mark
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
FAKE_OPEN = """window.__opened = []; window.open = (u) => { const w = { closed: false, close() { this.closed = true; }, location: {} };
  Object.defineProperty(w.location, 'href', { set(v) { window.__opened.push(v); }, get() { return ''; } }); window.__opened.push(u); return w; };"""
state = {"stub": False, "looked": 0}


def route(r):
    u = r.request.url
    if u.startswith(f"http://127.0.0.1:{port}/"):
        return r.continue_()
    if state["stub"] and "script.google.com" in u:   # the title lookup, faked: "Law & Order" streams on Peacock
        a = (parse_qs(urlparse(u).query).get("a") or [""])[0]
        state["looked"] += a in ("find", "where")
        body = {"find": {"results": [{"name": "Law & Order", "type": "tv_series", "id": 5}]},
                "where": {"sources": [{"name": "Peacock", "web": "https://www.peacocktv.com/watch/law-and-order", "type": "sub"}]}}.get(a, {})
        return r.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body=json.dumps(body))
    return r.abort()


SETUP = """(() => {
  const now = Date.now(), show = (id, name) => ({ id, name, network: { name: 'NBC' }, genres: ['Drama', 'Crime'], image: { medium: 'https://example.com/p.jpg', original: 'https://example.com/p.jpg' }, weight: 90 });
  S.mine = ['Sling Orange', 'Peacock'];
  S.airings = [
    { key: 'a1', net: 'TNT', start: now - 600000, end: now + 3000000, title: 'Law & Order', show: show(999001, 'Law & Order') },
    { key: 'a2', net: 'Syfy', start: now - 600000, end: now + 3000000, title: 'Not Reachable', show: show(999002, 'Not Reachable') } ];
  return true; })()"""
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1672, "height": 941})
    pg.set_default_timeout(15000)
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("**/*", route)
    pg.add_init_script(FAKE_OPEN)
    pg.goto(f"http://127.0.0.1:{port}/index.html")
    pg.wait_for_timeout(3000)
    pg.evaluate(SETUP)
    ts = pg.evaluate("todayShows().map(x => ({ id: x.show.id, chan: x.chan, svc: x.svc, note: x.note, opts: (x.options || []).map(o => o.svc) }))")
    lo = next((x for x in ts if x["id"] == 999001), None)
    check("the TNT airing is on Movies & Shows", lo is not None, f"{ts}")
    lo = lo or {}
    check("its card names the channel it airs on", str(lo.get("note", "")).startswith("On TNT"), lo.get("note"))
    check("it opens your way to TNT (Sling Orange), not the show's home app", lo.get("svc") == "Sling Orange", lo.get("svc"))
    check("TNT is one of its choices (Sling Orange listed)", "Sling Orange" in lo.get("opts", []), f"{lo.get('opts')}")
    check("no choice is the show's home app (Peacock)", "Peacock" not in lo.get("opts", []), f"{lo.get('opts')}")
    check("a show on a channel you can't reach (Syfy) is left off", not any(x["id"] == 999002 for x in ts), f"{[x['id'] for x in ts]}")
    state["stub"] = True
    pg.evaluate("showTab(1)")
    pg.wait_for_timeout(1500)
    btn = pg.locator("main .lp", has_text="Law & Order").first
    check("the Law & Order card is on screen", btn.count() == 1)
    if btn.count():
        btn.click()
        pg.wait_for_timeout(2500)
        sel = pg.evaluate("S.sel && { svc: S.sel.svc, exact: S.sel.exact || null, opts: (S.sel.options || []).map(o => o.svc), looked: !!S.sel.looked }")
        check("tapping it keeps it on TNT (no title lookup)", sel and not sel["looked"] and state["looked"] == 0, f"{sel} lookups={state['looked']}")
        check("after the tap it still opens Sling Orange", sel and sel["svc"] == "Sling Orange" and not sel["exact"], f"{sel}")
        where = pg.evaluate("[...document.querySelectorAll('#dock .where a')].map(a => a.textContent)")
        check("the Watch on: row lists Sling Orange", any("Sling Orange" in w for w in where), f"{where}")
        check("the Watch on: row has no Peacock", not any("Peacock" in w for w in where), f"{where}")
        pg.evaluate("window.__opened = []")
        btn = pg.locator("main .lp", has_text="Law & Order").first
        btn.click()
        pg.wait_for_timeout(1500)
        first = pg.evaluate("(() => { const b = document.getElementById('back'); return b && b.open ? b.querySelector('b').textContent : ''; })()")
        if first:   # the first-time box ("First time opening Sling Orange on this computer") - press its Open button
            check("the first-time box is for Sling Orange", "Sling Orange" in first, first)
            pg.click("#back [data-rcgo]")
            pg.wait_for_timeout(1000)
        opened = pg.evaluate("window.__opened")
        check("Watch opens a Sling page, not Peacock", bool(opened) and all("peacock" not in str(u).lower() for u in opened) and any("sling" in str(u).lower() for u in opened), f"{opened}")
    pg.evaluate("S.sel = null; showTab(0)")
    pg.wait_for_timeout(1500)
    cell = pg.locator("#ggrid .cell", has_text="Law & Order").first
    check("the guide shows the TNT listing", cell.count() == 1)
    if cell.count():
        state["looked"] = 0
        cell.click()
        pg.wait_for_timeout(2500)
        sel = pg.evaluate("S.sel && { svc: S.sel.svc, opts: (S.sel.options || []).map(o => o.svc), looked: !!S.sel.looked }")
        check("a guide cell keeps TNT's ways after the tap", sel and "Sling Orange" in sel["opts"] and "Peacock" not in sel["opts"] and not sel["looked"] and state["looked"] == 0, f"{sel} lookups={state['looked']}")
    check("no page errors", not errs, f"{errs[:3]}")
    b.close()
print(f"\n{len(ok)} passed, {len(bad)} failed")
sys.exit(1 if bad else 0)
