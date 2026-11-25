# test_tipster.py
# Save to: C:\MarvelApps\marvelmagic\tests\test_tipster.py
# Marvel the Tipster (js/tipster.js, Scott 11/25 "build tipster"). Serves the app on localhost with every outside site blocked, sets the
# clock, and checks: day 1 says hello once; Got it holds him till tomorrow; day 2 is the next lesson and Show me opens its page; his outfit
# follows the page; Hush turns him off and Settings turns him back on; Kids Lock and the lock screen keep him quiet; Thanksgiving week wears
# the Thanksgiving outfit and the day itself says Happy Thanksgiving; a title leaving your service in 2 days is said once; the remote's
# arrows skip his corner picture; the bubble fits a phone; holiday dates are right; no page errors.
# Run:  python tests\test_tipster.py          (exit 0 = pass)    --shots saves tests\shots\tip_*.png
import sys, datetime
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
from smoke_test import serve

FAILS = []
def check(name, ok, extra=""):
    print(("  PASS  " if ok else "  FAIL  ") + name + ("" if ok else f"  {extra}"))
    if not ok: FAILS.append(name)

def at(y, m, d, h=12):
    return datetime.datetime(y, m, d, h, 0, 0)

def open_app(b, port, when, size=(1672, 941), seed=""):
    ctx = b.new_context(viewport={"width": size[0], "height": size[1]})
    ctx.route(lambda u: not u.startswith(f"http://127.0.0.1:{port}"), lambda r: r.abort())
    if seed: ctx.add_init_script(seed)
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.clock.install(time=when)
    pg.goto(f"http://127.0.0.1:{port}/index.html", wait_until="domcontentloaded")
    return ctx, pg, errs

def wait_tip(pg, ms=9000):
    pg.clock.run_for(ms)
    pg.wait_for_timeout(300)
    return pg.evaluate("(() => { const b = document.querySelector('#mmTip .tipb'); return b ? b.innerText : ''; })()")

def corner(pg):
    return pg.evaluate("(() => { const m = document.querySelector('#mmTip .tipme'); return m ? m.style.backgroundImage : ''; })()")

