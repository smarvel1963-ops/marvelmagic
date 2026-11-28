# test_guide_smooth.py
# Save to: C:\MarvelApps\marvelmagic\tests\test_guide_smooth.py
# Smooth guide (Scott 11/25: "flow down the huge guide soft and smooth no lag or chops"). Guards the three fixes:
#   1. no page background is background-attachment:fixed (it repainted the whole page every scroll frame);
#   2. each guide grid has ONE channel column (core.js chColumns) instead of a sticky box per row, and it stays put when the grid slides;
#   3. a remote Down press in the guide runs at most a few page layouts (it was ~37: the NOW lines were read + written row by row),
#      and placing the column is not a layout per row (each of the ~19 redraws while listings arrive paid that).
# Run:  python tests\test_guide_smooth.py     (exit 0 = pass)
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
from smoke_test import serve

FAILS = []
def check(name, ok, extra=""):
    print(("  PASS  " if ok else "  FAIL  ") + name + ("" if ok else f"  {extra}"))
    if not ok: FAILS.append(name)

SVC = "['YouTube TV','Sling Orange','Peacock','Netflix']"
SEED = f"localStorage.setItem('mm_mine', JSON.stringify({SVC})); localStorage.setItem('mm_setup', JSON.stringify({SVC})); localStorage.setItem('mm_tipster', JSON.stringify({{on:false}}));"

def main():
    httpd, port = serve()
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1672, "height": 941}); ctx.add_init_script(SEED)
        pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(f"http://127.0.0.1:{port}/index.html", wait_until="domcontentloaded"); pg.wait_for_timeout(1500)
        pg.evaluate("showTab(0)")
        pg.wait_for_function("document.querySelectorAll('#ggrid > .row').length > 10", timeout=30000)
        pg.wait_for_timeout(500)
        fixed = pg.evaluate("[document.documentElement, document.body, ...document.querySelectorAll('.app, main')].filter(e => getComputedStyle(e).backgroundAttachment.includes('fixed')).map(e => e.tagName)")
        check("no fixed page background (whole-page repaint on scroll)", not fixed, fixed)
        r = pg.evaluate("""(() => { const g = document.getElementById('ggrid');
            return { cols: g.querySelectorAll(':scope > .chcol').length, rows: g.querySelectorAll(':scope > .row').length, boxes: g.querySelectorAll('.chcol > .ch').length,
                     sticky: [...g.querySelectorAll('.ch')].filter(e => getComputedStyle(e).position === 'sticky').length }; })()""")
        check("one channel column over the rows", r["cols"] == 1 and r["boxes"] == r["rows"], r)
        check("no sticky box per row", r["sticky"] == 0, r)
        pg.evaluate("document.getElementById('ggrid').scrollIntoView(); document.getElementById('ggrid').scrollLeft = 400"); pg.wait_for_timeout(300)
        off = pg.evaluate("Math.round(document.querySelector('#ggrid .chcol .ch').getBoundingClientRect().left - document.getElementById('ggrid').getBoundingClientRect().left)")
        check("the channel names stay put when the guide slides sideways", abs(off) <= 1, off)
        tops = pg.evaluate("[...document.querySelectorAll('#ggrid > .row')].slice(0, 5).map((r, i) => Math.round(r.getBoundingClientRect().top - document.querySelectorAll('#ggrid .chcol > .ch')[i].getBoundingClientRect().top))")
        check("each name sits on its own row", all(abs(t) <= 1 for t in tops), tops)
        cdp = ctx.new_cdp_session(pg); cdp.send("Performance.enable")
        def lc(): return {x["name"]: x["value"] for x in cdp.send("Performance.getMetrics")["metrics"]}["LayoutCount"]
        # 11/27: best of 3 - a listing that lands during one measurement adds its own layout (failed 1 run in 5)
        place = 99
        for _ in range(3):
            a = lc(); pg.evaluate("chPlace(document.getElementById('ggrid'))"); place = min(place, lc() - a); pg.wait_for_timeout(150)
        check("placing the column is one read + one write (not a layout per row)", place <= 2, place)
        for _ in range(20):   # wait until the listings stop arriving (each one redraws the guide)
            a = lc(); pg.wait_for_timeout(700)
            if lc() - a == 0: break
        pg.evaluate("document.getElementById('ggrid').scrollLeft = 0; window.scrollTo(0,0); document.querySelector('#ggrid .track .cell').focus()"); pg.wait_for_timeout(300)
        m0 = {x["name"]: x["value"] for x in cdp.send("Performance.getMetrics")["metrics"]}
        pg.evaluate("(async () => { for (let i = 0; i < 10; i++) { moveFocus('down'); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); } })()")
        m1 = {x["name"]: x["value"] for x in cdp.send("Performance.getMetrics")["metrics"]}
        per = (m1["LayoutCount"] - m0["LayoutCount"]) / 10
        check("a remote Down press runs only a few layouts", per <= 6, round(per, 1))
        check("no page errors", not errs, errs[:2])
        b.close()
    httpd.shutdown()
    print(f"\n{'ALL PASS' if not FAILS else str(len(FAILS)) + ' FAILED: ' + ', '.join(FAILS)}")
    sys.exit(1 if FAILS else 0)

if __name__ == "__main__":
    main()
