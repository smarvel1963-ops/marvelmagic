# test_lock.py
# Save to: C:\MarvelApps\marvelmagic\tests\test_lock.py
# The 30-day lock (js/membership.js, Scott 11/15: "All paid apps"). Serves the app on localhost, fakes the Hub relay (verify / code /
# confirm) and checks: a new device is open for 30 days; day 31 shows only the lock screen (price, Join link to Whop, QR, email box);
# the email + emailed code unlock it; a wrong email says so; the lock keeps the TV remote's arrows inside it; a member whose weekly
# check hasn't been reached for 3 weeks locks again. Nothing outside is called - the relay is faked.
# Run:  python tests\test_lock.py            (exit 0 = pass)    --shots saves tests\shots\lock_*.png
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
from smoke_test import serve

FAILS = []
def check(name, ok, extra=""):
    print(("  PASS  " if ok else "  FAIL  ") + name + ("" if ok else f"  {extra}"))
    if not ok: FAILS.append(name)

DAY = 86400000
GOOD = "household@example.com"
def fake_relay(state):
    def handler(route):
        req = json.loads(route.request.post_data or "{}"); state["calls"].append(req)
        t = req.get("task")
        if t == "verify":
            if req.get("app") != "marvelmagic": body = {"valid": False, "status": "wrong app"}
            elif req.get("buyer") != GOOD: body = {"valid": False, "status": "not found"}
            elif not state["confirmed"]: body = {"valid": False, "status": "needs code"}
            else: body = {"valid": True, "status": "active", "until": None}
        elif t == "code": body = {"sent": True}
        elif t == "confirm": state["confirmed"] = req.get("code") == "123456"; body = {"ok": state["confirmed"]}
        else: body = {"error": "unknown"}
        route.fulfill(status=200, content_type="application/json", body=json.dumps(body))
    return handler

def open_app(b, port, size, before=None):
    ctx = b.new_context(viewport={"width": size[0], "height": size[1]})
    state = {"calls": [], "confirmed": False}
    # Playwright runs the LAST matching route first: outside sites are blocked, then the relay fake is laid over them
    ctx.route(lambda u: not u.startswith(f"http://127.0.0.1:{port}") and "cdnjs.cloudflare.com" not in u, lambda r: r.abort())
    ctx.route("**/macros/s/**", fake_relay(state))
    if before: ctx.add_init_script(before)
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(f"http://127.0.0.1:{port}/index.html", wait_until="domcontentloaded"); pg.wait_for_timeout(1200)
    return ctx, pg, state, errs

def main():
    shots = "--shots" in sys.argv
    httpd, port = serve()
    with sync_playwright() as p:
        b = p.chromium.launch()
        print("\n[a new device]")
        ctx, pg, st, errs = open_app(b, port, (1672, 941))
        check("30 days left on a new device, not locked", pg.evaluate("mmMembership.daysLeft()") == 30 and not pg.evaluate("mmMembership.locked()") and not pg.query_selector("#mmLock"))
        check("no page errors", not errs, errs[:2]); ctx.close()

        print("\n[day 31]")
        old = f"localStorage.setItem('mm.trialStart', String(Date.now() - 31 * {DAY}));"
        ctx, pg, st, errs = open_app(b, port, (1672, 941), old)
        t = pg.inner_text("#mmLock") if pg.query_selector("#mmLock") else ""
        check("locked: one screen with the price", pg.evaluate("mmMembership.locked()") and "Your 30 free days are up" in t and "$4.99 a month" in t, t[:200])
        check("the Join button goes to the Whop checkout in a new tab", pg.evaluate("(() => { const a = document.querySelector('#mmLock .mml-join'); return a && a.href === 'https://whop.com/commander-marvel-por-picks/marvel-magic' && a.target === '_blank'; })()"))
        check("a QR code of the same link for the TV", pg.evaluate("!!document.querySelector('#mmlQr img, #mmlQr canvas')"))
        check("it covers the whole screen", pg.evaluate("(() => { const r = document.getElementById('mmLock').getBoundingClientRect(); return r.width >= innerWidth && r.height >= innerHeight; })()"))
        if shots: pg.screenshot(path=str(Path(__file__).parent / "shots" / "lock_tv.png"))
        pg.keyboard.press("ArrowDown"); pg.keyboard.press("ArrowDown")
        check("the remote's arrows stay inside the lock screen", pg.evaluate("document.getElementById('mmLock').contains(document.activeElement)"))
        pg.fill("#mmlEmailIn", "someone@else.com"); pg.click("#mmlEmail button"); pg.wait_for_timeout(300)
        check("a wrong email says so and stays locked", "couldn't find a Marvel Magic membership" in pg.inner_text("#mmLock") and pg.evaluate("mmMembership.locked()"))
        pg.fill("#mmlEmailIn", GOOD); pg.click("#mmlEmail button"); pg.wait_for_timeout(300)
        check("the right email: a code is emailed and asked for", "emailed a 6-digit code" in pg.inner_text("#mmLock") and any(c.get("task") == "code" for c in st["calls"]))
        check("every check names the app (marvelmagic)", all(c.get("app") == "marvelmagic" for c in st["calls"] if c.get("task") == "verify"))
        pg.fill("#mmlCodeIn", "999999"); pg.click("#mmlCode button"); pg.wait_for_timeout(300)
        check("a wrong code doesn't unlock", pg.evaluate("mmMembership.locked()"))
        pg.fill("#mmlCodeIn", "123456"); pg.click("#mmlCode button"); pg.wait_for_timeout(400)
        check("the right code unlocks: the lock screen is gone", not pg.evaluate("mmMembership.locked()") and not pg.query_selector("#mmLock"))
        pg.reload(wait_until="domcontentloaded"); pg.wait_for_timeout(1000)
        check("still unlocked after opening again, no check needed", not pg.query_selector("#mmLock"))
        check("no page errors", not errs, errs[:2]); ctx.close()

        print("\n[a member who hasn't been checked for 3 weeks]")
        stale = old + f"localStorage.setItem('mm.member', JSON.stringify({{ buyer: 'x@y.com', ok: true, checked: Date.now() - 22 * {DAY} }}));"
        ctx, pg, st, errs = open_app(b, port, (390, 844), stale)
        check("locks again (weekly check + 2 weeks of grace both passed)", pg.evaluate("mmMembership.locked()") and pg.query_selector("#mmLock") is not None)
        check("on a phone the QR is hidden (tap Join instead)", pg.evaluate("getComputedStyle(document.getElementById('mmlQr')).display") == "none")
        if shots: pg.screenshot(path=str(Path(__file__).parent / "shots" / "lock_phone.png"))
        ctx.close()
        fresh = old + f"localStorage.setItem('mm.member', JSON.stringify({{ buyer: '{GOOD}', ok: true, checked: Date.now() - 2 * {DAY} }}));"
        ctx, pg, st, errs = open_app(b, port, (390, 844), fresh)
        check("a member checked 2 days ago is open with no call", not pg.query_selector("#mmLock") and not st["calls"])
        ctx.close()
        b.close()
    httpd.shutdown()
    print(f"\n{'ALL PASS' if not FAILS else str(len(FAILS)) + ' FAILED'}")
    sys.exit(1 if FAILS else 0)

if __name__ == "__main__":
    main()
