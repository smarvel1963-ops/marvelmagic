# test_guide_pages.py
# Save to: C:\MarvelApps\marvelmagic\tests\test_guide_pages.py
# GUIDE IN PAGES (Scott 11/27: "load a page and while looking and moving down it load next page only that way it smaller batches and way faster").
#   1. the guide draws GPAGE (25) channel rows at first, with a page marker under them;
#   2. the remote walks straight past the last drawn row - the next page is drawn and the highlight steps into it, one row per press;
#   3. scrolling near the marker draws the next page too; the guide keeps its place down the channels when it redraws;
#   4. clock() (one shared time formatter since 11/27) gives the same text as toLocaleTimeString.
# Run:  python tests\test_guide_pages.py     (exit 0 = pass)
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
ROWI = "(() => { const r = document.activeElement.closest('#ggrid > .row'); return r ? [...document.querySelectorAll('#ggrid > .row')].indexOf(r) : -1; })()"
NROWS = "document.querySelectorAll('#ggrid > .row').length"

def main():
    httpd, port = serve()
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1600, "height": 900}, user_agent="Mozilla/5.0 MarvelMagicTV"); ctx.add_init_script(SEED)
        pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(f"http://127.0.0.1:{port}/index.html?tv=1"); pg.wait_for_timeout(1500)
        pg.evaluate("showTab(0)"); pg.wait_for_function("document.querySelectorAll('#ggrid > .row').length > 10", timeout=30000); pg.wait_for_timeout(3000)
        total = pg.evaluate("Number((document.querySelector('.gbar .fine') || {}).textContent.match(/(\d+) channel/)?.[1] || 0)")
        n0 = pg.evaluate(NROWS)
        check("the guide starts with one page of rows", n0 == min(25, total) or (total <= 25 and n0 == total), (n0, total))
        if total > 25:
            check("a page marker sits under the last drawn row", pg.evaluate("!!document.querySelector('#ggrid > .gsent')"))
            pg.evaluate("document.querySelector('#ggrid .track .cell').focus()")
            pg.evaluate("window.__draws = 0; const d0 = draw; draw = function () { window.__draws++; return d0.apply(this, arguments); }; window.__ys = []; document.getElementById('ggrid').addEventListener('scroll', e => __ys.push(e.target.scrollTop), { passive: true })")
            for _ in range(30): pg.keyboard.press("ArrowDown"); pg.wait_for_timeout(120)
            pg.wait_for_timeout(500)
            check("the remote walks past the first page, one row per press", pg.evaluate(ROWI) == 30, pg.evaluate(ROWI))
            check("...and the next page was drawn", pg.evaluate(NROWS) > 25, pg.evaluate(NROWS))
            check("the next page is ADDED - the guide is not redrawn (11/27 'bounces around')", pg.evaluate("__draws") == 0, pg.evaluate("__draws"))
            check("...so the guide only ever moves down while you go down (no jumping back)", pg.evaluate("__ys.every((y, i) => i === 0 || y >= __ys[i - 1] - 2)"), pg.evaluate("__ys.slice(0, 40)"))
            check("...and every added row's channel name sits on its row", pg.evaluate("(() => { const g = document.getElementById('ggrid'), rs = [...g.querySelectorAll(':scope > .row')], ks = g.querySelector(':scope > .chcol').children; return rs.length === ks.length && rs.slice(24, 30).every((r, i) => Math.abs(r.getBoundingClientRect().top - ks[24 + i].getBoundingClientRect().top) <= 1); })()"))
            pg.evaluate("draw = window.__d0 || draw")
            y = pg.evaluate("document.getElementById('ggrid').scrollTop")
            pg.evaluate("draw()"); pg.wait_for_timeout(200)
            check("a redraw keeps the guide's place down the channels", abs(pg.evaluate("document.getElementById('ggrid').scrollTop") - y) <= 2)
            pg.evaluate("showTab(7)"); pg.evaluate("showTab(0)"); pg.wait_for_timeout(500)
            check("opening the guide again starts at one page", pg.evaluate(NROWS) == 25, pg.evaluate(NROWS))
            pg.evaluate("const g = document.getElementById('ggrid'); g.scrollTop = g.scrollHeight"); pg.wait_for_timeout(800)
            check("scrolling to the marker draws the next page", pg.evaluate(NROWS) > 25, pg.evaluate(NROWS))
        same = pg.evaluate("[0, 7, 13, 19, 23.99].every(h => { const d = new Date(2026, 10, 27, Math.floor(h), Math.round((h % 1) * 60)); return clock(d) === d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); })")
        check("clock() gives the same time text as before", same)
        check("no page errors", not errs, errs[:2])
        b.close()
    httpd.shutdown()
    print("ALL PASS" if not FAILS else f"{len(FAILS)} FAILED: " + "; ".join(FAILS))
    sys.exit(1 if FAILS else 0)

if __name__ == "__main__":
    main()
