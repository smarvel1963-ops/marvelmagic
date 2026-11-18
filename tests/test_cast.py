# test_cast.py
# Save to: C:\MarvelApps\marvelmagic\tests\test_cast.py
# One-tap Cast (Scott 11/18, Google Cast app 697A9867). No Chromecast needed: both Google scripts are swapped for small fakes.
#  SENDER  (index.html as Chrome on an Android tablet): Cast to TV asks Chrome's picker; a started session sends the household seed,
#          shows the remote, the arrows/OK/Back/Home send the bridge messages, an 'open' from the TV shows a Watch button.
#          Picker cancelled = nothing; no Cast device / unpublished app = the per-device steps. Safari iPad = steps, no Cast script.
#  RECEIVER (receiver.html as the Chromecast): seed is written (only mm_ keys) and the app frame opens in TV mode; remote keys move
#          focus inside the frame; a title opened in the frame is sent back to the tablet.
# Run:  python tests\test_cast.py   (exit 0 = pass)
import sys, json, http.server, socketserver, threading, functools
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
TAB_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
IPAD_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'

SENDER_FAKE = """
window.__sent = []; window.__picker = window.__pickerResult || 'ok';
(function(){
  const listeners = [], msgL = {};
  const session = { sendMessage: (ns, m) => { window.__sent.push(m); return Promise.resolve(); },
                    addMessageListener: (ns, f) => { msgL[ns] = f; } };
  let cur = null;
  const ctx = { setOptions: o => { window.__opts = o; }, addEventListener: (t, f) => listeners.push(f),
    getCurrentSession: () => cur,
    requestSession: () => { if (window.__picker !== 'ok') return Promise.reject(window.__picker);
      cur = session; listeners.forEach(f => f({ sessionState: 'SESSION_STARTED' })); return Promise.resolve(); },
    endCurrentSession: () => { cur = null; listeners.forEach(f => f({ sessionState: 'SESSION_ENDED' })); } };
  window.chrome = window.chrome || {}; chrome.cast = { AutoJoinPolicy: { ORIGIN_SCOPED: 'origin_scoped' } };
  window.cast = { framework: { CastContext: { getInstance: () => ctx }, CastContextEventType: { SESSION_STATE_CHANGED: 'sc' },
    SessionState: { SESSION_STARTED: 'SESSION_STARTED', SESSION_RESUMED: 'SESSION_RESUMED', SESSION_ENDED: 'SESSION_ENDED' } } };
  window.__fromTv = m => msgL['urn:x-cast:com.marvelmagic.remote']('urn:x-cast:com.marvelmagic.remote', JSON.stringify(m));
  setTimeout(() => window.__onGCastApiAvailable && window.__onGCastApiAvailable(true), 0);
})();
"""
RECEIVER_FAKE = """
window.__toSender = [];
(function(){
  let handler = null;
  const ctx = { addCustomMessageListener: (ns, f) => { handler = f; }, start: o => { window.__ropts = o; },
                sendCustomMessage: (ns, id, m) => window.__toSender.push(m) };
  window.cast = { framework: { CastReceiverContext: { getInstance: () => ctx }, CastReceiverOptions: function(){},
                  system: { MessageType: { JSON: 'JSON' } } } };
  window.__fromSender = m => handler({ data: m });
})();
"""


