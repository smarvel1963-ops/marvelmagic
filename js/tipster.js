// js/tipster.js
// Save to: C:\MarvelApps\marvelmagic\js\tipster.js
// MARVEL THE TIPSTER (Scott 11/23 mascot sheets; 11/25 "build tipster and continue to make better and better").
// Marvel - the white robot in the purple wizard hat - sits in the bottom corner and gives ONE short tip a day:
//   1. on a holiday itself, a hello in his holiday outfit (Thanksgiving, Christmas, New Year, Valentine's, St. Patrick's, Easter, July 4th, Halloween);
//   2. something real from YOUR services that needs you soon: a title leaving one of them in the next 3 days (Leaving Soon data), or a
//      show you're behind on (Series Catch-Up) - each one once;
//   3. the first week: 7 lessons in order (hello, guide, search, Movies & Shows, Sports, Coming Soon, hearts);
//   4. after that, "Did you know?" - real features, in turn, never the same one twice until he has said them all.
// His outfit follows the page (Director on Movies & Shows / Browse, Commentator on Sports, Explorer on Free TV / Coming Soon, Detective on
// For You, Streaming Helper on the Live TV Guide, the wizard everywhere else) and a holiday outfit replaces it on the holiday's days.
// Rules: quiet with Kids Lock on; never while the lock screen, the trial notice or a pop-up is open, while you type, or in the first 6 seconds;
// his corner picture is not a button, so the arrows skip it; an OPEN tip holds the remote until you answer it (see tipFocus).
// Got it = gone till tomorrow; Hush = off on this device; Settings -> Marvel the Tipster turns him back on. No price, no AI, no network beyond his own pictures (img/tipster, made by tools/make_tipster_art.py).
// Saved in localStorage mm_tipster (this device only, never synced). Every top-level name starts with tip / TIP.
"use strict";
const TIP_ART = 'img/tipster/';
const TIP_DAY = 86400000;
const tipState = () => Object.assign({ on: true, day: '', said: {}, n: 0, first: '' }, load('tipster', {}) || {});
const tipPut = st => save('tipster', st);
const tipToday = () => new Date().toDateString();
const tipOnTv = () => (typeof inTvApp === 'function' && inTvApp()) || /Tizen|SMART-TV|AFT|CrKey|Web0S|BRAVIA/i.test(navigator.userAgent) || !!(window.MMNative && MMNative.platform);
const tipTouch = () => (navigator.maxTouchPoints || 0) > 0 && matchMedia('(pointer:coarse)').matches;

// ---- holidays: [art, first day, last day, the hello on the day itself] -------------------------------------------------------------
function tipEaster(y) {   // Gregorian Easter Sunday (anonymous algorithm)
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return new Date(y, mo - 1, da);
}
function tipThanks(y) { const d = new Date(y, 10, 1); d.setDate(1 + ((4 - d.getDay() + 7) % 7) + 21); return d; }   // 4th Thursday of November
function tipHoliday(now = new Date()) {
  const y = now.getFullYear(), t = new Date(y, now.getMonth(), now.getDate()).getTime(), at = (mo, da) => new Date(y, mo, da).getTime();
  const ea = tipEaster(y).getTime(), tg = tipThanks(y).getTime();
  const H = [
    ['newyear', at(0, 1), at(0, 2), at(0, 1), 'Happy New Year from Marvel Magic! Here’s to a year of great shows.'],
    ['newyear', at(11, 31), at(11, 31), at(11, 31), 'Happy New Year’s Eve! Thanks for watching with Marvel Magic this year.'],
    ['valentine', at(1, 10), at(1, 14), at(1, 14), 'Happy Valentine’s Day! Movie night? For You has picks made from your hearts.', 'tab:9'],
    ['stpatricks', at(2, 14), at(2, 17), at(2, 17), 'Happy St. Patrick’s Day from Marvel Magic!'],
    ['easter', ea - 3 * TIP_DAY, ea, ea, 'Happy Easter from Marvel Magic!'],
    ['july4', at(6, 1), at(6, 5), at(6, 4), 'Happy Fourth of July from Marvel Magic!'],
    ['halloween', at(9, 25), at(9, 31), at(9, 31), 'Happy Halloween! Looking for something spooky? Search finds any movie or show.', 'search'],
    ['thanksgiving', tg - 4 * TIP_DAY, tg + TIP_DAY, tg, 'Happy Thanksgiving from Marvel Magic! Sports has today’s games and where to watch them.', 'tab:2'],
    ['christmas', at(11, 15), at(11, 26), at(11, 25), 'Merry Christmas from Marvel Magic!'],
  ];
  for (const [art, from, to, day, words, show] of H) if (t >= from && t <= to) return { art, isDay: t === day, words, show, id: 'hol-' + art + '-' + y };
  return null;
}
// his outfit for the page you're on (a holiday outfit wins)
function tipCostume() {
  const h = tipHoliday(); if (h) return h.art;
  return ({ 0: 'streamer', 1: 'director', 11: 'director', 2: 'commentator', 4: 'explorer', 8: 'explorer', 9: 'detective' })[S.tab] || 'hello';
}

