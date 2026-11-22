# test_tvapp.py
# Save to: C:\MarvelApps\marvelmagic\tests\test_tvapp.py
# Settings > TV App (Scott 11/21: "firestick doesnt show version number anywhere"). Fakes the Fire TV app's MMNative bridge:
# 1.6+ shows its version and a Check for update button that calls the app; an older app (no version()) says how to update;
# a phone / computer / Samsung shows no TV App box. Run: python tests\test_tvapp.py (exit 0 = pass)
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
from smoke_test import serve

FAILS = []
def check(name, ok, extra=""):
    print(("  PASS  " if ok else "  FAIL  ") + name + ("" if ok else f"  {extra}"))
    if not ok: FAILS.append(name)

NEW = "window.MMNative = { platform: () => 'firetv', has: () => true, open: () => {}, version: () => '1.6', checkUpdate: () => { window.__checked = (window.__checked || 0) + 1; } };"
OLD = "window.MMNative = { platform: () => 'firetv', has: () => true, open: () => {} };"
STORE = "window.MMNative = { platform: () => 'firetv', has: () => true, open: () => {}, version: () => '1.6.2', checkUpdate: () => {}, store: () => true };"
DAY = 24 * 3600 * 1000
SAM = "window.MMNative = { platform: () => 'samsung', has: () => true, open: () => {} };"

def settings(b, port, init):
    ctx = b.new_context(viewport={"width": 1672, "height": 941})
    ctx.route(lambda u: not u.startswith(f"http://127.0.0.1:{port}") and "cdnjs.cloudflare.com" not in u, lambda r: r.abort())
    if init: ctx.add_init_script(init)
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(f"http://127.0.0.1:{port}/index.html", wait_until="domcontentloaded"); pg.wait_for_timeout(1000)
    pg.evaluate("showTab(10)"); pg.wait_for_timeout(300)
    return ctx, pg, errs

def main():
    httpd, port = serve()
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx, pg, errs = settings(b, port, NEW); v = pg.inner_text("#view")
        check("TV app 1.6: Settings shows 'version 1.6'", "TV App" in v and "version 1.6" in v, v[:200])
        pg.click("[data-tvupd]"); pg.wait_for_timeout(100)
        check("Check for update asks the TV app", pg.evaluate("window.__checked") == 1)
        check("no page errors", not errs, errs[:2]); ctx.close()
        ctx, pg, errs = settings(b, port, OLD); v = pg.inner_text("#view")
        check("older TV app: says it is older and how to update (Force stop, reopen, Update now)", "older Marvel Magic app" in v and "Force stop" in v and "Update now" in v)
        check("no page errors", not errs, errs[:2]); ctx.close()
        # v11/21 Amazon Appstore copy (MMNative.store()): no price, no Join / Whop link, no QR, no trial notice - members sign in
        expired = f"localStorage.setItem('mm.trialStart', String(Date.now() - 31 * {DAY}));"
        ctx, pg, errs = settings(b, port, STORE + expired); pg.wait_for_timeout(300)
        lock = pg.inner_html("#mmLock") if pg.query_selector("#mmLock") else ""
        check("store app, free days up: lock screen is up", bool(lock))
        check("store app lock: no price, no Join, no Whop link, no QR", "4.99" not in lock and "mml-join" not in lock and "whop.com" not in lock and "mmlQr" not in lock, lock[:300])
        check("store app lock: members sign in with their email", "sign in" in lock and pg.query_selector("#mmlEmailIn") is not None)
        check("store app lock: focus starts on the email box", pg.evaluate("document.activeElement && document.activeElement.id") == "mmlEmailIn")
        check("no page errors", not errs, errs[:2]); ctx.close()
        d25 = f"localStorage.setItem('mm.trialStart', String(Date.now() - 25 * {DAY}));"
        ctx, pg, errs = settings(b, port, STORE + d25); pg.wait_for_timeout(300)
        v = pg.inner_html("#view")
        check("store app Settings: no price or Whop link, has Members: sign in", "4.99" not in v and "whop.com" not in v and "Members: sign in" in v, v[:200])
        check("store app: no last-7-days notice", pg.query_selector("#mmTrialNote") is None)
        check("no page errors", not errs, errs[:2]); ctx.close()
        ctx, pg, errs = settings(b, port, NEW + expired); pg.wait_for_timeout(300)
        lock = pg.inner_html("#mmLock") if pg.query_selector("#mmLock") else ""
        check("sideloaded app (not store): lock still shows price + Join", "4.99" in lock and "mml-join" in lock)
        ctx.close()
        for name, init in (("computer/phone", None), ("Samsung", SAM)):
            ctx, pg, errs = settings(b, port, init)
            check(f"{name}: no TV App box", "TV App" not in pg.inner_text("#view")); ctx.close()
        b.close()
    httpd.shutdown()
    print(f"\n{'ALL PASS' if not FAILS else str(len(FAILS)) + ' FAILED'}")
    sys.exit(1 if FAILS else 0)

if __name__ == "__main__":
    main()
