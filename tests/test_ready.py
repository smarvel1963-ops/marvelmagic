# test_ready.py
# Save to: C:\MarvelApps\marvelmagic\tests\test_ready.py
# Ready-on-this-device check (Scott 11/21: "make sure all channels open to proper app or ask to download and log in" + "when you change tv
# with same account it needs to check for that"). Checks: phone first open asks (Open / Get the app / Sign in), second open doesn't,
# a new device on the same account asks again, a computer gets no store button, free services don't ask on a phone,
# a TV with the app missing says "isn't on this TV yet" and Get hands it to the TV app, a TV with the app installed opens straight away.
# Run:  python tests\test_ready.py
import functools, http.server, json, socketserver, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
bad, n = [], 0


def ok(cond, what):
    global n
    n += 1
    if not cond:
        bad.append(what)


class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Q, directory=str(ROOT)))
httpd.daemon_threads = True
threading.Thread(target=httpd.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{httpd.server_address[1]}/index.html"
IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
MINE = json.dumps(["Netflix", "Sling Orange", "Peacock"])
DIALOG = "() => { const b = document.getElementById('back'); return b.open ? b.innerText : ''; }"

with sync_playwright() as p:
    br = p.chromium.launch()

    # ---- phone ----
    ctx = br.new_context(viewport={"width": 390, "height": 844}, user_agent=IPHONE)
    ctx.add_init_script(f"localStorage.setItem('mm_mine', {json.dumps(MINE)});")
    pg = ctx.new_page()
    pg.goto(URL); pg.wait_for_timeout(2500)
    pg.evaluate("document.getElementById('back').open && document.getElementById('back').close()")
    pg.evaluate("openWin('https://watch.sling.com/1/channel/ca0cad8dbb4a4e68962810d8a6aa8b6a/watch', 'Sling Orange', null)")
    t = pg.evaluate(DIALOG)
    ok("First time opening Sling Orange on this phone" in t, f"phone: first-open dialog missing ({t[:80]!r})")
    ok(pg.locator("#back [data-rcst]").count() == 1 and "apps.apple.com" in (pg.locator("#back [data-rcst]").get_attribute("href") or ""), "phone: Get the app should go to the App Store")
    ok("Sling TV" in t, "phone: app name should read Sling TV")
    ok(pg.locator("#back [data-rcsi]").count() == 1, "phone: Sign in button missing")
    with ctx.expect_page() as newp:
        pg.click("#back [data-rcgo]")
    ok("sling.com" in newp.value.url or newp.value.url == "about:blank", f"phone: Open went to {newp.value.url}")
    newp.value.close()
    ok("Sling Orange" in pg.evaluate("Object.keys(load('devReady', {}))"), "phone: not marked ready after Open")
    pg.wait_for_timeout(300); pg.evaluate("document.getElementById('back').open && document.getElementById('back').close()")
    with ctx.expect_page() as newp2:
        pg.evaluate("openWin('https://watch.sling.com/', 'Sling Orange', null)")
    ok(pg.evaluate(DIALOG) == "", "phone: second open should not ask again")
    newp2.value.close()
    ok(pg.evaluate("needsReady('Tubi')") is False, "phone: free service should not ask")
    ok(pg.evaluate("needsReady('Netflix')") is True, "phone: Netflix not yet checked should ask")
    # cancel leaves no "did it play?" behind
    pg.evaluate("save('pending', {title:'X', at: Date.now()}); openWin('https://www.netflix.com/', 'Netflix', null)")
    pg.click("#back [data-rcno]")
    ok(pg.evaluate("load('pending', null)") is None, "phone: Not now should clear the pending watch")
    # same account, NEW device: account data syncs, devReady does not
    synced = pg.evaluate("['mine','setup','list','ratings'].map(k => localStorage.getItem('mm_' + k))")
    ok("devReady" not in pg.evaluate("String(save)"), "devReady must not be in the synced key list")
    ctx.close()
    ctx2 = br.new_context(viewport={"width": 390, "height": 844}, user_agent=IPHONE)
    ctx2.add_init_script(f"localStorage.setItem('mm_mine', {json.dumps(MINE)});")
    pg = ctx2.new_page(); pg.goto(URL); pg.wait_for_timeout(2000)
    ok(pg.evaluate("needsReady('Sling Orange')") is True, "new device, same account: should ask again")
    ctx2.close()

    # ---- computer ----
    ctx = br.new_context(viewport={"width": 1400, "height": 900})
    ctx.add_init_script(f"localStorage.setItem('mm_mine', {json.dumps(MINE)});")
    pg = ctx.new_page(); pg.goto(URL); pg.wait_for_timeout(2000)
    pg.evaluate("document.getElementById('back').open && document.getElementById('back').close()")
    pg.evaluate("openWin('https://www.peacocktv.com/', 'Peacock', null)")
    t = pg.evaluate(DIALOG)
    ok("on this computer" in t and pg.locator("#back [data-rcst]").count() == 0, f"computer: should ask without a store button ({t[:80]!r})")
    ctx.close()

    # ---- TV app (fake bridge) ----
    for installed in (False, True):
        ctx = br.new_context(viewport={"width": 1672, "height": 941})
        ctx.add_init_script(f"localStorage.setItem('mm_mine', {json.dumps(MINE)}); window.__opened = []; window.MMNative = {{ open: (u, s) => window.__opened.push([u, s]), platform: () => 'firetv', has: s => {str(installed).lower()} }};")
        pg = ctx.new_page(); pg.goto(URL + "?tv=1"); pg.wait_for_timeout(2500)
        pg.evaluate("document.getElementById('back').open && document.getElementById('back').close()")
        pg.evaluate("openWin('https://www.netflix.com/title/1', 'Netflix', null)")
        t = pg.evaluate(DIALOG)
        if installed:
            ok(t == "" and pg.evaluate("window.__opened.length") == 1, "TV with app: should open straight away")
            ok("Netflix" in pg.evaluate("Object.keys(load('devReady', {}))"), "TV with app: should be marked ready")
        else:
            ok("isn’t on this TV yet" in t and pg.evaluate("window.__opened.length") == 0, f"TV without app: should ask first ({t[:60]!r})")
            pg.click("#back [data-rcget]")
            ok(pg.evaluate("window.__opened.length") == 1, "TV without app: Get should hand it to the TV app (store page)")
            ok("Netflix" not in pg.evaluate("Object.keys(load('devReady', {}))"), "TV without app: must not be marked ready")
        ctx.close()
    br.close()
httpd.shutdown()
for x in bad:
    print("FAIL", x)
print(f"{'PASS' if not bad else 'FAIL'} - {n} checks: {'every service checks it is ready on this device' if not bad else str(len(bad)) + ' problems'}")
sys.exit(1 if bad else 0)