// ---- what he can say ---------------------------------------------------------------------------------------------------------------
// [id, picture, words, Show me (tab:N | search | none), can he say it now?]
const TIP_LESSONS = [
  ['l-hello', 'hello', 'Hi, I’m Marvel! I’ll share one quick tip a day to help you get the most out of Marvel Magic. Tap Hush any time to quiet me.'],
  ['l-guide', 'tv', 'The Live TV Guide shows what’s on right now across the services you have. Pick a show and it opens on its own service.', 'tab:0'],
  ['l-search', 'search', 'Looking for something? Search any movie or show and I’ll show you which of your services has it.', 'search'],
  ['l-shows', 'movie', 'Add a show to My Stuff and Marvel Magic keeps your place, so the next episode is always one tap away.', 'tab:1'],
  ['l-sports', 'sports', 'Sports shows today’s games and which of your services carries each one. Add your teams in Settings and they show first.', 'tab:2'],
  ['l-coming', 'calendar', 'Coming Soon lists new episodes and movies on the way, so you never miss a premiere.', 'tab:8'],
  ['l-hearts', 'thumbs', 'Give what you watch 1 to 5 hearts. For You uses your hearts to pick what to watch next.', 'tab:9'],
];
const TIP_DYK = [
  ['d-free', 'explorer', 'Free TV has live channels that need no account and no sign-up - just pick one and watch.', 'tab:4'],
  ['d-browse', 'director', 'Browse Movies lets you flip through each service’s movie catalog, starting with the free ones.', 'tab:11'],
  ['d-leaving', 'calendar', 'Leaving Soon on Home warns you before a movie or show leaves one of your services.', 'tab:7'],
  ['d-catch', 'movie', 'Series Catch-Up in My Stuff shows how many episodes you’re behind on each show.', 'tab:3'],
  ['d-watched', 'thinking', 'Watched keeps a list of everything you open from Marvel Magic. You can remove anything that’s wrong.', 'tab:6'],
  ['d-ratings', 'thumbs', 'My Ratings keeps every heart you’ve given, all in one place.', 'tab:5'],
  ['d-services', 'guide', 'Tick the services you have in Settings → My Services. The guide and your picks show only those.', 'tab:10'],
  ['d-kids', 'hello', 'Kids Lock keeps Marvel Magic to kids’ channels and family shows. Turn it on from Home - a PIN turns it off.', 'tab:7'],
  ['d-sync', 'party', 'Sign in with Google in Settings and your services, lists and hearts follow you to every TV and phone.', 'tab:10', () => !S.paired && !(typeof me !== 'undefined' && me)],
  ['d-cast', 'tv', 'On a phone or tablet? The Cast button sends Marvel Magic to your TV.', 'tab:7', () => !tipOnTv() && tipTouch()],
  ['d-remote', 'remote', 'On the TV remote: the arrows move, OK opens, and Back goes back one step.', null, () => tipOnTv()],
  ['d-coming', 'calendar', 'Coming Soon shows what’s premiering this week on your services.', 'tab:8'],
];
function tipSoon(st) {   // things on YOUR services that need you soon - each said once
  const out = [];
  try {
    for (const r of (typeof leavingRows === 'function' ? leavingRows() : [])) {
      if (r.days > 3) break; const id = 'leave-' + r.v.id + '-' + r.v.svc; if (st.said[id]) continue;
      const when = r.days === 0 ? 'today is its last day on ' + r.v.svc : r.days === 1 ? 'it leaves ' + r.v.svc + ' tomorrow' : 'it leaves ' + r.v.svc + ' in ' + r.days + ' days';
      out.push([id, 'calendar', `Heads up: “${r.v.title}” - ${when}. It’s under Leaving Soon on Home if you want to watch it first.`, 'tab:7']); break;
    }
  } catch {}
  try {
    for (const r of (typeof catchRows === 'function' ? catchRows() : [])) {
      if (!r.t || !(r.t.at > 0) || r.behind < 2) continue; const id = 'catch-' + r.s.id + '-' + r.behind; if (st.said[id]) continue;
      out.push([id, 'movie', `You’re ${r.behind} episodes behind on ${r.s.name}. Series Catch-Up in My Stuff has the next one ready.`, 'tab:3']); break;
    }
  } catch {}
  return out;
}
const tipOk = t => !(t[4] && !t[4]()) && !(t[3] === 'tab:2' && kidsOn()) && !(t[3] === 'tab:10' && (kidsOn() || S.paired));
function tipPick(st) {
  const h = tipHoliday(); if (h && h.isDay && !st.said[h.id]) return [h.id, h.art, h.words, h.show || null];
  const soon = tipSoon(st); if (soon.length) return soon[0];
  const lesson = TIP_LESSONS.find(t => !st.said[t[0]] && tipOk(t)); if (lesson) return lesson;
  const dyk = TIP_DYK.filter(tipOk); if (!dyk.length) return null;
  const fresh = dyk.filter(t => !st.said[t[0]]);
  return (fresh.length ? fresh : dyk.slice().sort((a, b) => (st.said[a[0]] || 0) - (st.said[b[0]] || 0)))[0];
}

