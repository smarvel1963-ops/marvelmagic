// js/core.js
// Save to: C:\MarvelApps\marvelmagic\js\core.js
// Marvel Magic - start-up, constants, services, tracker, guide data (ESPN channel map).
// Split out of index.html 2026-11-15 (sell-readiness pass). Plain script, shared global scope, loaded in order:
// core -> guide -> sports -> home -> app. After editing, run  python tools\stamp_versions.py  then  python tests\smoke_test.py

// SAMSUNG TV APP BRIDGE (Scott 11/15, Samsung TV add-on): inside the Samsung app (marvelmagic_samsung, a Tizen web app) this page runs in a
// frame opened with ?samsung=1. MMNative then asks the Samsung app (window.parent) to open the real streaming app, like the Fire TV app does.
// The Samsung app tells this page when the viewer comes back ('mm-resume') and when the remote's Back is pressed outside the frame.
if (/[?&]samsung=1/.test(location.search) && window.parent !== window && typeof window.MMNative === 'undefined') {
  window.MMNative = {
    open: (url, svc) => window.parent.postMessage({ mm: 'open', url, svc: svc || '' }, '*'),
    platform: () => 'samsung',
    has: () => true   // the Samsung app answers for real when it opens one; until then every app counts as on the TV
  };
  window.addEventListener('message', e => {
    if (e.source !== window.parent || !e.data) return;
    if (e.data.mm === 'resume' && typeof cameBack === 'function') cameBack();
    // remote arrows / OK pressed while the Samsung app's outer page has the keys (Scott 11/15 "round direction button dont move selection around")
    if (e.data.mm === 'key') { if (e.data.dir && typeof moveFocus === 'function') moveFocus(e.data.dir); else if (e.data.ok && document.activeElement && document.activeElement !== document.body) document.activeElement.click(); }
    if (e.data.mm === 'back') { const handled = typeof window.mmBack === 'function' ? window.mmBack() : false; window.parent.postMessage({ mm: 'backed', handled }, '*'); }   // not handled on Home = the Samsung app closes
  });
}
// Marvel Magic test build. Listings: TVmaze (free, credit required). Scores: ESPN's public scoreboard (personal test only, not for a paid release).
// It opens each title on that service's own site or app; it never plays or stores a stream, and never holds a service's password.
const TABS = ['Live TV Guide', 'Movies & Shows', 'Sports', 'My Stuff', 'Free TV', 'My Ratings', 'Watched', 'Home', 'Coming Soon', 'For You', 'Settings'];
// Home (Scott 11/14) is page 7 so every older page number stays the same; it shows FIRST in the menu and the app opens on it.
const HOME = 7, NAV_ORDER = [7, 0, 1, 8, 9, 2, 3, 4, 5, 6, 10];   // Coming Soon + For You (Scott 11/14) are pages 8 and 9
const ICONS = ['<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 11h18M7 7l3-4M13 7l3-4"/>', '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8"/>', '<path d="M6 3h12v18l-6-4-6 4z"/>', '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>', '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>', '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>', '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>', '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-9z"/>', '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>', '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'];
const icon = i => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[i]}</svg>`;
const LEAGUES = [['NBA', 'basketball/nba'], ['College Basketball', 'basketball/mens-college-basketball'], ['NFL', 'football/nfl'], ['College Football', 'football/college-football'], ['NHL', 'hockey/nhl'], ['MLB', 'baseball/mlb']];
const SERVICE_URL = {
  Netflix: q => 'https://www.netflix.com/search?q=' + q, Hulu: q => 'https://www.hulu.com/search?q=' + q, 'Prime Video': q => 'https://www.amazon.com/s?i=instant-video&k=' + q,
  'Disney+': () => 'https://www.disneyplus.com/', 'HBO Max': () => 'https://www.hbomax.com/', Peacock: () => 'https://www.peacocktv.com/', 'Paramount+': () => 'https://www.paramountplus.com/',
  'Apple TV': q => 'https://tv.apple.com/search?term=' + q, ESPN: () => 'https://www.espn.com/watch/', 'YouTube TV': () => 'https://tv.youtube.com/', 'Fox One': () => 'https://www.fox.com/', 'Sling Orange': () => 'https://watch.sling.com/', 'Sling Blue': () => 'https://watch.sling.com/', 'Hulu + Live TV': () => 'https://www.hulu.com/live', 'DirecTV Stream': () => 'https://stream.directv.com/', Fubo: () => 'https://www.fubo.tv/',
  Philo: () => 'https://www.philo.com/', Starz: () => 'https://www.starz.com/', 'MGM+': () => 'https://www.mgmplus.com/', 'AMC+': () => 'https://www.amcplus.com/',
  BritBox: () => 'https://www.britbox.com/', 'Acorn TV': () => 'https://acorn.tv/', Shudder: () => 'https://www.shudder.com/', Crunchyroll: () => 'https://www.crunchyroll.com/',
  'Discovery+': () => 'https://www.discoveryplus.com/', 'BET+': () => 'https://www.bet.plus/', 'Hallmark+': () => 'https://www.hallmarkplus.com/', 'Frndly TV': () => 'https://try.frndlytv.com/',
  'ESPN+': () => 'https://plus.espn.com/',
  'Samsung TV Plus': () => 'https://www.samsungtvplus.com/', 'Pluto TV': () => 'https://pluto.tv/', Tubi: () => 'https://tubitv.com/', Plex: () => 'https://watch.plex.tv/', 'Xumo Play': () => 'https://play.xumo.com/', 'The Roku Channel': () => 'https://therokuchannel.roku.com/'
};
// SLING CHANNELS (Scott 11/15 'sling did not' go to what was clicked): Sling's own channel ids, read from Scott's paid Sling guide
// (Orange + Blue) on 11/15. watch.sling.com/1/channel/<id>/watch opens that channel live (checked: TNT, after Sling's profile screen).
// Sling can change ids; a channel missing here (FOX, NBC, FXX, CNBC, Cartoon Network, Animal Planet...) opens Sling's home as before.
const SLING_CH = {'TNT': '23a92a8fb160489b97fd746536551d50', 'TBS': '6f8a36632f45462db3b843ed96a1f96c', 'truTV': '1ed623f9dc97498cbe332bd5216a87c1', 'CNN': '24696f5c20ad4d1490111064f0b32dc1', 'HLN': 'bb0fdf8d3383417d8da4ef9a31b35237', 'AMC': '8da93b497e644312b17d2420f1cb77f4', 'A&E': '3844c0aee4df43849a938774ee504b4a', 'History': 'b6a52c66df864231807cdd9e0b15689f', 'Lifetime': '170d51e754ad458eb912ae89d1254ca2', 'Food Network': 'eca5bf0184054d4cb938c0476adc99db', 'HGTV': 'eebd3fb41ae04dc785767c0b4b0f34c0', 'Travel Channel': '2b9b9f1be4984590a4d30529bebef33b', 'Investigation Discovery': '065f55e5000448869547c8d24da0b999', 'Comedy Central': '29938328f60d447299ec48511a09ebab', 'IFC': 'd990d3f3d1a04c92ab2d1c76fba0b072', 'BBC America': '4ce1c9ae62e94d19a7c23c680928ccd1', 'VICE': '474f290be605427ea8f12de8ac5d474f', 'Bloomberg TV+': 'c5e802c0fba04d68b6c4aa2acb93876c', 'Local Now': 'eb9a3b106bfb44049d208a961608352d', 'ESPN': 'ca0cad8dbb4a4e68962810d8a6aa8b6a', 'ESPN2': '2ad976f9aa4b4796a52ae3d64b50db9c', 'ACC Network': 'd3d1428e9fea47eab11a4f35f0bda64e', 'Disney Channel': '0e183596617d4425b9026cbf9603984b', 'Freeform': 'e4096cf09e774670beea3fd7c5887e09', 'FOX Sports 1': '0c6964d26bcd450cb7d8c8af10b9da20', 'FX': '2f5c3abe53004a3db6b236739c12a955', 'USA': '35b320ac77ce4a2fbaf685e401933dc1', 'Bravo': '287f100993794e62a24fa8e8fbcca906', 'SYFY': '385c71f4210f457eb393041e36ed50b2', 'E!': 'eb6e6c19dbaa498cbe5acfc45d3f0ea7', 'MS NOW': 'b708785d33964014896ab636042af863', 'Fox News': 'e78cd8c7cca443cba7a70c6008c0291f', 'Discovery': '73653704f85b4bde9855ef29a6d3196e', 'TLC': '793b8cc7bdca43d9acb91432e1ccd24d', 'National Geographic': '0245123bd2154a74b101db99f3e96f11', 'NFL Network': '8a595ee9235f4d7f8b95dd35d268cdd5'};
const SLING_ALIAS = { FS1: 'FOX Sports 1', 'USA Network': 'USA', MSNBC: 'MS NOW', Syfy: 'SYFY', 'Bloomberg Television': 'Bloomberg TV+', Vice: 'VICE', ACCN: 'ACC Network', 'FOX News': 'Fox News', 'Fox News Channel': 'Fox News', 'National Geographic Channel': 'National Geographic', 'Discovery Channel': 'Discovery', 'A&E Network': 'A&E', 'History Channel': 'History' };
const slingCh = n => { const id = n && (SLING_CH[n] || SLING_CH[SLING_ALIAS[n]]); return id ? 'https://watch.sling.com/1/channel/' + id + '/watch' : null; };
const chanUrl = (svc, n) => (svc && svc.startsWith('Sling') && slingCh(n)) || (SERVICE_URL[svc] ? SERVICE_URL[svc]('') : '');
// Free services need no account, so they always count as yours (Scott 11/08: "plus all free one")
const FREE_SVC = new Set(['Pluto TV', 'Tubi', 'Plex', 'Xumo Play', 'The Roku Channel', 'Samsung TV Plus']);
const NETWORK_SERVICE = { NBC: 'Peacock', Bravo: 'Peacock', USA: 'Peacock', CBS: 'Paramount+', 'CBS Sports Network': 'Paramount+', ABC: 'Hulu', FX: 'Hulu', HBO: 'HBO Max', TNT: 'HBO Max', TBS: 'HBO Max', TLC: 'HBO Max', Discovery: 'HBO Max', FOX: 'Fox One', FS1: 'Fox One', ESPN: 'ESPN', ESPN2: 'ESPN', ESPNU: 'ESPN', 'SEC Network': 'ESPN', ACCN: 'ESPN', Netflix: 'Netflix', Hulu: 'Hulu', 'Prime Video': 'Prime Video', 'Disney+': 'Disney+', 'HBO Max': 'HBO Max', Peacock: 'Peacock', 'Paramount+': 'Paramount+', 'Apple TV+': 'Apple TV', 'Apple TV': 'Apple TV' };
// Where a TV network's live games can be streamed (Scott 11/08: "show where all can be watched based on your accounts"). Claude's general knowledge, not a data feed: carriage can vary by area.
const YT = 'YouTube TV';
const NET_OPTS = { CBS: ['Paramount+', YT], CBSSN: ['Paramount+', YT], FOX: ['Fox One', YT], FS1: ['Fox One', YT, 'Sling Blue'], FS2: ['Fox One', YT], BTN: ['Fox One', YT], NBC: ['Peacock', YT], USA: ['Peacock', YT, 'Sling Blue'], PEACOCK: ['Peacock'], ABC: ['ESPN', YT], ESPN: ['ESPN', YT, 'Sling Orange'], ESPN2: ['ESPN', YT, 'Sling Orange'], ESPNU: ['ESPN', YT], SECN: ['ESPN', YT], ACCN: ['ESPN', YT, 'Sling Orange'], 'ESPN+': ['ESPN'], 'SECN+': ['ESPN'], ACCNX: ['ESPN'], TNT: ['HBO Max', YT, 'Sling Orange', 'Sling Blue'], TBS: ['HBO Max', YT, 'Sling Orange', 'Sling Blue'], TRUTV: ['HBO Max', YT, 'Sling Orange', 'Sling Blue'], 'PRIME VIDEO': ['Prime Video'], 'APPLE TV': ['Apple TV'], 'NBA TV': [YT], 'NFL NET': [YT, 'Sling Blue'], 'NHL NET': [YT], 'MLB NET': [YT] };
const SLING_BOTH = ['TNT', 'TBS', 'truTV', 'CNN', 'HLN', 'AMC', 'A&E', 'History', 'Lifetime', 'Food Network', 'HGTV', 'Travel Channel', 'Investigation Discovery', 'Comedy Central', 'Cartoon Network', 'Adult Swim', 'IFC', 'BBC America', 'Motor Trend', 'Vice', 'Bloomberg Television', 'Local Now'];
const LIVE_PKG = {   // '*' = a full live bundle (every channel in the guide); a list = only those channels; { not: [...] } = all but those
  'YouTube TV': '*', 'Hulu + Live TV': '*', 'DirecTV Stream': '*',
  Fubo: { not: ['TNT', 'TBS', 'truTV', 'CNN', 'HLN', 'Cartoon Network', 'Adult Swim', 'TCM'] },
  'Sling Orange': [...SLING_BOTH, 'ESPN', 'ESPN2', 'ESPN3', 'ACC Network', 'ACCN', 'Disney Channel', 'Freeform'],
  'Sling Blue': [...SLING_BOTH, 'FOX', 'NBC', 'FS1', 'FX', 'FXX', 'USA', 'USA Network', 'Bravo', 'Syfy', 'E!', 'Oxygen True Crime', 'MS NOW', 'MSNBC', 'CNBC', 'Fox News', 'Discovery', 'TLC', 'Animal Planet', 'National Geographic', 'NFL Network']
};
const pkgHas = (pk, n) => { const v = LIVE_PKG[pk]; return v === '*' || (Array.isArray(v) ? v.includes(n) : !v.not.includes(n)); };
const livePkgFor = n => Object.keys(LIVE_PKG).find(pk => S.mine.includes(pk) && pkgHas(pk, n)) || null;   // the live package of yours that carries channel n
const wayRank = svc => !S.mine.includes(svc) ? (FREE_SVC.has(svc) ? 1 : 3) : LIVE_PKG[svc] ? 0 : 2;   // your live package, then free, then your apps, then not yours
const optsFor = tv => [...new Set(tv.flatMap(n => NET_OPTS[String(n).toUpperCase()] || (NETWORK_SERVICE[n] ? [NETWORK_SERVICE[n]] : [])))].sort((a, b) => wayRank(a) - wayRank(b)).map(svc => ({ svc, url: SERVICE_URL[svc]('') }));
// every way this household can watch live channel n: the live packages that carry it, then the network's own app (Scott 11/14)
const waysFor = n => { const pk = Object.keys(LIVE_PKG).filter(k => S.mine.includes(k) && pkgHas(k, n)), app = NETWORK_SERVICE[n] && !['ABC', 'FX'].includes(n) ? [NETWORK_SERVICE[n]] : [], more = NET_OPTS[String(n).toUpperCase()] || [];
  return [...new Set([...pk, ...app, ...more])].filter(hasIt).sort((a, b) => wayRank(a) - wayRank(b)).map(svc => ({ svc, url: chanUrl(svc, n) })); };
// the household's own way in for anything (Scott 11/14 "i got asked to watch hbo max"): a ticked service as is; a live show -> your package
// or app that carries its channel (TNT -> Sling, not HBO Max); else one of its options you have; null = not on any of yours
const FREE_WEB = new Set(['YouTube', 'Freevee']);   // free movie lists (catalogs.js) that aren't free TV services: free for everyone
const ownSvc = v => !!v && (S.mine.includes(v) || FREE_SVC.has(v) || FREE_WEB.has(v));
function bestSvc(x) {
  if (!x) return null;
  if (!S.mine.length) return x.svc || null;
  const n = x.net || x.chan; if (n && !x.isGame) { const w = waysFor(n)[0]; if (w) return w.svc; }
  if (ownSvc(x.svc)) return x.svc;
  const o = (x.options || []).find(p => ownSvc(p.svc)); return o ? o.svc : null;
}
function notOnYours(svc) {
  const b = $('back'); if (b.open) return;
  b.innerHTML = `<b>Not on your services</b><p>${svc ? esc(svc) + ' isn’t' : 'That isn’t on any service'} ticked in your Settings, so Marvel Magic won’t open it. If you have it, tick it in ⚙ Settings → My Services.</p><div class="act"><button class="btn alt" data-nyok>OK</button><button class="btn" data-nyset>Open Settings</button></div>`
    + (svc && OFFER[svc] && offersOn() ? `<button class="btn" data-nyoffer style="width:100%;margin-top:8px">✨ Try ${esc(svc)}</button><p class="fine" style="margin:6px 0 0;opacity:.7">${OFFER_NOTE}</p>` : '');
  b.querySelector('[data-nyok]').onclick = () => b.close(); b.querySelector('[data-nyset]').onclick = () => { b.close(); showTab(10); }; const of = b.querySelector('[data-nyoffer]'); if (of) of.onclick = () => { b.close(); openOffer(svc); };
  b.showModal();
}
const SERVICES = Object.keys(SERVICE_URL).filter(n => !FREE_SVC.has(n));
// OFFERS (Scott 11/15: "yes show offers, let them turn it off and we add all streaming possible in settings with affiliate links").
// A show / game only on a service you don't have offers "Try it free"; Settings lists every service with a sign-up link. Viewers can turn
// offers off (Settings). Links = each service's own trial / sign-up page UNTIL its affiliate program approves us - then swap in the tracked
// link here (Fubo + Sling via Impact, Paramount+ / Peacock via FlexOffers, Philo...). Prime Video carries Scott's Amazon tag (usemart-20),
// so Amazon's disclosure shows wherever offers show. Never type an Amazon price by hand.
const AMZ_TAG = 'usemart-20';
const OFFER = {
  Fubo: 'https://www.fubo.tv/welcome', 'Sling Orange': 'https://www.sling.com/', 'Sling Blue': 'https://www.sling.com/', Philo: 'https://www.philo.com/',
  'Paramount+': 'https://www.paramountplus.com/', Peacock: 'https://www.peacocktv.com/', Hulu: 'https://signup.hulu.com/', 'Hulu + Live TV': 'https://signup.hulu.com/live-tv',
  'Prime Video': 'https://www.amazon.com/gp/video/storefront/?tag=' + AMZ_TAG, Starz: 'https://www.starz.com/', 'MGM+': 'https://www.mgmplus.com/', 'AMC+': 'https://www.amcplus.com/',
  BritBox: 'https://www.britbox.com/', 'Acorn TV': 'https://acorn.tv/', Shudder: 'https://www.shudder.com/', Crunchyroll: 'https://www.crunchyroll.com/', 'Discovery+': 'https://www.discoveryplus.com/',
  'BET+': 'https://www.bet.plus/', 'Hallmark+': 'https://www.hallmarkplus.com/', 'Frndly TV': 'https://try.frndlytv.com/', 'DirecTV Stream': 'https://streamtv.directv.com/',
  'YouTube TV': 'https://tv.youtube.com/', 'Disney+': 'https://www.disneyplus.com/', 'HBO Max': 'https://www.hbomax.com/', Netflix: 'https://www.netflix.com/signup', 'Apple TV': 'https://tv.apple.com/',
  'ESPN+': 'https://plus.espn.com/', ESPN: 'https://plus.espn.com/', 'Fox One': 'https://www.foxone.com/'
};
const offersOn = () => !load('offersOff', false);
const OFFER_NOTE = 'Offer · Marvel Magic may earn a commission. As an Amazon Associate I earn from qualifying purchases.';
function openOffer(svc) {
  const u = OFFER[svc]; if (!u) return;
  try { const o = load('offerClicks', {}); o[svc] = (o[svc] || 0) + 1; save('offerClicks', o); } catch {}
  if (typeof inTvApp === 'function' && inTvApp()) { try { MMNative.open(u, svc); } catch {} return; }   // TV: its app (it signs you up) or its store page
  const w = window.open(u, '_blank'); try { if (w) w.opener = null; } catch {}
}
const SLOT = 30 * 60000, SLOTS = 16;   // 8 hours from now (Scott 11/08)
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clock = d => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const save = (k, v) => { try { localStorage.setItem('mm_' + k, JSON.stringify(v)); } catch {} if (['mine', 'list', 'setup', 'ratings', 'rank', 'opens', 'teams', 'history', 'likes', 'actors', 'moods', 'profile', 'order', 'lastOpen', 'svcSince', 'svcSnooze', 'svcRemindOff', 'later', 'profiles', 'svcRate'].includes(k)) queueSync(); };
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem('mm_' + k)); return v == null ? d : v; } catch { return d; } };
const S = { freeSvc: load('freeSvc', /Tizen|SMART-TV.*Samsung|SamsungBrowser.*TV/i.test(navigator.userAgent) ? 'Samsung TV Plus' : 'All'), tab: HOME, mine: load('mine', []), list: load('list', []), airings: [], games: [], results: null, sel: null, err: '', eps: {}, setup: load('setup', []), ratings: load('ratings', {}), rank: load('rank', []), opens: load('opens', {}), history: load('history', []), teams: load('teams', []), teamGames: [], allTeams: null, teamHits: null, remind: load('remind', {}), plutoCat: null, pool: null, likes: load('likes', []), kids: load('kids', { on: false, pin: '' }), told: load('told', {}), cat: {}, order: load('order', []), shared: load('shared', false), house: null, houseRole: null, paired: load('paired', null), pairCode: null, prof: load('prof', null), profLock: load('profLock', false), profiles: load('profiles', {}), svcRate: load('svcRate', {}), later: load('later', []), lastOpen: load('lastOpen', {}), svcSince: load('svcSince', {}), svcSnooze: load('svcSnooze', {}), svcRemindOff: load('svcRemindOff', false), lists: null, viewList: null, actors: load('actors', []), moods: load('moods', []), profile: load('profile', {}) };
const items = [];   // what each on-screen button points at (data-i)
const hasIt = svc => !S.mine.length || S.mine.includes(svc) || FREE_SVC.has(svc) || FREE_WEB.has(svc);   // nothing ticked yet = show everything as available
const slug = t => encodeURIComponent(t);
function linkFor(x) { if (x.exact) return x.exact; const sc = x.svc && String(x.svc).startsWith('Sling') && slingCh(x.net || x.chan); if (sc) return sc; return x.svc && SERVICE_URL[x.svc] ? SERVICE_URL[x.svc](slug(x.title)) : x.url; }
const RELAY = 'https://script.google.com/macros/s/AKfycbzDFfE1Z_I8ZTYyQkCpMS45l2V8c7HTcm6-uwNxxgnUbX8VGSDw2-5t4_tqZiPcqW2zQQ/exec';
const relay = q => fetch(RELAY + '?' + new URLSearchParams(q)).then(r => r.json());
function svcOf(n) {
  const t = String(n).toLowerCase();
  if (t === 'the roku channel') return 'The Roku Channel';
  if (/^tubi/.test(t)) return 'Tubi'; if (t === 'plex') return 'Plex'; if (/^xumo/.test(t)) return 'Xumo Play';
  if (/via (amazon|apple|hulu)|channel/.test(t)) return null;   // add-on versions come after the service's own app
  return /netflix/.test(t) ? 'Netflix' : /hulu/.test(t) ? 'Hulu' : /prime video/.test(t) ? 'Prime Video' : /disney/.test(t) ? 'Disney+' : /hbo max|^max$/.test(t) ? 'HBO Max' : /peacock/.test(t) ? 'Peacock' : /paramount/.test(t) ? 'Paramount+' : /^apple ?tv/.test(t) ? 'Apple TV' : /youtube tv/.test(t) ? 'YouTube TV' : /pluto/.test(t) ? 'Pluto TV' : /espn/.test(t) ? 'ESPN' : null;
}
// enrich(x) always hands back the same lookup, so a Watch click can wait for one that is already running (Scott 11/15 "it dont go to what you clicked")
function enrich(x) { if (x.sport) return Promise.resolve(); if (!x.looked) { x.looked = true; x._look = enrichNow(x); } return x._look || Promise.resolve(); }
async function enrichNow(x) {
  try {
    let id = x.wmId;
    if (!id) {
      const f = await relay({ a: 'find', q: x.title }), want = x.title.toLowerCase(), rows = f.results || [];
      const hit = rows.find(r => r.name.toLowerCase() === want && /^tv/.test(r.type)) || rows.find(r => r.name.toLowerCase() === want); if (!hit) return; id = hit.id;
    }
    const w = await relay({ a: 'where', id }); if (!w.sources || !w.sources.length) return;
    // some links come wrapped in a tracking redirect (paramountplus.qflm.net/...?u=<real page>): use the real page, which the TV apps accept
    const unwrap = u => { try { const q = new URL(u).searchParams.get('u'); return q && /^https?:\/\//.test(q) ? q : u; } catch { return u; } };
    const rows = w.sources.filter(r => r.web).map(r => ({ ...r, web: unwrap(r.web), svc: svcOf(r.name) }));
    const seen = new Set(), own = rows.filter(r => r.svc && !seen.has(r.svc) && seen.add(r.svc)).sort((a, b) => Number(hasIt(b.svc)) - Number(hasIt(a.svc)) || Number(b.type === 'sub') - Number(a.type === 'sub'));
    // a movie from a full movie list (catalogs.js, 11/16) opens on the service it was listed on: its own page there
    const pr = x.pref && rows.find(r => x.pref === 'YouTube' ? r.type === 'free' && /^youtube$/i.test(r.name) : x.pref === 'Freevee' ? /freevee/i.test(r.name) : r.svc === x.pref);
    if (pr) { x.exact = pr.web; x.svc = x.pref; x.place = pr.name; x.options = [{ svc: x.pref, url: pr.web }, ...own.filter(r => r.svc !== x.pref).map(r => ({ svc: r.svc, url: r.web }))]; if (S.sel === x) { const y = window.scrollY; draw(); window.scrollTo(0, y); } return; }
    const best = own[0] || rows[0]; if (!best) return;
    x.exact = best.web; x.svc = best.svc; x.place = best.name;
    x.options = own.map(r => ({ svc: r.svc, url: r.web }));
    if (S.sel === x) { const y = window.scrollY; draw(); window.scrollTo(0, y); }
  } catch {}
}
const reg = x => (items.push(x), items.length - 1);

// Scott 11/14 "when time moves it still shows whats playing": a show that started before the visible edge keeps its title readable
function stickTitles() {
  for (const id of ['ggrid', 'fgrid']) { const g = $(id); if (!g) continue;
  const edge = g.getBoundingClientRect().left + 190;   // just right of the sticky channel column
  for (const c of g.querySelectorAll('.cell')) { const r = c.getBoundingClientRect(); c.style.paddingLeft = (12 + Math.max(0, Math.min(edge - r.left, r.width - 70))) + 'px'; } }
}
function draw() {
  const had = focusables().indexOf(document.activeElement), gx = $('ggrid') ? $('ggrid').scrollLeft : 0, fx = $('fgrid') ? $('fgrid').scrollLeft : 0;
  items.length = 0;
  document.body.classList.toggle('easy', activeEasy());
  // 11/15 (Scott: "also on mm on left menu a search bar button"): Search sits under Home - same as Home's Search button (Movies & Shows, cursor in the box)
  const navSearch = `<button data-tab="1" data-q class="navsearch"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.5-4.5"/></svg><span>Search</span></button>`;
  $('nav').innerHTML = NAV_ORDER.filter(i => !(kidsOn() && i === 2)).map((i, k) => `<button data-tab="${i}" ${i === S.tab ? 'aria-current="page"' : ''}>${icon(i)}<span>${esc(TABS[i])}</span></button>` + (k === 0 ? navSearch : '')).join('');
  $('view').innerHTML = [guide, shows, sports, stuff, freePage, ratingsPage, watchedPage, home, comingPage, forYouPage, settingsPage][S.tab]();
  $('signside').innerHTML = sideFoot();
  document.body.dataset.tab = S.tab;
  drawAcct();
  dock();
  if (gx && $('ggrid')) $('ggrid').scrollLeft = gx;   // Scott 11/14: the guide keeps your place when it refreshes
  if (fx && $('fgrid')) $('fgrid').scrollLeft = fx;
  drawPairQr(); if (linkPair) setTimeout(maybeApproveFromLink, 50);
  for (const id of ['ggrid', 'fgrid']) if ($(id)) $(id).addEventListener('scroll', () => requestAnimationFrame(stickTitles), { passive: true });
  stickTitles();
  if (had >= 0) { const f = focusables(); (f[had] || f[f.length - 1]).focus({ preventScroll: true }); }
}
const rateKey = x => x.show ? 's' + x.show.id : x.key;
function rateRow(x) {
  if (x.sport) return '';
  const cur = (S.ratings[rateKey(x)] || {}).score;
  return `<div class="where rate hearts sm"><span>My rating:</span>${[1, 2, 3, 4, 5].map(n => `<button class="${n <= (cur || 0) ? 'on' : ''}" data-rate="${n}" aria-label="${n} of 5 hearts">${n <= (cur || 0) ? '♥' : '♡'}</button>`).join('')}${cur ? `<span>${fmtH(cur)}</span>` : ''}</div>`;
}
// TRACKER (Scott 11/08: "a tracker on all things watched by me"). Services don't report viewing, so this logs what's opened or marked in Marvel Magic; anything wrong can be removed.
const dayKey = t => new Date(t).toDateString();
function logWatch(e) { const at = Date.now(); S.history = [{ ...e, at }, ...S.history.filter(h => h.k !== e.k)].slice(0, 1500); save('history', S.history); }
function logPick(x) { if (!x || x.series) return; logWatch({ k: rateKey(x) + '-' + dayKey(Date.now()), title: x.title, kind: x.sport ? 'Sports' : 'Movie', svc: x.svc || x.place || '', img: x.img || null }); }
function countOpen(svc) { if (!svc) return; S.opens[svc] = (S.opens[svc] || 0) + 1; save('opens', S.opens); S.lastOpen[svc] = Date.now(); save('lastOpen', S.lastOpen); }
function whereRow(x) {
  if (!x.options || !x.options.length) return '';
  const o = x.options.filter(p => hasIt(p.svc));   // only services you ticked (Scott 11/14)
  if (!o.length) return '<div class="where"><span>Not on any of your services.</span></div>';
  return `<div class="where"><span>Watch on:</span>${o.map(p => `<a class="${hasIt(p.svc) ? 'yours' : 'notyours'}" data-opt href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.svc)}${hasIt(p.svc) ? ' ✓' : ''}</a>`).join('')}</div>`;
}
function dock() {
  const d = $('dock'), x = S.sel; d.hidden = !x; if (!x) return;
  const ok = !x.svc || hasIt(x.svc);
  d.innerHTML = `<div class="t"><b>${esc(x.title)}</b><small class="${ok ? '' : 'no'}">${esc(x.note || '')}${!ok ? ' · ' + esc(x.svc) + ' is not one of your services' : ''}</small>${whereRow(x)}${rateRow(x)}</div>
    ${x.show ? `<button class="btn alt" data-save>${S.list.some(s => s.id === x.show.id) ? 'Saved' : 'Save'}</button>` : ''}
    <button class="btn alt" data-later>${isLater(x) ? '✓ Watch Later' : '⏰ Watch Later'}</button>
    <button class="btn" data-open ${ok ? '' : 'disabled'}>${x.svc ? 'Open in ' + esc(x.svc) : x.place ? 'Open in ' + esc(x.place) : 'Open'}</button>`;
}
// GUIDE DATA (Scott 11/14 "we need more usable data in it"): ESPN's channel names -> the guide's channel names, game lengths, channel types.
const GNET = { SECN: 'SEC Network', ACCN: 'ACC Network', BTN: 'Big Ten Network', CBSSN: 'CBS Sports Network', 'NFL NET': 'NFL Network', 'NHL NET': 'NHL Network', 'MLB NET': 'MLB Network', 'NBA TV': 'NBA TV', TRUTV: 'truTV', truTV: 'truTV', 'USA Net': 'USA', 'USA NET': 'USA', 'ESPN+': 'ESPN+', 'SECN+': 'ESPN+', ACCNX: 'ESPN+', PEACOCK: 'Peacock', Peacock: 'Peacock', 'Prime Video': 'Prime Video', 'Apple TV': 'Apple TV' };
const gnet = t => GNET[t] || GNET[String(t).toUpperCase()] || t;
const GAME_MIN = { NFL: 200, 'College Football': 210, NBA: 150, 'College Basketball': 130, NHL: 155, MLB: 185 };
const NEWS_NETS = new Set(['CNN', 'HLN', 'MS NOW', 'MSNBC', 'Fox News', 'CNBC', 'Bloomberg Television', 'ABC News Live', 'Local Now', 'NewsNation']);
const SPORT_NETS = new Set(['ESPN', 'ESPN2', 'ESPN3', 'ESPNU', 'ESPN+', 'FS1', 'FS2', 'ACC Network', 'SEC Network', 'Big Ten Network', 'CBS Sports Network', 'NFL Network', 'NBA TV', 'NHL Network', 'MLB Network', 'Golf Channel']);
const MOVIE_NETS = new Set(['AMC', 'IFC', 'TCM', 'Hallmark Channel', 'Lifetime', 'Freeform', 'Syfy', 'FX', 'FXX']);
const gapWord = n => NEWS_NETS.has(n) ? 'Live news' : SPORT_NETS.has(n) ? 'Sports' : MOVIE_NETS.has(n) ? 'Movies & shows' : 'No listing';
// a game as a guide listing on each of its channels (one card per channel it airs on)
function gameAirings(t0, t1) {
  const out = [];
  for (const g of S.games) {
    if (g.state === 'post' && Date.now() - g.when > 6 * 3600000) continue;
    const len = (GAME_MIN[g.league] || 180) * 60000, end = g.state === 'in' ? Math.max(g.when + len, Date.now() + 20 * 60000) : g.state === 'post' ? g.when + len : g.when + len;
    if (end <= t0 || g.when >= t1) continue;
    for (const raw of (g.tv || [])) { const net = gnet(raw); out.push({ ...g, key: g.key + '@' + net, gkey: g.key, net, start: g.when, end, title: (g.away || '') + ' at ' + (g.home || ''), isGame: true }); }
  }
  return out;
}
// LIVE TV GUIDE (Scott 11/14 "Magic Guide" board): big preview of the picked show, the grid, the Magic Sports ticker. Art + summaries from TVmaze.
