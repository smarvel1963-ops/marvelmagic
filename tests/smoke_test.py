# smoke_test.py
# Save to: C:\MarvelApps\marvelmagic\tests\smoke_test.py
# Marvel Magic smoke test (sell-readiness pass, 2026-11-15).
# Serves the app folder on localhost, opens it in headless Chromium at TV/PC size (1672x941) and phone size (390 wide),
# visits every tab (0-10) and fails on any JavaScript error the page throws, or a tab that draws an empty page.
# Network errors from outside sites (ESPN blocks localhost, TVmaze rate limits) are reported but do not fail the run:
# this checks OUR code, not their uptime.
# Run:  python tests\smoke_test.py            (exit 0 = pass)
#       python tests\smoke_test.py --shots    (also saves a screenshot per tab to tests\shots\)
import http.server, socketserver, sys, threading, functools
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
TABS = ['Live TV Guide', 'Movies & Shows', 'Sports', 'My Stuff', 'Free TV', 'My Ratings', 'Watched', 'Home',
        'Coming Soon', 'For You', 'Settings']
SIZES = {'tv': (1672, 941), 'phone': (390, 844)}


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    httpd = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


def run(shots=False):
    httpd, port = serve()
    url = f'http://127.0.0.1:{port}/index.html'
    failures, notes = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for size_name, (w, h) in SIZES.items():
            page = browser.new_page(viewport={'width': w, 'height': h})
            errors = []
            page.on('pageerror', lambda e, errors=errors: errors.append(str(e)))
            page.on('console', lambda m: m.type == 'error' and notes.append(f'[{size_name}] console: {m.text[:160]}'))
            page.goto(url, wait_until='load')
            page.wait_for_timeout(2500)
            if not page.evaluate("typeof showTab === 'function'"):
                failures.append(f'[{size_name}] app did not start (showTab missing)')
                page.close()
                continue
            for n, name in enumerate(TABS):
                before = len(errors)
                page.evaluate(f'showTab({n})')
                page.wait_for_timeout(700)
                text_len = page.evaluate("document.body.innerText.trim().length")
                for e in errors[before:]:
                    failures.append(f'[{size_name}] tab {n} {name}: JS error: {e[:300]}')
                if text_len < 40:
                    failures.append(f'[{size_name}] tab {n} {name}: page is empty ({text_len} chars)')
                if shots:
                    out = ROOT / 'tests' / 'shots'
                    out.mkdir(exist_ok=True)
                    page.screenshot(path=str(out / f'{size_name}_{n:02d}.png'))
            for e in errors:   # errors thrown during start-up, before any tab was visited
                if not any(f.startswith(f'[{size_name}]') and e[:300] in f for f in failures):
                    failures.append(f'[{size_name}] start-up JS error: {e[:300]}')
            page.close()
        browser.close()
    httpd.shutdown()
    for n in sorted(set(notes))[:15]:
        print('note', n)
    if failures:
        print(f'FAIL - {len(failures)} problem(s):')
        for f in failures:
            print('  ', f)
        return 1
    print(f'PASS - {len(TABS)} tabs x {len(SIZES)} sizes, no JavaScript errors')
    return 0


if __name__ == '__main__':
    sys.exit(run(shots='--shots' in sys.argv))
