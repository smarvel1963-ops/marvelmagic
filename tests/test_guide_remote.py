# test_guide_remote.py
# Save to: C:\MarvelApps\marvelmagic\tests\test_guide_remote.py
# Scott 11/25: "as you click down guide the cursor square goes all over the place instead of straight down" + "the guide time line is in the channel
# name not out on the guide". Down x20 in the Live TV Guide at TV size: the highlight stays in the same time column when the next row has a box
# there, never sits under the sticky channel names, and the NOW line is never drawn over a channel name.   Run:  python tests\test_guide_remote.py
import functools, http.server, socketserver, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Q, directory=str(ROOT))); httpd.daemon_threads = True
threading.Thread(target=httpd.serve_forever, daemon=True).start(); port = httpd.server_address[1]
ok = bad = 0
def check(c, m):
    global ok, bad
    print(("  PASS  " if c else "  FAIL  ") + m); ok += c; bad += (not c)
STATE = """() => { const e = document.activeElement, r = e.getBoundingClientRect(), g = e.closest('.grid'), ch = g && g.querySelector('.ch').getBoundingClientRect();
  const cov = [...document.querySelectorAll('#ggrid .nowline')].filter(n => n.style.visibility !== 'hidden' && getComputedStyle(n).zIndex * 1 >= getComputedStyle(n.closest('.row').querySelector('.ch')).zIndex * 1 && n.getBoundingClientRect().left < ch.right).length;
  return { grid: !!(g && e.matches('.track .cell')), left: r.left, chr: ch ? ch.right : 0, at: parseFloat(e.style.left) || 0, w: parseFloat(e.style.width) || 0, cov }; }"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1672, "height": 941}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.add_init_script("localStorage.setItem('mm_mine', JSON.stringify(['YouTube TV','Netflix','Hulu'])); localStorage.setItem('mm_setup', JSON.stringify(['YouTube TV','Netflix','Hulu']));")
    pg.goto(f"http://127.0.0.1:{port}/index.html?tv=1"); pg.wait_for_timeout(3000)
    pg.evaluate("showTab(0)"); pg.wait_for_timeout(6000)
    n = pg.evaluate("document.querySelectorAll('#ggrid .track .cell').length")
    check(n > 20, f"guide has boxes ({n})")
    pg.evaluate("document.querySelector('#ggrid .track .cell').focus()")
    pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(150)
    a = pg.evaluate(STATE); anchor = a["at"] + 0.01; jumps = under = 0
    for i in range(20):
        pg.keyboard.press("ArrowDown"); pg.wait_for_timeout(120); s = pg.evaluate(STATE)
        if not s["grid"]: break
        if s["left"] < s["chr"] - 1: under += 1
        if not (s["at"] <= anchor < s["at"] + s["w"]) and abs(s["at"] - anchor) > 30: jumps += 1
        if s["cov"]: under += 100
    check(under == 0, "highlight never under the channel names, NOW line never over them")
    check(jumps == 0, "Down stays in the same time column")
    pg.keyboard.press("ArrowUp"); pg.wait_for_timeout(120)
    check(pg.evaluate(STATE)["grid"], "Up stays in the guide")
    check(not errs, f"no page errors ({errs[:1]})")
    b.close()
httpd.shutdown(); print(f"\n{ok} passed, {bad} failed"); sys.exit(1 if bad else 0)
