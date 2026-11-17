// js/app.js
// Save to: C:\MarvelApps\marvelmagic\js\app.js
// Marvel Magic - remote control keys, account + sync (Firebase), self-update, service worker.
// Split out of index.html 2026-11-15 (sell-readiness pass). Plain script, shared global scope, loaded in order:
// core -> guide -> sports -> home -> app. After editing, run  python tools\stamp_versions.py  then  python tests\smoke_test.py

function focusables() {
  const box = $('back').open ? $('back') : document;
  return [...box.querySelectorAll('button:not([disabled]),a[href],input,select')].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
}
function moveFocus(dir) {
  const all = focusables(), cur = document.activeElement;
  if (!all.includes(cur)) { const start = document.querySelector('main button:not([disabled]),main a[href],main input') || all[0]; if (start) start.focus(); return; }
  const r = cur.getBoundingClientRect(); let best = null, bestScore = Infinity;
  for (const e of all) {
    if (e === cur) continue;
    const c = e.getBoundingClientRect();
    const gap = dir === 'right' ? c.left - r.right : dir === 'left' ? r.left - c.right : dir === 'down' ? c.top - r.bottom : r.top - c.bottom;
    if (gap < -3) continue;
    const across = dir === 'left' || dir === 'right' ? Math.max(0, c.top - r.bottom, r.top - c.bottom) : Math.max(0, c.left - r.right, r.left - c.right);
    const side = x => x.closest('.wmain') ? 1 : x.closest('.wside') ? 2 : 0, ca = side(cur), cb = side(e);
    const score = Math.max(0, gap) + across * 4 + ((dir === 'up' || dir === 'down') && ca && cb && ca !== cb ? 5000 : 0);
    if (score < bestScore) { bestScore = score; best = e; }
  }
  if (!best) return;
  best.focus({ preventScroll: true });
  if (best.closest('main')) best.scrollIntoView({ block: 'center', inline: 'nearest' });
}
function goBack() {
  if ($('back').open) { $('back').close(); return; }
  if (S.sel) { S.sel = null; const y = window.scrollY; draw(); window.scrollTo(0, y); return; }
  if (S.mlAll) { S.mlAll = null; draw(); window.scrollTo(0, 0); return; }   // a full movie list, See all (catalogs.js)
  history.back();
}
const KEY_DIR = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
document.addEventListener('keydown', e => {
  const typing = e.target.matches && e.target.matches('input:not([type=checkbox])');
  if (KEY_DIR[e.key]) {
    if (typing && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
    e.preventDefault(); moveFocus(KEY_DIR[e.key]); return;
  }
  if (e.key === 'Enter' && e.target.matches && e.target.matches('input[type=checkbox]')) { e.preventDefault(); e.target.click(); return; }
  if (e.keyCode === 10009 && window.MMNative && MMNative.platform && MMNative.platform() === 'samsung') {   // Samsung remote Back: a step back; on Home the Samsung app closes (Samsung's rule)
    e.preventDefault(); if (!window.mmBack()) window.parent.postMessage({ mm: 'backed', handled: false }, '*'); return; }
  if (['Escape', 'GoBack', 'BrowserBack', 'MediaRewind', 'XF86Back'].includes(e.key) || e.keyCode === 461 || e.keyCode === 10009 || (e.key === 'Backspace' && !typing)) { e.preventDefault(); goBack(); return; }   // 10009 / XF86Back = Samsung TV remote Back
  if (['GoForward', 'BrowserForward', 'MediaFastForward'].includes(e.key)) { e.preventDefault(); history.forward(); }
});
function showTab(n) { if (n === 2 && kidsOn()) n = HOME; if (n === 8 || n === 9) loadPool(); S.tab = n; save('tab', n); S.sel = null; draw(); window.scrollTo(0, 0); if (n === 3 || n === HOME) loadEps(); }
window.addEventListener('popstate', e => showTab(e.state && e.state.tab != null ? e.state.tab : HOME));
history.replaceState({ tab: S.tab }, '');
// ACCOUNT + SYNC (Scott 11/08: "these should all run independently to just the owner of account"). One Google sign-in per person. Their services, watchlist and
// progress live at users/{their id} in Firebase project marvel-magic; the published rules let only that person read or write it. No streaming passwords, ever.
const FB = { apiKey: 'AIzaSyBt4N4ZOkvcY6slHCbmcrWoz4Q_R7ITmOA', authDomain: 'marvel-magic.firebaseapp.com', projectId: 'marvel-magic', storageBucket: 'marvel-magic.firebasestorage.app', messagingSenderId: '282622101673', appId: '1:282622101673:web:cc2322ae12d2b1487381b8' };
let auth = null, db = null, me = null, stopWatch = null, syncTimer = null, lastCloud = '';
const cloudJson = () => JSON.stringify({ mine: S.mine, list: S.list, setup: S.setup, ratings: S.ratings, rank: S.rank, opens: S.opens, teams: S.teams, history: S.history, likes: S.likes, actors: S.actors, moods: S.moods, profile: S.profile, order: S.order, lastOpen: S.lastOpen, svcSince: S.svcSince, svcSnooze: S.svcSnooze, svcRemindOff: S.svcRemindOff, later: S.later, profiles: S.profiles, svcRate: S.svcRate });
function queueSync() { if (!me || !db || S.prof) return; clearTimeout(syncTimer); syncTimer = setTimeout(pushCloud, 800); }
function pushCloud() { pushOwnerMirror(); if (me && db && me.isAnonymous) { if (S.paired) db.collection('households').doc(S.paired.hid).collection('profiles').doc(S.paired.pid).set({ ...pick(), at: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {}); return; } if (!me || !db || S.prof) return; const j = cloudJson(); if (j === lastCloud) return; lastCloud = j; db.collection('users').doc(me.uid).set({ mine: S.mine, list: S.list, setup: S.setup, ratings: S.ratings, rank: S.rank, opens: S.opens, teams: S.teams, history: S.history, likes: S.likes, actors: S.actors, moods: S.moods, profile: S.profile, order: S.order, lastOpen: S.lastOpen, svcSince: S.svcSince, svcSnooze: S.svcSnooze, svcRemindOff: S.svcRemindOff, later: S.later, profiles: S.profiles, svcRate: S.svcRate, at: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => { lastCloud = ''; }); }
function drawAcct() { const b = $('acct'); if (!auth || S.paired || (me && me.isAnonymous)) { b.hidden = true; return; } b.hidden = false; b.textContent = me ? 'Sign out ' + ((me.displayName || me.email || '').split(' ')[0]) : 'Sign in with Google'; }
async function acctPress() {
  if (me) { auth.signOut(); return; }
  const p = new firebase.auth.GoogleAuthProvider();
  try { await auth.signInWithPopup(p); }
  catch (e) { if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) auth.signInWithRedirect(p); }
}
function mergeLists(cloud, local) {   // first sign-in on a device: keep shows from both, and the furthest progress on each
  const out = new Map(cloud.map(x => [x.id, x]));
  for (const x of local) { const c = out.get(x.id); out.set(x.id, c ? { ...c, at: Math.max(c.at || 0, x.at || 0), img: c.img || x.img } : x); }
  return [...out.values()];
}
function storeLocal() { try { localStorage.setItem('mm_mine', JSON.stringify(S.mine)); localStorage.setItem('mm_list', JSON.stringify(S.list)); localStorage.setItem('mm_setup', JSON.stringify(S.setup)); localStorage.setItem('mm_ratings', JSON.stringify(S.ratings)); localStorage.setItem('mm_rank', JSON.stringify(S.rank)); localStorage.setItem('mm_opens', JSON.stringify(S.opens)); localStorage.setItem('mm_teams', JSON.stringify(S.teams)); localStorage.setItem('mm_history', JSON.stringify(S.history)); localStorage.setItem('mm_likes', JSON.stringify(S.likes)); localStorage.setItem('mm_actors', JSON.stringify(S.actors)); localStorage.setItem('mm_moods', JSON.stringify(S.moods)); localStorage.setItem('mm_profile', JSON.stringify(S.profile)); localStorage.setItem('mm_order', JSON.stringify(S.order)); localStorage.setItem('mm_lastOpen', JSON.stringify(S.lastOpen)); localStorage.setItem('mm_svcSince', JSON.stringify(S.svcSince)); localStorage.setItem('mm_svcSnooze', JSON.stringify(S.svcSnooze)); localStorage.setItem('mm_svcRemindOff', JSON.stringify(S.svcRemindOff)); localStorage.setItem('mm_later', JSON.stringify(S.later)); localStorage.setItem('mm_svcRate', JSON.stringify(S.svcRate)); } catch {} }
function startAccount() {
  if (typeof firebase === 'undefined') return;
  try { firebase.initializeApp(FB); auth = firebase.auth(); db = firebase.firestore(); } catch { auth = null; return; }
  auth.onAuthStateChanged(async u => {
    if (stopWatch) { stopWatch(); stopWatch = null; }
    me = u;
    if (u && u.isAnonymous) { drawAcct(); if (S.paired) loadDevice(); draw(); return; }
    if (u) {
      const ref = db.collection('users').doc(u.uid);
      try { const d = await ref.get(), c = d.exists ? d.data() : null;
        if (c && !S.prof) { S.mine = [...new Set([...(c.mine || []), ...S.mine])]; S.list = mergeLists(c.list || [], S.list); S.setup = [...new Set([...(c.setup || []), ...S.setup])]; S.ratings = { ...S.ratings, ...(c.ratings || {}) }; S.rank = (c.rank && c.rank.length) ? c.rank : S.rank; for (const [k, v] of Object.entries(c.opens || {})) S.opens[k] = Math.max(S.opens[k] || 0, v); const tk = t => t.path + t.id, had = new Set((c.teams || []).map(tk)); S.teams = [...(c.teams || []), ...S.teams.filter(t => !had.has(tk(t)))]; const hk = new Set((c.history || []).map(h => h.k)); S.history = [...(c.history || []), ...S.history.filter(h => !hk.has(h.k))].sort((a, b) => b.at - a.at); S.likes = [...new Set([...(c.likes || []), ...S.likes])]; S.actors = [...new Set([...(c.actors || []), ...S.actors])]; S.moods = [...new Set([...(c.moods || []), ...S.moods])]; S.profile = { ...S.profile, ...(c.profile || {}) }; if (c.order && c.order.length) S.order = c.order; for (const [k, v] of Object.entries(c.lastOpen || {})) S.lastOpen[k] = Math.max(S.lastOpen[k] || 0, v); S.svcSince = { ...(c.svcSince || {}), ...S.svcSince }; S.svcSnooze = { ...S.svcSnooze, ...(c.svcSnooze || {}) }; if (typeof c.svcRemindOff === 'boolean') S.svcRemindOff = c.svcRemindOff; const lk = new Set((c.later || []).map(l => l.k)); S.later = [...(c.later || []), ...S.later.filter(l => !lk.has(l.k))].slice(0, 200); S.profiles = { ...(c.profiles || {}), ...S.profiles }; S.svcRate = { ...(c.svcRate || {}), ...S.svcRate }; storeLocal(); }
        pushCloud();
      } catch {}
      stopWatch = ref.onSnapshot(d => {   // a change made on another device shows up here
        if (!d.exists || d.metadata.hasPendingWrites || S.prof) return; const c = d.data(), j = JSON.stringify({ mine: c.mine || [], list: c.list || [], setup: c.setup || [], ratings: c.ratings || {}, rank: c.rank || [], opens: c.opens || {}, teams: c.teams || [], history: c.history || [], likes: c.likes || [], actors: c.actors || [], moods: c.moods || [], profile: c.profile || {} }); if (j === lastCloud) return;
        lastCloud = j; S.mine = c.mine || []; S.list = c.list || []; S.setup = c.setup || []; S.ratings = c.ratings || {}; S.rank = c.rank || []; S.opens = c.opens || {}; S.teams = c.teams || []; S.history = c.history || []; S.likes = c.likes || []; S.actors = c.actors || []; S.moods = c.moods || []; S.profile = c.profile || {}; storeLocal(); draw(); loadEps(); loadTeamGames();
      }, () => {});
    }
    loadHouse(); draw(); loadEps();
  });
}
if (location.hash.startsWith('#list=')) { S.tab = 5; S.viewList = { id: location.hash.slice(6), loading: true }; }
for (const r of Object.values(S.ratings)) if (r && r.score > 5) r.score = Math.round(r.score) / 2;   // 11/14: 1-10 -> 5 hearts
draw(); loadGuide(); loadGames(); loadEps(); loadTeamGames(); startAccount();
if (S.viewList && S.viewList.loading) { const iv = setInterval(() => { if (db) { clearInterval(iv); openList(S.viewList.id); } }, 300); }
setTimeout(loadPool, 4000);
setInterval(episodeAlerts, 30 * 60000);
setTimeout(unusedNotify, 8000); setInterval(unusedNotify, 6 * 3600000);
setInterval(loadTeamGames, 15 * 60000);
setInterval(() => { const now = Date.now(); let ch = false; for (const [k, r] of Object.entries(S.remind)) { if (r.when - now <= 15 * 60000) { if (r.when - now > -10 * 60000 && 'Notification' in window && Notification.permission === 'granted') { try { new Notification('Marvel Magic', { body: r.title + ' starts in 15 minutes', icon: 'icon-192.png' }); } catch {} } delete S.remind[k]; ch = true; } } if (ch) save('remind', S.remind); }, 30000);   // Scott 11/14 board: remind me 15 min before
setInterval(() => { if ((S.tab !== HOME && S.tab !== 2) || document.hidden) return; const c = $('hclock'); if (c) c.textContent = clock(new Date()); document.querySelectorAll('.cd[data-when]').forEach(el => { el.textContent = cdText(Number(el.dataset.when)); }); }, 1000);   // Home clock + game countdown tick without redrawing
setInterval(loadGuide, 5 * 60000);   // the guide keeps itself current (Scott 11/08)
setInterval(() => { if (!document.hidden) loadGames(); }, 60000);
// the Fire TV remote's Back key: close a popup, clear a pick, go Home; at Home the app leaves (returns false)
window.mmBack = () => {
  if ($('back').open) { $('back').close(); return true; }
  if (S.sel) { S.sel = null; const y = window.scrollY; draw(); window.scrollTo(0, y); return true; }
  if (S.mlAll) { S.mlAll = null; draw(); window.scrollTo(0, 0); return true; }
  if (S.tab !== HOME) { showTab(HOME); return true; }
  return false;
};
if (typeof window.MMNative !== 'undefined') document.documentElement.classList.add('tvapp');
// SELF-UPDATE (Scott 11/14 "does site keep updating"): every 10 minutes the app checks for a newer copy of itself; when one is out and nobody
// is using the screen (2 minutes idle, no popup, no typing) it reloads - so the TV (Scott's dad's) never needs Ctrl+F5.
let myCopy = null, newCopy = false, lastTouch = Date.now();
['keydown', 'pointerdown', 'wheel', 'touchstart'].forEach(ev => addEventListener(ev, () => { lastTouch = Date.now(); }, { passive: true }));
const pageSig = t => { let h = 0; for (let i = 0; i < t.length; i += 7) h = (h * 31 + t.charCodeAt(i)) | 0; return t.length + ':' + h; };
function checkForUpdate() {
  fetch(location.pathname + '?v=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.text() : null).then(t => {
    if (!t) return; const sig = pageSig(t);
    if (myCopy === null) myCopy = sig; else if (sig !== myCopy) newCopy = true;
  }).catch(() => {});
}
setInterval(() => {
  if (!newCopy) return;
  const busy = $('back').open || (document.activeElement && document.activeElement.matches && document.activeElement.matches('input,select,textarea'));
  if (busy || Date.now() - lastTouch < 120000) return;
  try { sessionStorage.setItem('mm_updated', '1'); } catch {}
  location.reload();
}, 15000);
setTimeout(checkForUpdate, 3000); setInterval(checkForUpdate, 10 * 60000);
try { if (sessionStorage.getItem('mm_updated')) { sessionStorage.removeItem('mm_updated'); setTimeout(() => { const n = document.createElement('div'); n.className = 'updtoast'; n.textContent = 'Marvel Magic updated ✨'; document.body.appendChild(n); setTimeout(() => n.remove(), 5000); }, 800); } } catch {}
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
// CLOSE ✕ ON EVERY POPUP (Scott 11/15: "when you come back to marvel and it ask pick something else it needs a close button as well"):
// every popup in the shared #back box gets a ✕ in its corner. Closing "Did it play?" also forgets that open, so it is not asked again.
(() => {
  const b = $('back'), show = b.showModal.bind(b);
  b.showModal = () => {
    const kind = b.dataset.kind || ''; delete b.dataset.kind;
    if (!b.querySelector(':scope > .dlgx')) b.insertAdjacentHTML('afterbegin', '<button class="dlgx" aria-label="Close" title="Close">✕</button>');
    b.querySelector(':scope > .dlgx').onclick = () => { if (kind === 'rescue') save('pending', null); b.close(); };
    show();
  };
})();