def main():
    shots = "--shots" in sys.argv
    sd = Path(__file__).parent / "shots"
    httpd, port = serve()
    with sync_playwright() as p:
        b = p.chromium.launch()

        print("\n[dates]")
        ctx, pg, errs = open_app(b, port, at(2026, 11, 10))
        check("Thanksgiving 2026 is Nov 26", pg.evaluate("tipThanks(2026).toDateString()") == "Thu Nov 26 2026")
        check("Easter 2027 is Mar 28", pg.evaluate("tipEaster(2027).toDateString()") == "Sun Mar 28 2027")
        check("no holiday on Nov 10", pg.evaluate("tipHoliday(new Date(2026,10,10))") is None)
        check("Christmas week has the Christmas outfit", pg.evaluate("tipHoliday(new Date(2026,11,20)).art") == "christmas")

        print("\n[day 1 - a new device]")
        check("nothing in the first 6 seconds", wait_tip(pg, 3000) == "")
        t = wait_tip(pg, 9000)
        check("then one hello", "I’m Marvel" in t and "Hush" in t, t[:120])
        pg.wait_for_timeout(500)
        check("his picture loads", pg.evaluate("(() => { const i = document.querySelector('#mmTip .tipb img'); return !!i && i.complete && i.naturalWidth > 0; })()"))
        check("the wizard outfit on Home", "hello.webp" in corner(pg), corner(pg))
        check("the remote's arrows skip his corner picture", not pg.evaluate("focusables().some(e => e.closest('#mmTip .tipme'))"))
        check("the tip's buttons can be reached by the remote", pg.evaluate("focusables().some(e => e.matches('#mmTip [data-tipok]'))"))
        if shots: pg.screenshot(path=str(sd / "tip_tv_hello.png"))
        pg.click("#mmTip [data-tipok]")
        check("Got it closes it; the small Marvel stays", pg.query_selector("#mmTip .tipb") is None and pg.query_selector("#mmTip.small .tipme") is not None)
        check("no second tip the same day", wait_tip(pg, 60000) == "")
        check("no page errors", not errs, errs[:2])
        state = pg.evaluate("localStorage.getItem('mm_tipster')")
        ctx.close()

        print("\n[day 2]")
        keep = f"localStorage.setItem('mm_tipster', {state!r});"
        ctx, pg, errs = open_app(b, port, at(2026, 11, 11), seed=keep)
        t = wait_tip(pg)
        check("the next lesson: the Live TV Guide", "Live TV Guide" in t, t[:120])
        pg.click("#mmTip [data-tipgo]")
        pg.wait_for_timeout(300)
        check("Show me opens the guide", pg.evaluate("S.tab") == 0)
        check("Streaming Helper outfit on the guide", "streamer.webp" in corner(pg), corner(pg))
        pg.evaluate("showTab(2)"); pg.wait_for_timeout(200)
        check("Commentator outfit on Sports", "commentator.webp" in corner(pg), corner(pg))
        pg.evaluate("showTab(1)"); pg.wait_for_timeout(200)
        check("Director outfit on Movies & Shows", "director.webp" in corner(pg), corner(pg))
        pg.click("#mmTip .tipme"); pg.wait_for_timeout(200)
        check("tapping Marvel brings a tip any time", pg.query_selector("#mmTip .tipb") is not None)
        pg.click("#mmTip [data-tiphush]"); pg.wait_for_timeout(200)
        check("Hush: Marvel is gone", pg.evaluate("document.getElementById('mmTip').hidden"))
        pg.evaluate("showTab(10)"); pg.wait_for_timeout(300)
        check("Settings offers to turn him back on", pg.query_selector("[data-tipwake]") is not None)
        pg.click("[data-tipwake]"); pg.wait_for_timeout(200)
        check("and he's back", not pg.evaluate("document.getElementById('mmTip').hidden") and pg.query_selector("[data-tipshow]") is not None)
        check("no page errors", not errs, errs[:2]); ctx.close()

        print("\n[quiet times]")
        ctx, pg, errs = open_app(b, port, at(2026, 11, 10), seed="localStorage.setItem('mm_kids', JSON.stringify({on: true, pin: '1234'}));")
        wait_tip(pg)
        check("Kids Lock on: no Marvel at all", pg.evaluate("(() => { const e = document.getElementById('mmTip'); return !e || e.hidden; })()"))
        ctx.close()
        ctx, pg, errs = open_app(b, port, at(2026, 11, 10), seed=f"localStorage.setItem('mm.trialStart', String({int(at(2026, 10, 1).timestamp() * 1000)}));")
        check("lock screen up: no tip over it", pg.query_selector("#mmLock") is not None and wait_tip(pg) == "")
        ctx.close()

        print("\n[Thanksgiving]")
        done = "localStorage.setItem('mm_tipster', JSON.stringify({on: true, day: '', said: {'l-hello': 1}, n: 1}));"
        ctx, pg, errs = open_app(b, port, at(2026, 11, 25), seed=done)
        t = wait_tip(pg)
        check("the day before: Thanksgiving outfit, a normal tip", "thanksgiving.webp" in corner(pg) and t and "Thanksgiving" not in t, corner(pg) + " | " + t[:80])
        ctx.close()
        ctx, pg, errs = open_app(b, port, at(2026, 11, 26), seed=done)
        t = wait_tip(pg)
        check("the day itself: Happy Thanksgiving", "Happy Thanksgiving" in t and "thanksgiving.webp" in pg.evaluate("document.querySelector('#mmTip .tipb img').src"), t[:120])
        if shots: pg.screenshot(path=str(sd / "tip_tv_thanksgiving.png"))
        ctx.close()

        print("\n[something leaving your service]")
        ctx, pg, errs = open_app(b, port, at(2026, 11, 10), seed=done)
        pg.clock.run_for(2000)
        r = pg.evaluate("""(() => { S.mine = ['Netflix']; LEAVING = [{ id: 'x1', title: 'Test Movie', img: 'icon-192.png', svc: 'Netflix', leave: '2026-11-12', type: 'movie', genres: [] }];
            const a = tipPick(tipState()); const st = tipState(); st.said[a[0]] = 1; return [a[2], (tipPick(st) || [])[0]]; })()""")
        check("a title leaving in 2 days comes first", "Test Movie" in r[0] and "in 2 days" in r[0], r[0])
        check("and is said only once", r[1] != "leave-x1-Netflix", r[1])
        ctx.close()

        print("\n[phone]")
        ctx, pg, errs = open_app(b, port, at(2026, 11, 10), size=(390, 844))
        wait_tip(pg)
        box = pg.evaluate("(() => { const r = document.querySelector('#mmTip').getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom]; })()")
        check("the bubble fits a phone screen", box[0] >= 0 and box[1] <= 390 and box[2] >= 0 and box[3] <= 844, box)
        over = pg.evaluate("(() => { const t = document.getElementById('mmTip').getBoundingClientRect(); return ['nav', 'castbtn'].filter(id => { const e = document.getElementById(id); if (!e) return false; const r = e.getBoundingClientRect(); return !(r.bottom <= t.top || r.top >= t.bottom || r.right <= t.left || r.left >= t.right); }); })()")
        check("it sits above the phone's menu bar and the Cast button", not over, over)
        if shots: pg.screenshot(path=str(sd / "tip_phone.png"))
        check("no page errors", not errs, errs[:2]); ctx.close()
        b.close()
    httpd.shutdown()
    print(f"\n{'ALL PASS' if not FAILS else str(len(FAILS)) + ' FAILED: ' + ', '.join(FAILS)}")
    sys.exit(1 if FAILS else 0)

if __name__ == "__main__":
    main()
