// js/cast.js
// Save to: C:\MarvelApps\marvelmagic\js\cast.js
// ONE-TAP CAST (Scott 11/18: "already have google account we paid for" -> Google Cast app 697A9867, receiver.html).
// In Chrome (Android tablets/phones, computers) the Cast to TV button opens Chrome's own TV picker; the Chromecast / Google TV
// loads receiver.html, which shows Marvel Magic in TV mode with this device's services and lists. This device becomes the remote
// (arrows, OK, Back, Home). A title picked on the TV comes back here as a Watch button - the service plays on this device and its own
// Cast button sends the video (a Chromecast can't run Netflix etc. inside our page).
// Safari / iPad / iPhone / Firefox / Edge have no Google Cast: the button keeps the per-device steps (castHelp in home.js).
// While the Cast app is UNPUBLISHED in the Cast console it only launches on Chromecasts registered there; elsewhere the picker
// fails and the steps show instead. Loaded after app.js. After editing run  python tools\stamp_versions.py  then  python tests\smoke_test.py
const CAST_APP = '697A9867', CAST_NS = 'urn:x-cast:com.marvelmagic.remote';
let castReady = false;
const castCan = () => !inTvApp() && !/[?&](tv|cast|samsung)=1/.test(location.search) && /Chrome\//.test(navigator.userAgent) && !/Edg\/|CriOS|OPR\/|SamsungBrowser|Silk/.test(navigator.userAgent);
const castSession = () => { try { return castReady ? cast.framework.CastContext.getInstance().getCurrentSession() : null; } catch (e) { return null; } };
function castSend(m) { const s = castSession(); if (s) s.sendMessage(CAST_NS, m).catch(() => {}); }
function castSeed() {   // this device's saved household -> the TV (Cast messages max 64 KB; big keys are skipped, never cut in half)
  const seed = {}; let size = 0;
  const keys = Object.keys(localStorage).filter(k => /^mm_/.test(k) || k === 'mm.member' || k === 'mm.trialStart' || k === 'mm.owner')
    .sort((a, b) => (localStorage.getItem(a) || '').length - (localStorage.getItem(b) || '').length);
  for (const k of keys) { const v = localStorage.getItem(k) || ''; if (size + k.length + v.length > 50000) continue; seed[k] = v; size += k.length + v.length; }
  castSend({ seed });
}
function castRemote(on) {
  let r = $('castremote');
  if (!on) { if (r) r.remove(); $('castbtn').textContent = '📺 Cast to TV'; return; }
  $('castbtn').textContent = '📺 On TV';
  if (r) return;
  r = document.createElement('div'); r.id = 'castremote'; r.className = 'castremote';
  r.innerHTML = `<div class="crhead"><b>📺 Remote</b><button data-ck="min" aria-label="Hide the remote">–</button></div>
<div class="crwatch" id="crwatch"></div>
<div class="crpad"><span></span><button data-ck="up" aria-label="Up">▲</button><span></span>
<button data-ck="left" aria-label="Left">◀</button><button data-ck="ok" class="crok">OK</button><button data-ck="right" aria-label="Right">▶</button>
<span></span><button data-ck="down" aria-label="Down">▼</button><span></span></div>
<div class="crrow"><button data-ck="back">↩ Back</button><button data-ck="home">⌂ Home</button></div>
<button class="crstop" data-ck="stop">Stop casting</button>`;
  document.body.appendChild(r);
}
function castOpenOffer(url, svc) {   // the TV picked a title: one tap here plays it (a tap is needed - a tab opened from a message gets blocked)
  const w = $('crwatch'); if (!w || !/^https?:\/\//.test(url)) return;
  w.innerHTML = `<a href="${esc(url)}" target="_blank" rel="noopener" class="btn crgo">▶ Watch${svc ? ' on ' + esc(svc) : ''}</a>`;
  const r = $('castremote'); if (r) r.classList.remove('min');
}
function castPress() {
  const s = castSession();
  if (s) { const r = $('castremote'); if (r) r.classList.toggle('min'); else castRemote(true); return; }
  if (!castReady) { castHelp(); return; }
  cast.framework.CastContext.getInstance().requestSession().catch(err => { if (err !== 'cancel') castHelp(); });
}
window.__onGCastApiAvailable = ok => {
  if (!ok || !window.cast || !cast.framework) return;
  castReady = true;
  const c = cast.framework.CastContext.getInstance();
  c.setOptions({ receiverApplicationId: CAST_APP, autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED });
  c.addEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED, e => {
    const S_ = cast.framework.SessionState;
    if (e.sessionState === S_.SESSION_STARTED || e.sessionState === S_.SESSION_RESUMED) {
      const s = c.getCurrentSession();
      s.addMessageListener(CAST_NS, (ns, msg) => { try { const m = typeof msg === 'string' ? JSON.parse(msg) : msg; if (m && m.mm === 'open') castOpenOffer(m.url, m.svc); } catch (er) {} });
      if (e.sessionState === S_.SESSION_STARTED) castSeed();
      castRemote(true);
    } else if (e.sessionState === S_.SESSION_ENDED) castRemote(false);
  });
};
if (castCan()) { const sc = document.createElement('script'); sc.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1'; sc.async = true; document.head.appendChild(sc); }
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-ck]'); if (!b) return;
  const k = b.dataset.ck;
  if (k === 'min') $('castremote').classList.toggle('min');
  else if (k === 'stop') { try { cast.framework.CastContext.getInstance().endCurrentSession(true); } catch (er) {} castRemote(false); }
  else if (k === 'ok') castSend({ mm: 'key', ok: true });
  else if (k === 'back') castSend({ mm: 'back' });
  else if (k === 'home') castSend({ mm: 'tab', tab: HOME });
  else castSend({ mm: 'key', dir: k });
});