class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def main():
    httpd = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Q, directory=str(ROOT)))
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{httpd.server_address[1]}/'
    ok = fail = 0

    def check(name, cond, extra=''):
        nonlocal ok, fail
        if cond: ok += 1; print('  PASS ', name)
        else: fail += 1; print('  FAIL ', name, extra)

    with sync_playwright() as p:
        b = p.chromium.launch()
        # ---------- sender on an Android tablet (Chrome)
        def sender(picker='ok'):
            ctx = b.new_context(viewport={'width': 800, 'height': 1280}, user_agent=TAB_UA, has_touch=True)
            pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.add_init_script(f"window.__pickerResult = {json.dumps(picker)}; localStorage.setItem('mm_mine', JSON.stringify(['Netflix','Hulu']));")
            pg.route('**/cast_sender.js*', lambda r: r.fulfill(status=200, content_type='application/javascript', body=SENDER_FAKE))
            pg.goto(base + 'index.html'); pg.wait_for_timeout(2000)
            return ctx, pg, errs
        ctx, pg, errs = sender()
        check('Cast app id is set from cast.js', pg.evaluate('window.__opts && window.__opts.receiverApplicationId') == '697A9867')
        pg.click('#castbtn'); pg.wait_for_timeout(300)
        sent = pg.evaluate('window.__sent')
        check('a started session sends the household seed first', sent and 'seed' in sent[0] and 'mm_mine' in sent[0]['seed'], sent[:1])
        check('... seed carries only app keys', all(k.startswith('mm_') or k in ('mm.member', 'mm.trialStart') for k in sent[0]['seed']))
        check('the remote shows and the button says On TV', pg.locator('#castremote').is_visible() and 'On TV' in pg.inner_text('#castbtn'))
        check('no steps popup when casting started', not pg.evaluate("document.getElementById('back').open"))
        for ck, want in (('up', {'mm': 'key', 'dir': 'up'}), ('ok', {'mm': 'key', 'ok': True}), ('back', {'mm': 'back'}), ('home', {'mm': 'tab', 'tab': 7})):
            pg.click(f'[data-ck="{ck}"]'); pg.wait_for_timeout(50)
            check(f'remote {ck} sends {want}', pg.evaluate('window.__sent.at(-1)') == want, pg.evaluate('window.__sent.at(-1)'))
        pg.evaluate("window.__fromTv({mm:'open', url:'https://www.netflix.com/title/80057281', svc:'Netflix'})"); pg.wait_for_timeout(100)
        check('a title picked on the TV shows a Watch button here', 'Watch on Netflix' in pg.inner_text('#crwatch'))
        pg.click('#castbtn'); pg.wait_for_timeout(100)
        check('Cast button while casting hides/shows the remote, no new picker', 'min' in (pg.get_attribute('#castremote', 'class') or ''))
        pg.click('#castbtn'); pg.click('[data-ck="stop"]'); pg.wait_for_timeout(100)
        check('Stop casting removes the remote', pg.locator('#castremote').count() == 0 and 'Cast to TV' in pg.inner_text('#castbtn'))
        check('sender page: no JavaScript errors', not errs, errs[:3])
        ctx.close()
        ctx, pg, errs = sender('cancel'); pg.click('#castbtn'); pg.wait_for_timeout(300)
        check('picker cancelled = nothing pops up', not pg.evaluate("document.getElementById('back').open"))
        ctx.close()
        ctx, pg, errs = sender('receiver_unavailable'); pg.click('#castbtn'); pg.wait_for_timeout(300)
        check('no Cast TV found = the per-device steps', 'Quick Settings' in pg.evaluate("document.getElementById('back').innerText"))
        ctx.close()
        # ---------- iPad Safari: no Google Cast script, steps as before
        ctx = b.new_context(viewport={'width': 820, 'height': 1180}, user_agent=IPAD_UA, has_touch=True)
        pg = ctx.new_page(); loaded = []
        pg.on('request', lambda r: loaded.append(r.url) if 'cast_sender' in r.url else None)
        pg.goto(base + 'index.html'); pg.wait_for_timeout(1500); pg.click('#castbtn'); pg.wait_for_timeout(300)
        check('iPad never loads the Cast script', not loaded, loaded)
        check('iPad gets the AirPlay steps', 'Screen Mirroring' in pg.evaluate("document.getElementById('back').innerText"))
        ctx.close()
        # ---------- receiver (the Chromecast)
        ctx = b.new_context(viewport={'width': 1280, 'height': 720})
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route('**/cast_receiver_framework.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body=RECEIVER_FAKE))
        pg.goto(base + 'receiver.html'); pg.wait_for_timeout(300)
        check('receiver turns off the idle timeout', pg.evaluate('window.__ropts && window.__ropts.disableIdleTimeout') is True)
        pg.evaluate("window.__fromSender({seed: {'mm_mine': JSON.stringify(['Netflix']), 'evil': 'x', 'mm.trialStart': String(Date.now())}})")
        pg.wait_for_timeout(3500)
        check('seed writes app keys only', pg.evaluate("localStorage.getItem('mm_mine')") == '["Netflix"]' and pg.evaluate("localStorage.getItem('evil')") is None)
        fr = pg.frame_locator('#f')
        check('the app opens in TV mode inside the receiver', 'tv=1&cast=1' in pg.get_attribute('#f', 'src') and fr.locator('main').count() > 0)
        frame = [f for f in pg.frames if 'cast=1' in f.url][0]
        check('inside the receiver the app is in TV-app mode (no sign-in / cast button)', frame.evaluate("document.documentElement.classList.contains('tvapp') && MMNative.platform() === 'cast'"))
        pg.evaluate("window.__fromSender({mm:'key', dir:'down'})"); pg.wait_for_timeout(300)
        check('a remote arrow moves focus in the TV app', frame.evaluate("document.activeElement && document.activeElement !== document.body"))
        frame.evaluate("MMNative.open('https://www.hulu.com/watch/x', 'Hulu')"); pg.wait_for_timeout(200)
        check('a title opened on the TV is sent to the tablet', pg.evaluate('window.__toSender.at(-1)') == {'mm': 'open', 'url': 'https://www.hulu.com/watch/x', 'svc': 'Hulu'})
        check('receiver: no JavaScript errors', not errs, errs[:3])
        ctx.close()
        b.close()
    print(f'\n  {ok} passed, {fail} failed')
    return 1 if fail else 0


if __name__ == '__main__':
    sys.exit(main())