// ---- the corner + the bubble --------------------------------------------------------------------------------------------------------
const TIP_CSS = `
#mmTip{position:fixed;right:22px;bottom:22px;z-index:40;display:flex;align-items:flex-end;gap:12px;pointer-events:none;max-width:min(560px,calc(100vw - 32px))}
#mmTip .tipme{width:76px;height:76px;border-radius:50%;flex:none;background:#eeeafc center/cover no-repeat;border:3px solid #a855f7;box-shadow:0 0 18px rgba(168,85,247,.55);pointer-events:auto;cursor:pointer;transition:transform .25s}
#mmTip .tipme:hover{transform:scale(1.06)}
#mmTip.small .tipme{width:52px;height:52px;opacity:.92;border-width:2px}
#mmTip .tipb{pointer-events:auto;background:#1b1442;border:1px solid #6d4bd8;border-radius:16px 16px 4px 16px;padding:14px 16px 12px;color:#f3efff;box-shadow:0 10px 32px rgba(0,0,0,.5);display:flex;gap:12px;align-items:flex-start;animation:tipIn .35s ease-out}
#mmTip .tipb img{width:84px;height:84px;border-radius:50%;flex:none;background:#eeeafc;object-fit:cover}
#mmTip .tipb b{display:block;color:#c4b5fd;font-size:13px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px}
#mmTip .tipb p{margin:0 0 10px;font-size:16px;line-height:1.4}
#mmTip .tipbtns{display:flex;gap:8px;flex-wrap:wrap}
#mmTip .tipbtns button{min-height:36px;padding:0 14px;border-radius:9px;border:1px solid #6d4bd8;background:#2a1f63;color:#fff;font-weight:650;font-size:14px;cursor:pointer}
#mmTip .tipbtns button.go{background:linear-gradient(135deg,#5C3DF0,#8A3FF0);border-color:transparent}
#mmTip .tipbtns button:focus-visible{outline:3px solid #7fd8ff;outline-offset:2px}
@keyframes tipIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media (max-width:760px){#mmTip{right:10px;bottom:calc(14px + env(safe-area-inset-bottom))}#mmTip .tipme{width:58px;height:58px}#mmTip.small .tipme{width:44px;height:44px}#mmTip .tipb{padding:12px}#mmTip .tipb img{width:56px;height:56px}#mmTip .tipb p{font-size:15px}}
@media (min-width:1600px){#mmTip .tipb p{font-size:19px}#mmTip .tipme{width:92px;height:92px}#mmTip .tipbtns button{min-height:44px;font-size:17px}}
@media (prefers-reduced-motion:reduce){#mmTip .tipb{animation:none}#mmTip .tipme{transition:none}}`;
let tipNow = null, tipBorn = Date.now(), tipLastInput = 0;
function tipEl() {
  let el = $('mmTip');
  if (!el) {
    if (!$('mmTipCss')) { const s = document.createElement('style'); s.id = 'mmTipCss'; s.textContent = TIP_CSS; document.head.appendChild(s); }
    el = document.createElement('div'); el.id = 'mmTip'; el.setAttribute('aria-live', 'polite'); document.body.appendChild(el);
  }
  return el;
}
function tipBusy() {
  const lock = $('mmLock'), note = $('mmTrialNote');
  const shown = x => x && x.getClientRects().length && getComputedStyle(x).display !== 'none' && getComputedStyle(x).visibility !== 'hidden';
  const a = document.activeElement, typing = a && a.matches && a.matches('input:not([type=checkbox]),textarea');
  return shown(lock) || shown(note) || ($('back') && $('back').open) || typing || document.visibilityState === 'hidden' || Date.now() - tipLastInput < 2500;
}
function tipLift(el) {   // sit above anything fixed along the bottom: the phone's menu bar, the Cast button, the dock
  let lift = 0;
  for (const x of [$('nav'), $('castbtn'), $('dock')]) {
    if (!x || x.hidden || !x.getClientRects().length || getComputedStyle(x).position !== 'fixed') continue;
    const r = x.getBoundingClientRect(); if (r.top > innerHeight / 2) lift = Math.max(lift, innerHeight - r.top);
  }
  el.style.bottom = lift ? (lift + 10) + 'px' : '';
}
function tipDraw() {   // the corner picture (and the bubble while a tip is open)
  const st = tipState(), el = tipEl();
  if (!st.on || kidsOn()) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  tipLift(el);
  const look = tipCostume();
  const me = `<div class="tipme" data-tipme role="img" aria-label="Marvel, your Marvel Magic helper" style="background-image:url('${TIP_ART}${look}.webp')"></div>`;
  if (!tipNow) { el.className = 'small'; el.innerHTML = me; return; }
  const [, pic, words, show] = tipNow;
  el.className = '';
  el.innerHTML = `<div class="tipb" role="dialog" aria-label="A tip from Marvel"><img src="${TIP_ART}${pic}.webp" alt="">
    <div><b>${tipNow[0].startsWith('hol-') ? 'Marvel says' : tipNow[0].startsWith('l-') ? 'Tip from Marvel' : tipNow[0].startsWith('d-') ? 'Did you know?' : 'Marvel noticed'}</b><p>${esc(words)}</p>
    <div class="tipbtns">${show ? '<button class="go" data-tipgo>Show me</button>' : ''}<button data-tipok>Got it</button><button data-tiphush>Hush</button></div></div></div>${me}`;
  tipFocus();
}
// THE TIP HOLDS THE REMOTE (Scott 11/25 on his TV: "you cant highlite a response so you should have to click something on him first before
// all else"). While a tip is open the highlight sits on its first button and the arrows stay on its buttons (app.js focusables), until
// Show me / Got it / Hush - or Back, which counts as Got it. Then the highlight goes back where it was.
let tipPrev = null;
function tipFocus() {
  const el = $('mmTip'), b = el && (el.querySelector('.tipb [data-tipgo]') || el.querySelector('.tipb [data-tipok]')); if (!b) return;
  const a = document.activeElement; if (a && !el.contains(a) && a !== document.body) tipPrev = a;
  if (!el.contains(a)) b.focus({ preventScroll: true });
}
function tipOpen(t, force) {
  const st = tipState(); if (!t || (!force && st.day === tipToday())) return;
  st.day = tipToday(); st.said[t[0]] = Date.now(); st.n = (st.n || 0) + 1; if (!st.first) st.first = tipToday(); tipPut(st);
  tipNow = t; tipDraw();
}
function tipClose() {
  tipNow = null; tipDraw();
  const p = tipPrev; tipPrev = null; if (p && p.isConnected && p.getClientRects().length) p.focus({ preventScroll: true });
}
function tipTry() {   // once a day, when nothing else is going on
  const st = tipState();
  if (!st.on || kidsOn() || tipNow || st.day === tipToday() || Date.now() - tipBorn < 6000 || tipBusy()) return;
  const t = tipPick(st); if (t) tipOpen(t);
}
function tipGo(show) {
  if (!show) return;
  if (show === 'search') { if (S.tab !== 1) history.pushState({ tab: 1 }, ''); showTab(1); setTimeout(() => $('q') && $('q').focus(), 60); return; }
  const n = Number(String(show).replace('tab:', '')); if (!Number.isFinite(n)) return;
  if (n !== S.tab) history.pushState({ tab: n }, ''); showTab(n);
}
// Settings box (guide.js settingsPage calls this when it exists)
function tipBox() {
  const st = tipState();
  return `<section class="glow plain stbox"><h3>🧙 Marvel the Tipster</h3>
    <p class="fine">${st.on ? 'Marvel gives one short tip a day, in the bottom corner. His outfit changes with the page and the holidays.' : 'Marvel is hushed on this device.'}</p>
    <div class="tipbtns" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">${st.on ? '<button class="btn" data-tipshow>Show me a tip now</button><button class="btn alt" data-tiphush>Hush Marvel</button>' : '<button class="btn" data-tipwake>Turn Marvel back on</button>'}</div></section>`;
}
document.addEventListener('click', e => {
  const t = e.target.closest && e.target.closest('[data-tipgo],[data-tipok],[data-tiphush],[data-tipwake],[data-tipshow],[data-tipme]'); if (!t) return;
  if (t.hasAttribute('data-tipgo')) { const show = tipNow && tipNow[3]; tipClose(); tipGo(show); return; }
  if (t.hasAttribute('data-tipok')) { tipClose(); return; }
  if (t.hasAttribute('data-tiphush')) { const st = tipState(); st.on = false; tipPut(st); tipClose(); if (S.tab === 10) draw(); return; }
  if (t.hasAttribute('data-tipwake')) { const st = tipState(); st.on = true; tipPut(st); tipDraw(); if (S.tab === 10) draw(); return; }
  if (t.hasAttribute('data-tipshow') || t.hasAttribute('data-tipme')) {   // tapping Marvel (or the Settings button) brings a tip any time
    if (tipNow) { tipClose(); return; }
    const st = tipState(), pool = [...tipSoon(st), ...TIP_DYK.filter(tipOk)];
    const t2 = pool.find(x => !st.said[x[0]]) || pool.sort((a, b) => (st.said[a[0]] || 0) - (st.said[b[0]] || 0))[0];
    if (t2) { st.said[t2[0]] = Date.now(); tipPut(st); tipNow = t2; tipDraw(); }
  }
});
['keydown', 'pointerdown', 'wheel', 'touchstart'].forEach(ev => addEventListener(ev, () => { tipLastInput = Date.now(); }, { passive: true, capture: true }));
addEventListener('keydown', e => {   // Back on any remote while a tip is open = Got it (and nothing else goes back)
  if (!tipNow) return;
  if (['Escape', 'GoBack', 'BrowserBack', 'XF86Back'].includes(e.key) || e.keyCode === 461 || e.keyCode === 10009 || (e.key === 'Backspace' && !(e.target.matches && e.target.matches('input')))) { e.preventDefault(); e.stopPropagation(); tipClose(); }
}, true);
addEventListener('resize', () => { if ($('mmTip')) tipLift($('mmTip')); });
new MutationObserver(() => { if ($('mmTip')) tipDraw(); }).observe(document.body, { attributes: true, attributeFilter: ['data-tab'] });
setTimeout(() => {
  const back = window.mmBack; if (typeof back === 'function') window.mmBack = function () { if (tipNow) { tipClose(); return true; } return back.apply(this, arguments); };   // Samsung's Back
  tipDraw(); tipTry(); setInterval(tipTry, 2500);
}, 1500);
