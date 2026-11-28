# test_push_ui.py
# Save to: C:\MarvelApps\marvelmagic\tests\test_push_ui.py
# ALERTS WHEN CLOSED - the app side (js/push.js, sw.js): Settings -> Alerts explains / offers it; the sync carries the device addresses and
# reminders to the account; sw.js shows a push and a tap opens its page; ?tab=N opens that page; the TV app doesn't offer it.
# (A real browser push subscription needs Google's push service, which headless test browsers don't have - tools/push_send.py's real send
#  was checked against a local endpoint on 11/27; tests/test_push_send.py covers what gets sent.)
# Run:  python tests\test_push_ui.py     (exit 0 = pass)
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
from smoke_test import serve
ROOT = Path(__file__).resolve().parent.parent

FAILS = []
def check(name, ok, extra=""):
    print(("  PASS  " if ok else "  FAIL  ") + name + ("" if ok else f"  {extra}"))
    if not ok: FAILS.append(name)

def main():
    sw, app, core = (ROOT / 'sw.js').read_text(encoding='utf-8'), (ROOT / 'js/app.js').read_text(encoding='utf-8'), (ROOT / 'js/core.js').read_text(encoding='utf-8')
    check("sw.js shows an arriving alert", "addEventListener('push'" in sw and 'showNotification' in sw)
    check("sw.js opens the alert's page when tapped", "notificationclick" in sw and "?tab=" in sw)
    check("the account sync carries device addresses + reminders", app.count('pushSubs: S.pushSubs') == 2 and app.count('remind: S.remind') == 2)
    check("saving reminders / addresses triggers a sync", "'remind', 'pushSubs']" in core)
    httpd, port = serve()
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 390, "height": 844}); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(f"http://127.0.0.1:{port}/index.html?tab=3"); pg.wait_for_timeout(2500)
        check("?tab=3 (a tapped new-episode alert) opens My Stuff", pg.evaluate("S.tab") == 3, pg.evaluate("S.tab"))
        pg.evaluate("showTab(10)"); pg.wait_for_timeout(500)
        t = pg.inner_text("main")
        check("Settings -> Alerts offers alerts when closed", "Alerts when Marvel Magic is closed" in t)
        check("...and says what's needed on this browser (local test = not https)", "can’t get alerts while closed" in t or "Sign in with Google" in t)
        check("this device has its own id", pg.evaluate("typeof pushDev === 'string' && pushDev.length > 6"))
        check("no page errors", not errs, errs[:2])
        tv = b.new_page(viewport={"width": 1600, "height": 900}, user_agent="Mozilla/5.0 MarvelMagicTV")
        tv.add_init_script("window.MMNative = { platform: () => 'firetv', open(){}, has: () => true, version: () => '1.7' };")
        tv.goto(f"http://127.0.0.1:{port}/index.html?tv=1"); tv.wait_for_timeout(2500); tv.evaluate("showTab(10)"); tv.wait_for_timeout(500)
        check("the TV app doesn't offer phone alerts (Marvel says reminders there)", "Marvel says your reminders on screen" in tv.inner_text("main"))
        b.close()
    httpd.shutdown()
    print("ALL PASS" if not FAILS else f"{len(FAILS)} FAILED: " + "; ".join(FAILS))
    sys.exit(1 if FAILS else 0)

if __name__ == "__main__":
    main()
