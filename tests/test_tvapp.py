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
        for name, init in (("computer/phone", None), ("Samsung", SAM)):
            ctx, pg, errs = settings(b, port, init)
            check(f"{name}: no TV App box", "TV App" not in pg.inner_text("#view")); ctx.close()
        b.close()
    httpd.shutdown()
    print(f"\n{'ALL PASS' if not FAILS else str(len(FAILS)) + ' FAILED'}")
    sys.exit(1 if FAILS else 0)

if __name__ == "__main__":
    main()
