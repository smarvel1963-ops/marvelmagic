# test_remind.py
# Save to: C:\MarvelApps\marvelmagic\tests\test_remind.py
# REMIND ME ON ANY SHOW (Scott 11/27: "do 6"): picking a guide show that hasn't started gives a "Remind me" button; the show gets a bell in the
# guide; 15 minutes before, Marvel says it in the middle of the screen (TVs have no phone notifications) - even with Marvel switched OFF - with
# Show me (the guide). Pressing the button again takes the reminder off.
# Run:  python tests\test_remind.py     (exit 0 = pass)
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
        b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1600, "height": 900}, user_agent="Mozilla/5.0 MarvelMagicTV"); ctx.add_init_script(SEED)
        pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(f"http://127.0.0.1:{port}/index.html?tv=1"); pg.wait_for_timeout(1500)
        pg.evaluate("showTab(0)"); pg.wait_for_function("document.querySelectorAll('#ggrid > .row').length > 5", timeout=30000); pg.wait_for_timeout(2500)
        # a show that starts later
        idx = pg.evaluate("(() => { const now = Date.now(); const c = [...document.querySelectorAll('#ggrid .track .cell[data-i]')].find(c => { const x = items[Number(c.dataset.i)]; return x && x.start - now > 30 * 60000 && !c.classList.contains('gap'); }); return c ? Number(c.dataset.i) : -1; })()")
        check("the guide has a show that starts later", idx >= 0)
        if idx >= 0:
            key = pg.evaluate(f"items[{idx}].key")
            pg.click(f"#ggrid .cell[data-i='{idx}']"); pg.wait_for_timeout(400)
            btn = pg.query_selector("[data-remind]:visible")
            check("picking it shows Remind me", btn is not None and "Remind me" in btn.inner_text())
            btn.click(); pg.wait_for_timeout(400)
            check("Remind me saves the reminder", pg.evaluate(f"!!S.remind[{key!r}]"))
            check("...the button says Reminder set", "Reminder set" in (pg.inner_text("[data-remind]:visible") if pg.query_selector("[data-remind]:visible") else ""))
            check("...and the show has a bell in the guide", pg.evaluate(f"[...document.querySelectorAll('#ggrid .cell.rem')].some(c => items[Number(c.dataset.i)] && items[Number(c.dataset.i)].key === {key!r})"))
            pg.click(".gpvb [data-remind]"); pg.wait_for_timeout(300)
            check("pressing it again takes the reminder off", pg.evaluate(f"!S.remind[{key!r}]"))
        # due: Marvel says it, even switched OFF (the reminder timer runs every 30 s)
        pg.evaluate("S.remind['test-show'] = { title: 'Test Show', when: Date.now() + 10 * 60000, net: 'AMC', tab: 0 }; save('remind', S.remind); showTab(7)")
        pg.wait_for_function("!!document.querySelector('#mmTip .tipb')", timeout=40000)
        t = pg.inner_text("#mmTip .tipb")
        check("15 minutes before, Marvel says it (with Marvel switched OFF)", "Test Show" in t and "AMC" in t and "reminder" in t.lower(), t[:100])
        check("...with Show me and Got it, no Hush", pg.query_selector("#mmTip [data-tipgo]") is not None and pg.query_selector("#mmTip [data-tiphush]") is None)
        check("...and the reminder is used up", pg.evaluate("!S.remind['test-show']"))
        pg.click("#mmTip [data-tipgo]"); pg.wait_for_timeout(400)
        check("Show me opens the guide; Marvel stays OFF", pg.evaluate("S.tab") == 0 and pg.evaluate("document.getElementById('mmTip').hidden"))
        check("no page errors", not errs, errs[:2])
        b.close()
    httpd.shutdown()
    print("ALL PASS" if not FAILS else f"{len(FAILS)} FAILED: " + "; ".join(FAILS))
    sys.exit(1 if FAILS else 0)

if __name__ == "__main__":
    main()
