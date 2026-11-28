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
// ASK MARVEL (Scott 11/27: "tipster circle ... so can open for questions as well"): tapping his circle opens these questions, answered from
// here (no AI, no network). [id, picture, question, answer, Show me, can he show it now?]. Kids Lock hides Sports + Settings answers.
const TIP_ASK = [
  ['q-watch', 'movie', 'How do I watch something?', 'Pick any show, movie or game and press Watch. Marvel Magic opens it in the real app (Netflix, Hulu, Peacock and the rest) - it never plays video itself. Come back here when you’re done.', 'tab:1'],
  ['q-game', 'sports', 'Where’s my game on?', 'Sports lists today’s games and which of your services carries each one. Add your teams in Settings and they show first.', 'tab:2', () => !kidsOn()],
  ['q-guide', 'streamer', 'What’s on TV right now?', 'The Live TV Guide shows what’s on now and later on the channels you can watch. Pick a show to open its channel.', 'tab:0'],
  ['q-free', 'explorer', 'What can I watch for free?', 'Free TV has live channels and movies that need no account and no sign-up - Pluto TV, Tubi, Plex, The Roku Channel and more.', 'tab:4'],
  ['q-services', 'guide', 'How do I pick my services?', 'Go to Settings → My Services and tick the ones you have. The guide, picks and Watch buttons then use only those.', 'tab:10', () => !kidsOn() && !S.paired],
  ['q-next', 'detective', 'What should I watch tonight?', 'For You picks from what you like, on services you already have. Give shows hearts and the picks get better.', 'tab:9'],
  ['q-kids', 'hello', 'How do I lock it for kids?', 'Press Kids Lock on Home and set a PIN. Marvel Magic then shows only kids’ channels and family shows until the PIN turns it off.', 'tab:7'],
  ['q-tv', 'tv', 'How do I put it on my TV?', 'On a phone or tablet, press Cast to TV at the top. Or set it up on the TV itself with Show a TV code on Home - nothing to type on the TV.', 'tab:7', () => !tipOnTv()],
  ['q-remote', 'remote', 'How does the remote work?', 'Arrows move the highlight, OK opens, and Back goes back one step. Back also closes me.', null, () => tipOnTv()],
];
// ASK BY TYPING OR VOICE (Scott 11/27: "he needs micro phone in box as well so can voice text him"): the box in Ask Marvel gets the shared
// microphone (/dayhub/voicefill.js adds one to every typing box). What you say is matched to his answers by these words - no AI, no network.
// Nothing matches: he offers to Search Marvel Magic for your words.
const TIP_ASK_WORDS = {
  'q-watch': 'watch play open start stream how', 'q-game': 'game games sports team teams score nfl nba mlb nhl football basketball baseball hockey soccer playing match',
  'q-guide': 'tv now guide channel channels live schedule airing on', 'q-free': 'free nothing pluto tubi plex roku no account cheap',
  'q-services': 'service services netflix hulu disney peacock paramount max prime subscription subscriptions add pick tick settings',
  'q-next': 'recommend suggest should tonight bored ideas something good for you picks', 'q-kids': 'kids kid children child lock pin parental family safe',
  'q-tv': 'cast chromecast television phone put mirror screen', 'q-remote': 'remote arrows arrow button buttons back ok',
};
const TIP_EXTRA = [   // answers he only gives when asked (not on the list)
  ['q-search', 'search', 'Search finds any movie or show and shows which of your services has it.', 'search', 'search find look movie movies show shows title actor'],
  ['q-later', 'movie', 'Press Save on any show or movie and it goes in My Stuff, with where you left off and new episodes.', 'tab:3', 'save saved later list watchlist my stuff episodes keep track'],
  ['q-coming', 'calendar', 'Coming Soon lists new episodes and movies on the way to your services.', 'tab:8', 'coming soon new premiere premieres upcoming next week season'],
  ['q-sync', 'party', 'Sign in with Google in Settings and your services, lists and hearts follow you to every TV and phone.', 'tab:10', 'sign signin login account google sync other devices'],
];
function tipAnswer(text) {
  const w = String(text || '').toLowerCase().replace(/[^a-z0-9+ ]/g, ' ').split(/\s+/).filter(x => x.length > 1);
  let best = null, top = 0;
  const score = words => { const k = new Set(words.split(' ')); return w.filter(x => k.has(x) || k.has(x.replace(/s$/, ''))).length; };
  for (const q of TIP_ASK.filter(tipAskOk)) { const n = score(TIP_ASK_WORDS[q[0]] || ''); if (n > top) { top = n; best = [q[0], q[1], q[3], q[4]]; } }
  for (const q of TIP_EXTRA) { if (q[3] === 'tab:10' && (kidsOn() || S.paired)) continue; const n = score(q[4]); if (n > top) { top = n; best = [q[0], q[1], q[2], q[3]]; } }
  if (best) return best;
  return ['q-none', 'thinking', `I don’t know that one yet. Want me to search Marvel Magic for “${String(text).trim().slice(0, 60)}”?`, 'search:' + String(text).trim().slice(0, 80)];
}
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
const tipAskOk = q => !(q[5] && !q[5]()) && !(q[4] === 'tab:10' && S.paired);
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
#mmTip .tipme{padding:0}#mmTip .tipme:hover{transform:scale(1.06)}#mmTip .tipme:focus-visible{outline:4px solid #7fd8ff;outline-offset:3px;box-shadow:0 0 22px 6px rgba(127,216,255,.75);transform:scale(1.12);opacity:1}
#mmTip.small .tipme{width:52px;height:52px;opacity:.92;border-width:2px}
#mmTip .tipb{pointer-events:auto;background:#1b1442;border:1px solid #6d4bd8;border-radius:16px 16px 4px 16px;padding:14px 16px 12px;color:#f3efff;box-shadow:0 10px 32px rgba(0,0,0,.5);display:flex;gap:12px;align-items:flex-start;animation:tipIn .35s ease-out}
#mmTip .tipb img{width:84px;height:84px;border-radius:50%;flex:none;background:#eeeafc;object-fit:cover}
#mmTip .tipb b{display:block;color:#c4b5fd;font-size:13px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px}
#mmTip .tipb p{margin:0 0 10px;font-size:16px;line-height:1.4}
#mmTip .tipbtns{display:flex;gap:8px;flex-wrap:wrap}
.tipsw{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.tipsw .btn{min-width:84px}
#mmTip .tipaskf{display:flex;gap:6px;margin:0 0 10px}#mmTip .tipaskf input{flex:1;min-width:0;min-height:42px;padding:0 12px;border-radius:9px;border:1px solid #6d4bd8;background:#0f0b2a;color:#fff;font-size:15px}#mmTip .tipaskf button{min-height:42px;padding:0 14px;border-radius:9px;border:0;background:linear-gradient(135deg,#5C3DF0,#8A3FF0);color:#fff;font-weight:700;cursor:pointer}
#mmTip .tipqs{display:flex;flex-direction:column;gap:6px;margin:0 0 10px}#mmTip .tipqs button{min-height:40px;padding:6px 12px;border-radius:9px;border:1px solid #6d4bd8;background:#241a58;color:#fff;font-weight:650;font-size:15px;text-align:left;cursor:pointer}#mmTip .tipqs button:focus-visible{outline:3px solid #7fd8ff;outline-offset:2px}
#mmTip .tipbtns button{min-height:36px;padding:0 14px;border-radius:9px;border:1px solid #6d4bd8;background:#2a1f63;color:#fff;font-weight:650;font-size:14px;cursor:pointer}
#mmTip .tipbtns button.go{background:linear-gradient(135deg,#5C3DF0,#8A3FF0);border-color:transparent}
#mmTip .tipbtns button:focus-visible{outline:3px solid #7fd8ff;outline-offset:2px}
/* 11/27 (Scott: "tipster needs to also show in middle of screen so people see him" + "tipster circle need to go and stay top right corner to right of
   the time so can open for questions as well"): his small circle lives top right on every page (right of Home's clock); a tip pops up in the
   middle of the screen with the page dimmed behind it, his picture inside the bubble. Tap the circle any time for a tip. */
#mmTip.small{top:12px;right:16px;bottom:auto}
#mmTip:not(.small){top:50%;left:50%;right:auto;bottom:auto;transform:translate(-50%,-50%);width:min(560px,calc(100vw - 32px));justify-content:center}
#mmTip:not(.small) .tipme{display:none}
#mmTip:not(.small) .tipb{flex:1;border-radius:18px;box-shadow:0 0 0 100vmax rgba(5,8,20,.55),0 0 34px rgba(168,85,247,.55),0 10px 32px rgba(0,0,0,.5);border-width:2px}
@keyframes tipIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media (max-width:760px){#mmTip.small{top:10px;right:10px}#mmTip .tipme{width:58px;height:58px}#mmTip.small .tipme{width:44px;height:44px}#mmTip .tipb{padding:12px}#mmTip .tipb img{width:56px;height:56px}#mmTip .tipb p{font-size:15px}}
@media (min-width:1200px){#mmTip:not(.small){width:min(760px,calc(100vw - 64px))}#mmTip:not(.small) .tipb{padding:20px 24px 18px;gap:18px}#mmTip:not(.small) .tipb img{width:120px;height:120px}#mmTip:not(.small) .tipb p{font-size:20px}}
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
  el.style.bottom = '';   // 11/27: he no longer sits along the bottom (top right / middle of the screen), so nothing to lift over
  void lift;
}
function tipDraw() {   // the corner picture (and the bubble while a tip is open)
  const st = tipState(), el = tipEl();
  if (!st.on || kidsOn()) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  tipLift(el);
  const look = tipCostume();
  // 11/27 (Scott: "tipster on mm cant be highlited"): his circle is a real button now, so the remote reaches it (OK = Ask Marvel)
  const me = `<button class="tipme" data-tipme aria-label="Ask Marvel, your Marvel Magic helper" style="background-image:url('${TIP_ART}${look}.webp')"></button>`;
  if (!tipNow) { el.className = 'small'; el.innerHTML = me; return; }
  if (tipNow[0] === 'ask') {   // the question list
    el.className = '';
    el.innerHTML = `<div class="tipb tipask" role="dialog" aria-label="Ask Marvel"><img src="${TIP_ART}thinking.webp" alt="">
      <div><b>Ask Marvel</b><p>What can I help with?</p><form class="tipaskf" data-tipform><input id="tipq" placeholder="Ask me anything…" aria-label="Ask Marvel a question" autocomplete="off"><button>Ask</button></form><div class="tipqs">${TIP_ASK.filter(tipAskOk).map(q => `<button data-tipq="${q[0]}">${esc(q[2])}</button>`).join('')}</div>
      <div class="tipbtns"><button data-tiptip>💡 Tip of the day</button><button data-tipok>Close</button><button data-tiphush>Hush</button></div></div></div>${me}`;
    tipFocus(); return;
  }
  const [, pic, words, show] = tipNow;
  el.className = '';
  el.innerHTML = `<div class="tipb" role="dialog" aria-label="A tip from Marvel"><img src="${TIP_ART}${pic}.webp" alt="">
    <div><b>${tipNow[0].startsWith('hol-') ? 'Marvel says' : tipNow[0].startsWith('l-') ? 'Tip from Marvel' : tipNow[0].startsWith('d-') ? 'Did you know?' : 'Marvel noticed'}</b><p>${esc(words)}</p>
    <div class="tipbtns">${show ? '<button class="go" data-tipgo>Show me</button>' : ''}${tipNow[0].startsWith('q-') ? '<button data-tipask>More questions</button><button data-tipok>Got it</button>' : '<button data-tipok>Got it</button><button data-tiphush>Hush</button>'}</div></div></div>${me}`;
  tipFocus();
}
// THE TIP HOLDS THE REMOTE (Scott 11/25 on his TV: "you cant highlite a response so you should have to click something on him first before
// all else"). While a tip is open the highlight sits on its first button and the arrows stay on its buttons (app.js focusables), until
// Show me / Got it / Hush - or Back, which counts as Got it. Then the highlight goes back where it was.
let tipPrev = null;
function tipFocus() {
  const el = $('mmTip'), b = el && (el.querySelector('.tipb [data-tipgo]') || el.querySelector('.tipb [data-tipq]') || el.querySelector('.tipb [data-tipok]')); if (!b) return;
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
  const p = tipPrev; tipPrev = null; if (p && p.isConnected && p.getClientRects().length) { p.focus({ preventScroll: true }); return; }
  if (p && p.matches && p.matches('[data-tipme]')) { const c = document.querySelector('#mmTip [data-tipme]'); if (c) { c.focus({ preventScroll: true }); return; } }   // opened from his circle: back to it
  // 11/27: nothing to go back to (the tip came up before anything was highlighted) - light the first box you can see, so the remote is never lost
  const f = typeof focusables === 'function' && focusables().find(e => e.closest('main')); if (f) f.focus({ preventScroll: true });
}
function tipTry() {   // once a day, when nothing else is going on
  const st = tipState();
  if (!st.on || kidsOn() || tipNow || st.day === tipToday() || Date.now() - tipBorn < 6000 || tipBusy()) return;
  const t = tipPick(st); if (t) tipOpen(t);
}
function tipGo(show) {
  if (!show) return;
  if (String(show).startsWith('search:')) { const q = String(show).slice(7); if (S.tab !== 1) history.pushState({ tab: 1 }, ''); showTab(1);
    setTimeout(() => { const i = $('q'), f = $('find'); if (i) { i.value = q; if (f && f.requestSubmit) f.requestSubmit(); else i.focus(); } }, 60); return; }
  if (show === 'search') { if (S.tab !== 1) history.pushState({ tab: 1 }, ''); showTab(1); setTimeout(() => $('q') && $('q').focus(), 60); return; }
  const n = Number(String(show).replace('tab:', '')); if (!Number.isFinite(n)) return;
  if (n !== S.tab) history.pushState({ tab: n }, ''); showTab(n);
}
// Settings box (guide.js settingsPage calls this when it exists)
function tipBox() {   // 11/27 (Scott: "mm need in setting away to turn tipster back on or off"): a plain ON / OFF switch, near the top of Settings
  const st = tipState();
  return `<section class="glow plain stbox tipset"><h3>🧙 Marvel the Tipster</h3>
    <p class="fine">${st.on ? 'Marvel is <b>ON</b>: his circle sits top right - tap it to ask him anything - and he gives one short tip a day.' : 'Marvel is <b>OFF</b> on this device: no circle, no tips. Turn him back on any time.'}</p>
    <div class="tipsw" role="group" aria-label="Marvel the Tipster on or off"><button class="btn ${st.on ? '' : 'alt'}" data-tipwake aria-pressed="${st.on}">ON</button><button class="btn ${st.on ? 'alt' : ''}" data-tiphush aria-pressed="${!st.on}">OFF</button>${st.on ? '<button class="btn alt" data-tipshow>Show me a tip now</button>' : ''}</div></section>`;
}
document.addEventListener('click', e => {
  const t = e.target.closest && e.target.closest('[data-tipgo],[data-tipok],[data-tiphush],[data-tipwake],[data-tipshow],[data-tipme],[data-tipq],[data-tipask],[data-tiptip]'); if (!t) return;
  if (t.hasAttribute('data-tipme') && !tipNow) { tipNow = ['ask']; tipDraw(); return; }   // his circle = Ask Marvel
  if (t.hasAttribute('data-tipask')) { tipNow = ['ask']; tipDraw(); return; }
  if (t.dataset.tipq) { const q = TIP_ASK.find(x => x[0] === t.dataset.tipq); if (q) { tipNow = [q[0], q[1], q[3], q[4]]; tipDraw(); } return; }
  if (t.hasAttribute('data-tiptip')) { tipNow = null; t.removeAttribute('data-tiptip'); t.setAttribute('data-tipshow', ''); }
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
document.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-tipform]'); if (!f) return;
  e.preventDefault(); const v = (f.querySelector('input') || {}).value || ''; if (!v.trim()) return;
  tipNow = tipAnswer(v); tipDraw();
}, true);
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
