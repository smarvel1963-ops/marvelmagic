// js/home.js
// Save to: C:\MarvelApps\marvelmagic\js\home.js
// Marvel Magic - Home, taste, Coming Soon, For You, hearts, Kids Lock, cast, new episode alerts, open + come back, reviews, kick back, unused service reminder, free previews.
// Split out of index.html 2026-11-15 (sell-readiness pass). Plain script, shared global scope, loaded in order:
// core -> guide -> sports -> home -> app. After editing, run  python tools\stamp_versions.py  then  python tests\smoke_test.py

const firstName = () => (S.profile && S.profile.name) || (me ? ((me.displayName || me.email || '').split(/[ @]/)[0]) : '');
const sideFoot = () => `<div class="sf"><div class="sfme"><span class="av">${esc((firstName() || 'G')[0].toUpperCase())}</span><b>${esc(firstName() || 'Guest')}</b></div>${kidsOn() ? '<button class="btn sfbtn" data-kids>🔒 Kids Lock ON</button>' : ''}</div>`;
const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
const cdText = when => { const s = Math.max(0, Math.floor((when - Date.now()) / 1000)); if (!s) return 'Starting now'; const p = n => String(n).padStart(2, '0'); return s >= 86400 ? Math.floor(s / 86400) + 'd ' + p(Math.floor(s % 86400 / 3600)) + 'h' : p(Math.floor(s / 3600)) + ':' + p(Math.floor(s % 3600 / 60)) + ':' + p(s % 60); };
function homeGame() {
  const mineT = g => g.teams && S.teams.some(t => t.path === g.path && g.teams.includes(t.id));
  const live = S.games.filter(g => g.state === 'in');
  const p = live.find(mineT) || S.teamGames.filter(g => g.when > Date.now() - 4 * 3600000).sort((a, b) => a.when - b.when)[0] || live[0] || S.games.filter(g => g.state === 'pre').sort((a, b) => a.when - b.when)[0];
  return p ? (S.games.find(g => g.key === p.key) || p) : null;   // the scoreboard copy carries the live score
}
// TASTE (Scott 11/14): one genre score from everything the viewer has told us; grows as they tick likes, rate, save and watch
const MOOD2G = { Funny: ['Comedy'], Action: ['Action', 'Adventure'], Mystery: ['Mystery', 'Crime'], Romance: ['Romance'], Scary: ['Horror', 'Thriller'], 'Feel-good': ['Family', 'Comedy'], 'Family Night': ['Family', 'Children'], 'True story': ['History', 'Documentary'] };
function tasteMap() {
  const t = {}, add = (g, w) => { if (g) t[g] = (t[g] || 0) + w; };
  for (const g of S.likes) add(g, 3);
  for (const m of S.moods) for (const g of (MOOD2G[m] || [])) add(g, 1.5);
  for (const sh of S.list) for (const g of (sh.genres || [])) add(g, 1);
  for (const r of Object.values(S.ratings)) for (const g of (r.genres || [])) add(g, (r.score - 3) * 0.8);   // 5 hearts +1.6, 1 heart -1.6
  return t;
}
function whyTonight(a, t) {
  const g = ((a.show && a.show.genres) || []).filter(x => (t[x] || 0) > 0).sort((x, y) => t[y] - t[x])[0];
  if (S.list.some(sh => a.show && sh.id === a.show.id)) return 'on your watchlist';
  if (S.history.some(h => h.title === a.title)) return 'you watched this';
  return g ? 'because you like ' + g : '';
}
function tonightScore(a, t) {
  const sh = a.show || {}, title = String(a.title || '').toLowerCase();
  let sc = (sh.weight || 0) / 20;                                                   // popularity is only the tie-breaker
  for (const g of (sh.genres || [])) sc += (t[g] || 0) * 2;
  if (S.list.some(x => x.id === sh.id)) sc += 12;                                   // a show you follow
  if (S.history.some(h => String(h.title || '').toLowerCase() === title)) sc += 5;  // you've watched it
  if (S.later.some(l => String(l.title || '').toLowerCase() === title)) sc += 8;    // saved for later
  const r = Object.values(S.ratings).find(x => String(x.title || '').toLowerCase() === title); if (r) sc += (r.score - 3) * 4;
  const sv = a.svc || NETWORK_SERVICE[a.net]; if (sv) sc += (S.svcRate[sv] ? (S.svcRate[sv] - 3) * 1.5 : 0) + Math.min(4, (S.opens[sv] || 0) / 5);
  return sc;
}
function home() {
  const now = Date.now(), sel = x => S.sel && S.sel.key === x.key ? ' on' : '';
  const rows = S.list.map(s => ({ s, t: track(s), x: { key: 's' + s.id, title: s.name, svc: NETWORK_SERVICE[s.net] || null, url: s.url, note: s.net, series: true, img: s.img, show: s } })).filter(r => r.t);
  const order = { Watching: 0, 'Up Next': 1 }, cont = rows.filter(r => r.t.status in order && kidOk({ genres: r.s.genres || [], net: r.s.net })).sort((a, b) => order[a.t.status] - order[b.t.status]).slice(0, 3);
  const fresh = rows.filter(r => r.t.fresh).length;
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const cw = r => `<div class="pw"><button class="cw${sel(r.x)}" data-i="${reg(r.x)}"><span class="cwart">${r.s.img ? `<img src="${esc(r.s.img)}"${tvmSet(r.s.img)} alt="" loading="lazy">` : ''}${r.x.svc || r.s.net ? `<span class="sv">${esc(r.x.svc || r.s.net)}</span>` : ''}</span><span class="cwbar"><i style="width:${pct(r.t.seasonSeen, r.t.seasonTotal)}%"></i></span><span class="cwt"><b>${esc(r.s.name)}</b><small>${r.t.next ? esc(epLabel(r.t.next) + (r.t.next.name ? ' · ' + r.t.next.name : '')) : 'All caught up'}</small></span></button>${thumbBtn(r.x)}</div>`;
  const canSee = n => !S.mine.length || !!livePkgFor(n) || S.mine.includes(NETWORK_SERVICE[n]);
  const eod = new Date(); eod.setHours(23, 59, 59, 999);
  const taste = tasteMap(), seen = new Set(), tonight = S.airings.filter(a => a.end > now && a.start < eod.getTime() && canSee(a.net) && kidOk(a) && a.show && !seen.has(a.show.id) && seen.add(a.show.id)).sort((a, b) => tonightScore(b, taste) - tonightScore(a, taste)).slice(0, 4).sort((a, b) => a.start - b.start);
  const teamGame = S.games.filter(g => g.state !== 'post' && mineGame(g)).sort((a, b) => a.when - b.when)[0];   // a favorite team plays tonight: it leads
  const otr = a => { const why = whyTonight(a, taste); return `<button class="otr${sel(a)}" data-i="${reg(a)}"><span class="net">${esc(a.net)}</span><span class="t"><b>${esc(a.title)}</b><small>${esc([a.ep, a.start <= now ? 'On now' : clock(new Date(a.start))].filter(Boolean).join(' · '))}</small>${why ? `<small class="otwhy">${esc(why)}</small>` : ''}</span></button>`; };
  const otg = g => `<button class="otr${sel(g)}" data-i="${reg(g)}"><span class="net">${esc((g.tv || [])[0] || g.league)}</span><span class="t"><b>${tlogo(g.awayLogo)}${esc(g.away)} at ${tlogo(g.homeLogo)}${esc(g.home)}</b><small>${esc(g.state === 'in' ? 'LIVE ' + g.score + ' · ' + g.detail : clock(new Date(g.when)))}</small><small class="otwhy">your team</small></span></button>`;
  const g = homeGame(), today = S.games.filter(x => x.state !== 'post').length;
  const gameBox = !g ? `<p class="fine">${S.gamesDone ? 'No games today. Add your teams on the Sports page.' : 'Loading games…'}</p>` : `<button class="gm${sel(g)}" data-i="${reg(g)}"><span class="lg">${esc(g.note.split(' · ')[0])}</span><span class="vs"><b>${tlogo(g.awayLogo, 'hlg')}${esc(g.away || g.title)}</b><i>VS</i><b>${tlogo(g.homeLogo, 'hlg')}${esc(g.home || '')}</b></span>${
    g.state === 'in' ? `<span class="glive">● LIVE · ${esc(g.detail)}</span><span class="gsc">${esc(g.score)}</span>` : g.state === 'post' ? `<span class="ko">FINAL</span><span class="gsc">${esc(g.score)}</span>` : `<span class="ko">STARTS IN</span><span class="cd" data-when="${g.when}">${esc(cdText(g.when))}</span><small class="fine">${esc(g.detail)}</small>`}</button>${whereRow(g)}`;
  const paid = S.mine.filter(n => !FREE_SVC.has(n));
  const line = [fresh ? `${fresh} new episode${fresh === 1 ? '' : 's'} ready` : '', today ? `${today} game${today === 1 ? '' : 's'} on today` : ''].filter(Boolean).join(' · ') || 'Pick something and we open it in the right app.';
  return `<div class="htop"><div class="hgreet">${esc(greet())}${firstName() ? ', ' + esc(firstName()) : ''}${houseKids().length && !S.profLock && !S.paired ? `<span class="whow"><small>Who's watching?</small><button class="av hhav ${S.prof ? '' : 'on'}" data-whome title="${esc(firstName() || 'Me')}">${esc((firstName() || 'M')[0].toUpperCase())}</button>${houseKids().map(k => `<button class="av hhav ${k.type === 'Kid' ? 'kid' : ''} ${S.prof === k.id ? 'on' : ''}" data-whoprof="${esc(k.id)}" title="${esc(k.name)}">${esc(k.name[0].toUpperCase())}</button>`).join('')}</span>` : ''}</div><button class="pill" data-tab="1" data-q>🔍 Search</button><button class="pill" data-kids>${kidsOn() ? '🔒 Kids ON' : '👪 Kids Lock'}</button>${kidsOn() ? '' : '<button class="pill" data-tab="10">⚙ Settings</button>'}<span class="hclock" id="hclock">${esc(clock(new Date()))}</span></div>
    ${!S.paired && (!me || me.isAnonymous) ? pairPanel() : ''}${previewCards()}${unusedCards()}<section class="hero"><div class="hero-sky"></div><div class="hero-art"></div><div class="hero-planet"></div><div class="hero-hills"></div><div class="hero-in"><h1 class="ht">Tonight on<br><em>Marvel Magic</em></h1><p class="hs">${esc(line)}</p><div class="hb"><button class="btn gold" data-tab="1">▶ Find Something to Watch</button><button class="btn ghost" data-tab="0">Open Live TV Guide</button></div></div></section>
    <div class="hgrid"><section class="cwbox"><div class="hh"><h2>Continue Watching</h2><button class="more" data-tab="3">See all ›</button></div>${cont.length ? `<div class="cwrow">${cont.map(cw).join('')}</div>` : `<div class="hbox" style="padding:16px"><p class="fine" style="margin:0">${S.list.length ? 'Loading your shows…' : 'Save a show in Movies &amp; Shows and it shows up here with where you left off.'}</p></div>`}</section>
      <section><div class="hh"><h2>On Tonight <small class="fine">for you</small></h2><button class="more" data-tab="0">Guide ›</button></div><div class="hbox">${teamGame ? otg(teamGame) : ''}${tonight.length ? tonight.slice(0, teamGame ? 3 : 4).map(otr).join('') : `<p class="fine" style="padding:14px;margin:0">${S.airings.length ? 'Nothing else on your channels tonight.' : 'Loading tonight’s listings…'}</p>`}</div></section>
      ${kidsOn() ? '<section class="game"><div class="hh"><h2>🔒 Kids Lock</h2></div><p class="fine">Kids\' channels and family shows only. Sports and settings are hidden.</p><button class="pill" data-kids>Turn off (PIN)</button></section>' : `<section class="game"><div class="hh"><h2>Where's My Game?</h2><button class="more" data-tab="2">All ›</button></div>${gameBox}</section>`}</div>
    ${catchUp(3, '⏩ Catch Up', true)}
    ${leavingSoon(3, '⏳ Leaving Soon', true)}
    ${freeTonight()}
    ${(() => {   // Scott 11/14: "mention free tv in the guide, not waste all that room ... something far cooler in that spot"
      const hot = (S.pool || []).filter(x => x.prem).map(poolItem).filter(x => kidOk(x) && yours(x) && x.img && x.when - now < 8 * 86400000).sort((a, b) => b.w - a.w).slice(0, 6);
      const alt = hot.length ? [] : tonightPicks().filter(kidOk).slice(0, 6);
      const nFree = FREE_G && FREE_G.ch && FREE_G.ch.length ? FREE_G.ch.length.toLocaleString() : '1,500+';
      return `<section><div class="hh" style="margin-top:22px"><h2>${hot.length ? '🔥 Coming This Week on Your Services' : '🔥 Popular Tonight'}</h2><button class="more" data-tab="${hot.length ? 8 : 1}">See all ›</button></div>
        ${hot.length || alt.length ? `<div class="lgrid six">${hot.length ? hot.map(hposter).join('') : alt.map(x => lposter(x)).join('')}</div>` : `<p class="fine">${S.poolBusy ? 'Finding this week’s premieres…' : 'Loading…'}</p>`}</section>
        ${S.later.length ? `<section><div class="hh" style="margin-top:22px"><h2>⏰ Watch Later</h2><button class="more" data-tab="3">See all ›</button></div>${laterRow(6)}</section>` : ''}
        <button class="freebar" data-tab="0"><span class="fbi">📺</span><span class="t"><b>${nFree} free channels with schedules are in your Live TV Guide</b><small>Pluto TV · Samsung TV Plus · Plex · Roku Channel. No subscription.</small></span><span class="fbgo">Open guide ›</span></button>`;
    })()}
    <div class="hfoot"><p class="fine">Watch buttons open the official service in its own window or app. Marvel Magic doesn't play video itself.</p><div class="svchips"><b>Your services:</b>${paid.length ? paid.slice(0, 4).map(n => `<span>${esc(n)} ✓</span>`).join('') + (paid.length > 4 ? `<span>+${paid.length - 4} more</span>` : '') : '<button class="pill" data-tab="3">Set them up</button>'}</div></div>${credit()}`;
}
// COMING SOON (HOT) + FOR YOU + KIDS LOCK (Scott 11/14: "a coming soon HOT page based on what channels you currently have", "its own recommendation
// page based on your needs", "children lockouts"). Premieres + upcoming shows from TVmaze's day schedules for the next 3 weeks, kept 6 hours on this device.
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// 11/20: the guide (loadGuide) and the show pool (loadPool) both asked TVmaze for today's + tomorrow's US schedule at the same moment, so
// ~300 KB came down twice. One download per address, shared for 10 minutes; a failed one is not kept and still fails for the caller.
const TVM_GET = new Map();
function tvmGet(u) {
  const c = TVM_GET.get(u); if (c && Date.now() - c.at < 600000) return c.p;
  const p = fetch(u).then(r => r.ok ? r.json() : []).catch(e => { TVM_GET.delete(u); throw e; });
  TVM_GET.set(u, { at: Date.now(), p }); return p;
}
async function loadPool(force) {
  if (S.poolBusy) return;
  const c = load('pool', null);
  if (!force && c && Date.now() - c.at < 6 * 3600000) { S.pool = c.shows; return; }
  S.poolBusy = true;
  const days = Array.from({ length: 21 }, (_, n) => ymd(new Date(Date.now() + n * 86400000)));
  const urls = days.flatMap(d => [`https://api.tvmaze.com/schedule?country=US&date=${d}`, `https://api.tvmaze.com/schedule/web?date=${d}`]);
  const raw = [];
  for (let i = 0; i < urls.length; i += 8) {   // TVmaze allows about 20 calls per 10 seconds
    const part = await Promise.all(urls.slice(i, i + 8).map(u => tvmGet(u).catch(() => [])));
    raw.push(...part.flat());
    if (i + 8 < urls.length) await new Promise(r => setTimeout(r, 4200));
  }
  const by = {}, cut = Date.now() - 86400000;
  for (const e of raw) {
    const s = e.show || (e._embedded && e._embedded.show); if (!s || !e.airstamp) continue;
    const ch = s.network || s.webChannel || {}, cc = ch.country && ch.country.code; if (cc && cc !== 'US') continue;
    const t = Date.parse(e.airstamp); if (t < cut) continue;
    let x = by[s.id];
    if (!x) x = by[s.id] = { id: s.id, name: s.name, net: ch.name || '', genres: s.genres || [], w: s.weight || 0, img: s.image && (s.image.original || s.image.medium) || null, sum: strip(s.summary).slice(0, 170), url: s.officialSite || s.url, next: t, prem: null };
    if (t < x.next) x.next = t;
    if (e.number === 1 && (!x.prem || t < x.prem.at)) x.prem = { at: t, season: e.season };
  }
  S.pool = Object.values(by).filter(x => x.prem || x.w >= 60);
  save('pool', { at: Date.now(), shows: S.pool });
  S.poolBusy = false;
  if ([8, 9, HOME].includes(S.tab)) { const y = window.scrollY; draw(); window.scrollTo(0, y); }
}
const poolItem = x => ({ key: 's' + x.id, title: x.name, svc: NETWORK_SERVICE[x.net] || null, url: x.url, note: [x.net, x.genres.slice(0, 2).join(', ')].filter(Boolean).join(' · '), series: true, img: x.img, big: x.img, net: x.net, w: x.w, when: x.prem ? x.prem.at : x.next, prem: x.prem, sum: x.sum, show: { id: x.id, name: x.name, net: x.net, img: x.img, url: x.url, genres: x.genres } });
// "your channels": a service you ticked, a free service, or any TV network when you have YouTube TV (a live bundle)
const yours = x => S.mine.length ? ((x.svc && hasIt(x.svc)) || !!livePkgFor(x.net || x.chan || '')) : true;
const daysTo = t => { const d = Math.round((new Date(new Date(t).toDateString()) - new Date(new Date().toDateString())) / 86400000); return d <= 0 ? 'Today' : d === 1 ? 'Tomorrow' : 'In ' + d + ' days'; };
const _hposter = x => `<button class="lp hp${S.sel && S.sel.key === x.key ? ' on' : ''}${yours(x) ? '' : ' off'}" data-i="${reg(x)}">${x.img ? `<img src="${esc(x.img)}"${tvmSet(x.img)} alt="" loading="lazy">` : `<span class="lpno">🎬</span>`}${x.prem ? `<span class="hot">${x.prem.season === 1 ? 'NEW SERIES' : x.prem.season > 100 ? 'NEW SEASON' : 'SEASON ' + x.prem.season}</span>` : ''}<span class="lpt"><b>${esc(x.title)}</b>${x.svc || x.net ? `<span class="hsv">${esc(x.svc || x.net)}</span>` : ''}<small>${esc(new Date(x.when).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }))} · <em>${esc(daysTo(x.when))}</em></small></span></button>`;
// HEARTS (Scott 11/14): a 👍 on every show / movie picture opens 1-5 hearts (scale 5.0); the rating feeds My Top 50 (move it with ▲▼ there)
const fmtH = n => (Math.round(Number(n || 0) * 2) / 2).toFixed(1);
const heartsTxt = n => '♥'.repeat(Math.round(n)) + '♡'.repeat(5 - Math.round(n));
const myRating = x => { const r = x && S.ratings[rateKey(x)]; return r ? r.score : 0; };
const thumbBtn = x => { const r = myRating(x); return `<button class="thumb${r ? ' on' : ''}" data-thumb="${reg(x)}" aria-label="Rate ${esc(x.title)}">${r ? '♥ ' + fmtH(r) : '👍'}</button>`; };
const lposter = (x, big) => `<div class="pw">${_lposter(x, big)}${thumbBtn(x)}</div>`;
const hposter = x => `<div class="pw">${_hposter(x)}${thumbBtn(x)}</div>`;
function setRating(x, n) {
  const k = rateKey(x);
  if (!n) delete S.ratings[k];
  else S.ratings[k] = { ...(S.ratings[k] || {}), title: x.title, img: x.big || x.img || (x.show && (x.show.img || (x.show.image && x.show.image.medium))) || (S.ratings[k] || {}).img || null, kind: x.series ? 'Show' : 'Movie', svc: x.svc || (S.ratings[k] || {}).svc || null, genres: (x.show && x.show.genres) || x.genres || (S.ratings[k] || {}).genres || [], score: n, at: Date.now() };
  save('ratings', S.ratings); if (typeof shareRefresh === 'function') shareRefresh();
}
function rateBox(x) {
  const b = $('back'); if (b.open) b.close();
  const cur = myRating(x);
  b.innerHTML = `<b>Rate ${esc(x.title)}</b><div class="hearts"><button class="hplus ${isLater(x) ? 'on' : ''}" data-hadd aria-label="${isLater(x) ? 'On your Watch Later list - tap to remove' : 'Add to Watch Later'}">${isLater(x) ? '✓' : '+'}</button>${[1, 2, 3, 4, 5].map(n => `<button class="${n <= cur ? 'on' : ''}" data-h="${n}" aria-label="${n} of 5 hearts">${n <= cur ? '♥' : '♡'}</button>`).join('')}</div><p class="fine" id="hlab">${cur ? fmtH(cur) + ' of 5.0' : 'Tap a heart'}</p><div class="act">${cur ? '<button class="btn alt" data-hclear>Clear</button>' : ''}<button class="btn alt" data-hx>Close</button></div>`;
  b.querySelectorAll('[data-h]').forEach(h => h.onclick = () => { setRating(x, Number(h.dataset.h)); b.close(); const y = window.scrollY; draw(); window.scrollTo(0, y); });
  const c = b.querySelector('[data-hclear]'); if (c) c.onclick = () => { setRating(x, 0); b.close(); draw(); };
  b.querySelector('[data-hadd]').onclick = e => { toggleLater(x); const on = isLater(x), el = e.currentTarget; el.textContent = on ? '✓' : '+'; el.classList.toggle('on', on); el.setAttribute('aria-label', on ? 'On your Watch Later list - tap to remove' : 'Add to Watch Later'); const l = b.querySelector('#hlab'); if (l) l.textContent = on ? 'Added to Watch Later' : 'Taken off Watch Later'; };
  b.querySelector('[data-hx]').onclick = () => b.close();
  b.showModal(); (b.querySelector('[data-h]') || b).focus();
}
function comingPage() {
  const loading = !S.pool ? `<p class="fine">${S.poolBusy ? 'Gathering the next 3 weeks of premieres… about 20 seconds the first time.' : 'Loading…'}</p>` : '';
  const prem = (S.pool || []).filter(x => x.prem).map(poolItem).filter(kidOk).sort((a, b) => b.w - a.w || a.when - b.when);
  const mine = prem.filter(yours), other = prem.filter(x => !yours(x));
  const soon = mine.filter(x => x.when - Date.now() < 7 * 86400000).length;
  return `<img class="top50ban" src="banner_hot.jpg" alt="Coming Soon - HOT on Your Channels: new shows and seasons arriving on your services"><section class="hothero hothero-b"><div class="hothero-in"><p class="lsub2">New series and new seasons coming to the services you have, the next 3 weeks.${S.pool ? ` <b>${mine.length}</b> premieres for you, <b>${soon}</b> this week.` : ''}</p>
      <p class="fine" style="margin:0">Tap one and Save it: it goes on your watchlist and you get the New Episode alert the day it drops.</p></div></section>
    ${loading}${S.pool ? `<div class="hh" style="margin-top:18px"><h2>🔥 Premieres on Your Services</h2><button class="more" data-refpool>Refresh</button></div>${mine.length ? `<div class="lgrid">${mine.slice(0, 18).map(hposter).join('')}</div>` : `<p class="fine">${S.mine.length ? 'No premieres on your services in the next 3 weeks.' : ''}</p>`}
    ` : ''}
    <p class="fine">Schedules from <a href="https://www.tvmaze.com/" target="_blank" rel="noopener">TVmaze</a> (CC BY-SA). Dates can change.</p>`;
}
const GENRES = ['Drama', 'Comedy', 'Crime', 'Thriller', 'Action', 'Adventure', 'Science-Fiction', 'Fantasy', 'Mystery', 'Romance', 'Horror', 'Family', 'Children', 'Anime', 'Food', 'Travel', 'Nature', 'History', 'Sports', 'Music', 'Medical', 'Legal', 'Western', 'War', 'Supernatural'];
function forYouPage() {
  const likes = S.likes, auto = tasteOf(), want = [...new Set([...likes, ...auto])];
  const saved = new Set(S.list.map(s => s.id));
  catSvcs().slice(0, 3).forEach(n => { loadCat(n, 'movie'); loadCat(n, 'tv'); });
  const gen = x => (x.show ? x.show.genres : x.genres) || [];
  const cands = mergeByTitle([...(S.pool || []).map(poolItem), ...todayShows().map(x => ({ ...x, img: x.big || x.img })), ...Object.values(S.cat).flatMap(c => c.items || [])].filter(x => !(x.show && saved.has(x.show.id)))).filter(x => kidOk(x) && yours(x));
  const score = x => gen(x).reduce((n, g) => n + (likes.includes(g) ? 3 : auto.includes(g) ? 1 : 0), 0) * 40 + (yours(x) ? 60 : 0) + (x.w || 0) / 5;
  const ranked = cands.filter(x => x.img).map(x => ({ x, s: score(x) })).sort((a, b) => b.s - a.s).map(r => r.x);
  const top = ranked.slice(0, 8), used = new Set(top.map(x => x.key));
  const rows = want.slice(0, 3).map(g => { const r = ranked.filter(x => !used.has(x.key) && gen(x).includes(g) && yours(x)).slice(0, 6); r.forEach(x => used.add(x.key)); return [g, r]; }).filter(r => r[1].length);
  const fp = x => x.prem ? hposter(x) : lposter(x);
  return `<img class="top50ban" src="banner_foryou.jpg" alt="For You - Made for You: your taste, your services, your next favorite show"><section class="fyhero" style="margin-top:0"><p class="lsub2" style="margin-top:0">Tell Marvel Magic what you like. Picks come from your services first.</p>
      <div class="fyg">${GENRES.filter(g => !kidsOn() || ['Family', 'Children', 'Anime', 'Nature', 'Food', 'Music', 'Comedy', 'Adventure'].includes(g)).map(g => `<button class="chip ${likes.includes(g) ? 'on' : ''}" data-like="${esc(g)}">${likes.includes(g) ? '✓ ' : ''}${esc(g)}</button>`).join('')}</div>
      ${auto.length ? `<p class="fine" style="margin:10px 0 0">From the shows you saved: ${auto.map(esc).join(', ')}</p>` : ''}</section>
    ${!S.pool && !S.airings.length ? '<p class="fine">Loading shows…</p>' : ''}
    ${top.length ? `<div class="hh" style="margin-top:18px"><h2>Top Picks for You</h2></div><div class="lgrid four">${top.slice(0, 4).map(x => x.prem ? hposter(x) : lposter(x, true)).join('')}</div><div class="lgrid" style="margin-top:16px">${top.slice(4).map(fp).join('')}</div>` : ''}
    ${rows.map(([g, r]) => `<div class="hh" style="margin-top:22px"><h2>Because You Like ${esc(g)}</h2></div><div class="lgrid">${r.map(fp).join('')}</div>`).join('')}
    ${!want.length ? '<p class="fine">Pick a few things you like above to get started.</p>' : ''}`;
}
// KIDS LOCK: a 4-digit PIN on this device. While on, only kids' channels and family / children's shows show, and Sports + settings are hidden.
// TVmaze has no content ratings (TV-Y, TV-14...), so this goes by channel and genre. True ratings need the paid listings feed later.
const KIDS_NETS = new Set(['Nickelodeon', 'Nick Jr.', 'Nicktoons', 'Disney Channel', 'Disney Junior', 'Disney XD', 'Cartoon Network', 'Boomerang', 'PBS Kids', 'Universal Kids', 'Discovery Family', 'Cartoonito', 'Baby First', 'Noggin']);
const KID_G = ['Children'];   // not 'Family': TVmaze tags The Simpsons and Funniest Home Videos as Family (found in the 11/14 test)
const kidsOn = () => !!(S.kids && S.kids.on);
function kidOk(x) {
  if (!kidsOn()) return true;
  if (x.kid) return true;   // fetched with TMDB's kids filter (rated G/PG or Kids TV)
  const g = (x.show && x.show.genres) || x.genres || [], n = x.net || x.chan || (x.show && x.show.net) || '';
  return KIDS_NETS.has(n) || g.some(v => KID_G.includes(v));
}
function pinBox(title, then) {
  const b = $('back'); if (b.open) b.close();
  b.innerHTML = `<b>${esc(title)}</b><input id="pin" inputmode="numeric" maxlength="4" autocomplete="off" aria-label="4-digit PIN" placeholder="4-digit PIN" style="width:100%;height:52px;margin-top:12px;padding:0 12px;border-radius:9px;border:1px solid var(--line);background:var(--off);font-size:24px;letter-spacing:10px;text-align:center"><p class="fine" id="pinmsg"></p><div class="act"><button class="btn alt" data-pinx>Cancel</button><button class="btn" data-pinok>OK</button></div>`;
  const go = () => { const v = b.querySelector('#pin').value.trim(); if (!/^\d{4}$/.test(v)) { b.querySelector('#pinmsg').textContent = 'Use 4 numbers.'; return; } if (then(v) !== false) b.close(); else b.querySelector('#pinmsg').textContent = 'That PIN is not right.'; };
  b.querySelector('[data-pinx]').onclick = () => b.close(); b.querySelector('[data-pinok]').onclick = go;
  b.querySelector('#pin').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  b.showModal(); b.querySelector('#pin').focus();
}
// CAST TO TV (Scott 11/14): puts the Marvel Magic screen on the TV. Netflix etc. cast their own videos from their own apps.
// Scott 11/17: "cast button to work on all formats other than tvs like tablets". iPads say "Macintosh" (told to use desktop Chrome),
// Android tablets were sent to a Chrome menu that has no Cast item, Samsung (Smart View) and Fire tablets had no steps.
// A web page cannot start screen casting itself, so each device gets its own real steps + the TV-browser fallback.
function castDevice(ua = navigator.userAgent, touch = navigator.maxTouchPoints || 0) {
  const mac = /Macintosh/.test(ua);
  if (/iPad/.test(ua) || (mac && touch > 0)) return 'ipad';
  if (/iPhone|iPod/.test(ua)) return 'iphone';
  if (/Silk|; KF[A-Z]{2,}/.test(ua)) return 'fire';
  if (/Android/.test(ua)) return (/SamsungBrowser|SAMSUNG|SM-[A-Z0-9]/.test(ua) ? 'samsung' : 'android') + (/Mobile/.test(ua) ? '' : '-tab');
  if (/Edg\//.test(ua)) return 'edge';
  if (/Chrome\//.test(ua)) return 'chrome';
  return mac ? 'mac' : 'other';
}
function castHelp() {
  const b = $('back'); if (b.open) b.close();
  const d = castDevice(), kind = d.replace('-tab', '');
  const what = d === 'ipad' || d.endsWith('-tab') || d === 'fire' ? 'tablet' : d === 'iphone' || /^(samsung|android)$/.test(d) ? 'phone' : 'computer';
  const AIR = ['Open Control Center (swipe down from the top-right corner).', 'Tap Screen Mirroring (the two-rectangles button).', 'Pick your Apple TV or AirPlay TV (most new Samsung, LG, Sony and Roku TVs have AirPlay).'];
  const STEPS = {
    ipad: AIR, iphone: AIR,
    samsung: ['Swipe down twice from the top of the screen to open Quick Settings.', 'Tap Smart View (swipe left if you don’t see it).', 'Pick your TV and tap Start now. Marvel Magic shows on the TV.'],
    android: ['Swipe down twice from the top of the screen to open Quick Settings.', 'Tap Cast or Screen cast (or open the Google Home app → your TV → Cast my screen).', 'Pick your TV and tap Start now. Marvel Magic shows on the TV.'],
    fire: ['On the Fire TV: Settings → Display & Audio → Enable Display Mirroring.', 'On this tablet: Settings → Display → Display Mirroring, then pick the Fire TV.', 'No Display Mirroring on your tablet? Use the TV’s own browser (below).'],
    chrome: ['Click the Chrome menu ⋮ at the top-right of the window.', 'Click Cast, save, and share → Cast…', 'Pick your TV. Under Sources choose Cast tab.'],
    edge: ['Click the Edge menu … at the top-right of the window.', 'Click More tools → Cast media to device.', 'Pick your TV.'],
    mac: ['Click Control Center (top-right of the menu bar).', 'Click Screen Mirroring.', 'Pick your Apple TV or AirPlay TV.'],
    other: ['Open Marvel Magic in Google Chrome (casting is built into Chrome).', 'Click the Chrome menu ⋮ → Cast, save, and share → Cast…', 'Pick your TV.'],
  };
  const works = { ipad: 'Apple TV and AirPlay TVs', iphone: 'Apple TV and AirPlay TVs', mac: 'Apple TV and AirPlay TVs', samsung: 'Samsung TVs, Chromecast and most smart TVs', fire: 'Fire TV', edge: 'Chromecast and TVs with Chromecast built in' }[kind] || 'Chromecast, Google TV and TVs with Chromecast built in';
  const site = (location.origin + location.pathname).replace(/index\.html$/, '').replace(/^https?:\/\//, '');
  b.innerHTML = `<b>📺 Put Marvel Magic on your TV</b><ol class="castol">${STEPS[kind].map(x => `<li>${esc(x)}</li>`).join('')}</ol><p class="fine">Works with ${works}. You keep driving from this ${what}. When you open Netflix, Hulu or another service, use the Cast button inside that service to send its video.</p><p class="fine"><b>No cast on your TV?</b> Open the TV's web browser (Fire TV Silk, Samsung Internet, LG Web Browser) and go to <b>${esc(site)}</b>. It runs full screen with the remote, and Settings → My Household → Add a TV links it to this ${what}.</p><div class="act"><button class="btn" data-castok>Got it</button></div>`;
  b.querySelector('[data-castok]').onclick = () => b.close(); b.showModal();
}
function kidsPress() {
  if (kidsOn()) { pinBox('Enter the PIN to turn Kids Lock off', v => { if (v !== S.kids.pin) return false; S.kids = { ...S.kids, on: false }; save('kids', S.kids); draw(); }); return; }
  if (!S.kids.pin) { pinBox('Pick a 4-digit PIN for Kids Lock', v => { S.kids = { on: true, pin: v }; save('kids', S.kids); if (S.tab === 2) showTab(HOME); else draw(); }); return; }
  S.kids = { ...S.kids, on: true }; save('kids', S.kids); if (S.tab === 2) showTab(HOME); else draw();
}
const kidsSection = () => `<section class="glow plain"><h3>👪 Kids Lock</h3><p class="fine">Locks Marvel Magic to kids' channels and family shows, hides Sports and settings. A PIN turns it off. Goes by channel and genre (the free listings have no TV ratings).</p><button class="btn ${kidsOn() ? '' : 'alt'}" data-kids style="width:100%">${kidsOn() ? '🔒 Kids Lock is ON - enter PIN to turn off' : S.kids.pin ? 'Turn Kids Lock on' : 'Set a PIN and turn Kids Lock on'}</button>${S.kids.pin && !kidsOn() ? '<button class="btn alt" data-kidsreset style="width:100%;margin-top:8px">Change PIN</button>' : ''}</section>`;
// NEW EPISODE ALERTS (Scott 11/14 "keep track and notify new episode"): a phone/PC notification the day a tracked show's next episode is out, while Marvel Magic is open.
function episodeAlerts() {
  if (!('Notification' in window)) return;
  const first = !load('toldInit', false), told = S.told; let ch = false;
  for (const s of S.list) { const t = track(s); if (!t || !t.fresh || !t.next) continue; const k = s.id + '-' + epLabel(t.next); if (told[k]) continue; told[k] = Date.now(); ch = true;
    if (!first && Notification.permission === 'granted') { try { new Notification('New episode: ' + s.name, { body: epLabel(t.next) + (t.next.name ? ' · ' + t.next.name : '') + ' is out now', icon: 'icon-192.png' }); } catch {} } }
  if (first) save('toldInit', true);
  if (ch) save('told', told);
}
const credit = () => `<p class="fine">TV listings from <a href="https://www.tvmaze.com/" target="_blank" rel="noopener">TVmaze</a> (CC BY-SA). Test build. Service links may need adjusting.</p>`;

async function loadGuide() {
  try {
    const dates = [0, 1].map(n => { const d = new Date(Date.now() + n * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    const urls = dates.flatMap(d => [`https://api.tvmaze.com/schedule?country=US&date=${d}`, `https://api.tvmaze.com/schedule/web?country=US&date=${d}`]);
    const lists = await Promise.all(urls.map(tvmGet));   // the US schedule is shared with loadPool; a failed load still shows "Couldn't load listings"
    const seen = new Set(), out = [];
    for (const e of lists.flat()) {
      const show = e.show || (e._embedded && e._embedded.show); if (!show || !e.airstamp || seen.has(e.id)) continue; seen.add(e.id);
      const net = (show.network && show.network.name) || (show.webChannel && show.webChannel.name); if (!net) continue;
      const start = Date.parse(e.airstamp), mins = e.runtime || show.runtime || show.averageRuntime || 30;
      out.push({ key: 'e' + e.id, title: show.name, net, start, end: start + mins * 60000, svc: NETWORK_SERVICE[net] || null, url: show.officialSite || show.url, series: true, show, ep: e.season && e.number ? `S${e.season} E${e.number}` : '', epName: e.name || '', note: `${net} · ${clock(new Date(start))}${e.season && e.number ? ` · S${e.season} E${e.number}` : ''}` });
    }
    S.airings = out; S.err = '';
  } catch { S.err = "Couldn't load listings. Check your connection."; }
  if (S.tab < 2 || S.tab === HOME) { const y = window.scrollY; draw(); window.scrollTo(0, y); }
}
async function loadGames() {
  const lists = await Promise.all(LEAGUES.map(([name, path]) => fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard`).then(r => r.ok ? r.json() : { events: [] }).then(j => (j.events || []).map(e => [name, e])).catch(() => [])));
  S.games = lists.flat().map(([league, e]) => {
    const c = e.competitions[0], st = e.status.type, home = c.competitors.find(t => t.homeAway === 'home'), away = c.competitors.find(t => t.homeAway === 'away');
    const tv = [...new Set([...(c.broadcasts || []).flatMap(b => b.names || []), ...(c.geoBroadcasts || []).map(g => g.media && g.media.shortName)].filter(Boolean))], net = tv.find(t => NETWORK_SERVICE[t]) || tv[0] || '';
    const started = st.state !== 'pre';
    return { key: 'g' + e.id, title: `${away.team.shortDisplayName} at ${home.team.shortDisplayName}`, away: away.team.shortDisplayName, home: home.team.shortDisplayName, awayColor: away.team.color, homeColor: home.team.color, awayLogo: away.team.logo || null, homeLogo: home.team.logo || null, state: st.state, detail: st.shortDetail, when: Date.parse(e.date), score: started ? `${away.score} - ${home.score}` : '', teams: [home.team.id, away.team.id], path: LEAGUES.find(l => l[0] === league)[1], options: optsFor(tv), svc: (optsFor(tv).find(o => hasIt(o.svc)) || {}).svc || null, url: (e.links && e.links[0] && e.links[0].href) || 'https://www.espn.com/', note: [league, net].filter(Boolean).join(' · '), series: false, sport: true, tv, league };
  });
  S.gamesDone = true; if (S.tab === 2 || S.tab === HOME || S.tab === 0) { const y = window.scrollY; draw(); window.scrollTo(0, y); }
}
// OPEN + COME BACK (Scott 11/14): every watch link opens through here. The selection clears at once, and when the window we opened closes,
// Marvel Magic brings itself back to the front (the come-back question still asks if it didn't play).
let watchWin = null, watchTimer = null;
const inTvApp = () => typeof window.MMNative !== 'undefined';
// READY ON THIS DEVICE (Scott 11/21: "make sure all channels open to proper app or ask to download and log in" + "when you change tv with
// same account it needs to check for that"). The first time a service is opened on THIS device, Marvel Magic checks it is ready here.
// Kept per device (mm_devReady is never synced to the account), so a new TV or phone on the same account checks again.
//  - TV app (Fire TV / Samsung): the app is on the TV -> it opens (the app shows its own sign-in if needed); not on the TV -> "Get <svc>"
//    (its store page), then sign in, then Watch again.
//  - phone / tablet: Open it, Get the app (its store), or Sign in first.  - computer: Open it or Sign in first (the website is the app).
const devReady = () => load('devReady', {});
const markReady = svc => { const r = devReady(); r[svc] = Date.now(); save('devReady', r); };
function devKind() {
  if (inTvApp()) return 'tv'; const u = navigator.userAgent;
  if (/iPhone|iPod/.test(u)) return 'iphone'; if (/iPad/.test(u) || (/Macintosh/.test(u) && navigator.maxTouchPoints > 1)) return 'ipad';
  if (/Android/.test(u) && !/AFT|BRAVIA|SMART-TV/i.test(u)) return 'android'; if (/Tizen|SMART-TV|Web0S|AFT|CrKey|BRAVIA/i.test(u)) return 'tvweb'; return 'computer';
}
const appName = svc => svc.replace(/^Sling (Orange|Blue)$/, 'Sling TV').replace('Hulu + Live TV', 'Hulu');
const storeLink = (svc, k) => { const q = encodeURIComponent(appName(svc)); return k === 'android' ? 'https://play.google.com/store/search?q=' + q + '&c=apps' : (k === 'iphone' || k === 'ipad') ? 'https://apps.apple.com/us/search?term=' + q : null; };
const signLink = svc => { const s = SIGN_IN.find(([n]) => n.replace('- ', '') === svc || (svc.startsWith('Sling') && n.replace('- ', '') === 'Sling TV')); return s ? s[1] : (ACCOUNT_URL[svc] || null); };
function needsReady(svc) {
  if (!svc || devReady()[svc] || !(SERVICE_URL[svc] || svc === 'YouTube')) return false;
  const k = devKind(); if (FREE_SVC.has(svc) && k !== 'tv' && k !== 'tvweb') return false;   // free services need no sign-in; on a TV they still need the app
  return true;
}
function readyCheck(url, svc, pre) {
  const b = $('back'), k = devKind(), go = () => { markReady(svc); b.close(); openWin(url, svc, pre, true); };
  if (k === 'tv') {
    let on = true; try { on = MMNative.has(svc) !== false; } catch {}
    if (on) { markReady(svc); openWin(url, svc, pre, true); return; }
    if (b.open) return;
    b.innerHTML = `<b>${esc(svc)} isn’t on this TV yet</b><p>Get the ${esc(appName(svc))} app, open it once and sign in with your ${esc(appName(svc))} account. Then come back and press Watch again.</p><div class="act"><button class="btn alt" data-rcno>Not now</button><button class="btn" data-rcget>⬇ Get ${esc(appName(svc))}</button></div>`;
    b.querySelector('[data-rcno]').onclick = () => { save('pending', null); b.close(); };
    b.querySelector('[data-rcget]').onclick = () => { save('pending', null); b.close(); try { MMNative.open(url, svc); } catch {} };   // not installed -> the TV opens its store page
    b.showModal(); b.querySelector('[data-rcget]').focus(); return;
  }
  if (b.open) { if (pre) try { pre.close(); } catch {} return; }
  if (pre) try { pre.close(); } catch {}   // a new tab is opened by the button below (a click), so it is never blocked
  const st = storeLink(svc, k), si = signLink(svc), where = k === 'computer' ? 'this computer' : k === 'tvweb' ? 'this TV' : k === 'ipad' ? 'this iPad' : 'this phone';
  b.innerHTML = `<b>First time opening ${esc(svc)} on ${where}</b><p>${k === 'computer' ? `${esc(svc)} opens in a new tab. Sign in there once and it remembers you.` : `You need the ${esc(appName(svc))} app on ${where}, signed in to your ${esc(appName(svc))} account.`}</p>
    <div class="act"><button class="btn" data-rcgo>▶ Open ${esc(svc)}</button></div>
    ${st ? `<a class="btn alt" data-rcst style="display:flex;align-items:center;justify-content:center;text-decoration:none;margin-top:8px" href="${esc(st)}" target="_blank" rel="noopener">⬇ Get the ${esc(appName(svc))} app</a>` : ''}
    ${si ? `<a class="btn alt" data-rcsi style="display:flex;align-items:center;justify-content:center;text-decoration:none;margin-top:8px" href="${esc(si)}" target="_blank" rel="noopener">🔑 Sign in to ${esc(appName(svc))} first</a>` : ''}
    <button class="btn alt" data-rcno style="width:100%;margin-top:8px">Not now</button>`;
  b.querySelector('[data-rcgo]').onclick = go;
  b.querySelector('[data-rcno]').onclick = () => { save('pending', null); b.close(); };   // nothing opened: no "did it play?" on return
  b.querySelectorAll('[data-rcst], [data-rcsi]').forEach(a => a.onclick = e => { e.stopPropagation(); save('pending', null); b.close(); });   // store / sign-in open as plain links; the next Watch asks again
  b.showModal(); b.querySelector('[data-rcgo]').focus();
}
function openWin(url, svc, pre, ready) {   // pre = a tab already opened during the click (openIt), filled in here; ready = checked on this device
  if (svc && S.mine.length && !ownSvc(svc) && SERVICE_URL[svc]) { if (pre) try { pre.close(); } catch {} notOnYours(svc); return; }   // never open a service that isn't ticked
  if (!ready && needsReady(svc)) { readyCheck(url, svc, pre); return; }
  if (inTvApp()) { try { MMNative.open(url, svc || ''); } catch {} if (S.sel) { S.sel = null; const y = window.scrollY; draw(); window.scrollTo(0, y); } return; }   // Fire TV: the real app
  let w = null;
  if (pre && !pre.closed) { try { pre.location.href = url; w = pre; } catch {} }
  if (!w) w = window.open(url, '_blank');
  if (!w) return;
  try { w.opener = null; } catch {}
  watchWin = w; clearInterval(watchTimer);
  watchTimer = setInterval(() => { if (!watchWin || watchWin.closed) { clearInterval(watchTimer); watchWin = null; try { window.focus(); } catch {} cameBack(); } }, 1000);
  if (S.sel) { S.sel = null; const y = window.scrollY; draw(); window.scrollTo(0, y); }
}
// WATCH GOES TO THE TITLE (Scott 11/15 "when you click to watch something and it opens streamer app it dont go to what you clicked"):
// a movie / show without its exact page yet waits for the lookup (enrich: the title's own page on each service, up to 10 seconds)
// before opening, instead of opening the service's front page. Live listings and games keep their channel / app way in.
// The browser tab is opened during the click (a tab opened after a wait gets blocked) and filled in when the page is known.
function openIt(x) {
  if (x && x.title && !x.exact && !x.sport && !x.start && !x.net && !x.chan) {
    const pre = inTvApp() || needsReady(bestSvc(x) || x.svc) ? null : window.open('about:blank', '_blank');   // first time here: the check opens it from its own button
    const note = document.createElement('div'); note.className = 'updtoast'; note.textContent = 'Finding “' + x.title + '”…'; document.body.appendChild(note);
    // the lookup is two relay calls, about 3-4 seconds; after 10 the service's own page opens as before
    Promise.race([enrich(x), new Promise(r => setTimeout(r, 10000))]).then(() => { note.remove(); openNow(x, pre); });
    return;
  }
  openNow(x, null);
}
function openNow(x, pre) {
  { const v = bestSvc(x); if (S.mine.length && !v && !x.exact) { if (pre) try { pre.close(); } catch {} notOnYours(x.svc); return; }
    if (v && v !== x.svc) { const o = (x.options || []).find(o => o.svc === v && o.url && /^https?:\/\/[^/]+\/./.test(o.url)); x = { ...x, svc: v, exact: o ? o.url : null }; } }   // switching to your service keeps its title page when the lookup found one
  if (x && x.fromList) scoreList(x.fromList, x);
  armFull();
  countOpen(x.svc);
  logPick(x);
  const u = linkFor(x);
  save('pending', { title: x.title, series: x.series, sport: !!x.sport, rk: rateKey(x), img: x.img || null, url: linkFor(x), at: Date.now(), id: x.show && S.list.some(s => s.id === x.show.id) ? x.show.id : null, svc: x.svc || null, options: (x.options || []).slice(0, 8) });
  openWin(u, x.svc || '', pre);
}
function askSetup() {
  const p = load('pendingSetup', null), b = $('back'); if (!p || Date.now() - p.at < 5000 || b.open) return false;
  save('pendingSetup', null);
  if (p.name === 'Sling TV') {
    b.innerHTML = `<b>Sling TV</b><p>Did you get signed in? Pick your Sling plan so the guide shows the right channels.</p><div class="act" style="flex-wrap:wrap"><button class="btn" data-sp="Sling Orange">Orange</button><button class="btn" data-sp="Sling Blue">Blue</button><button class="btn" data-sp="both">Orange &amp; Blue</button></div><button class="btn alt" data-no style="width:100%;margin-top:8px">Not signed in yet</button>`;
    b.querySelectorAll('[data-sp]').forEach(x => x.onclick = () => { const plans = x.dataset.sp === 'both' ? ['Sling Orange', 'Sling Blue'] : [x.dataset.sp]; S.setup = [...new Set([...S.setup, 'Sling TV'])]; save('setup', S.setup); S.mine = [...new Set([...S.mine.filter(n => !n.startsWith('Sling ')), ...plans])]; save('mine', S.mine); b.close(); draw(); });
    b.querySelector('[data-no]').onclick = () => { S.setup = S.setup.filter(x => x !== 'Sling TV'); save('setup', S.setup); b.close(); draw(); };
    b.showModal(); return true;
  }
  b.innerHTML = `<b>${esc(p.name)}</b><p>Did you get signed in?</p><div class="act"><button class="btn alt" data-no>Not yet</button><button class="btn" data-yes>Yes, signed in</button></div>`;
  const set = on => { S.setup = on ? [...new Set([...S.setup, p.name])] : S.setup.filter(x => x !== p.name); save('setup', S.setup); if (on && !S.mine.includes(p.name)) { S.mine = [...S.mine, p.name]; save('mine', S.mine); } b.close(); draw(); };
  b.querySelector('[data-no]').onclick = () => set(false); b.querySelector('[data-yes]').onclick = () => set(true);
  b.showModal(); return true;
}
// REVIEWS (Scott 11/08: "they ask for reviews"): asked when someone comes back, always skippable, private to their account.
function askReview(p) {
  const b = $('back'); if (b.open || !p.rk) return;
  const had = S.ratings[p.rk] || {}; let pick = had.score || 0;
  b.innerHTML = `<b>How was ${esc(p.title)}?</b><div class="hearts">${[1, 2, 3, 4, 5].map(n => `<button data-r="${n}" class="${n <= pick ? 'on' : ''}" aria-label="${n} of 5 hearts">${n <= pick ? '♥' : '♡'}</button>`).join('')}</div><input id="rvw" maxlength="280" aria-label="Short review" placeholder="Short review (optional)" value="${esc(had.review || '')}" style="width:100%;height:44px;margin-top:10px;padding:0 10px;border-radius:8px;border:1px solid var(--line);background:var(--off)"><div class="act"><button class="btn alt" data-skip>Skip</button><button class="btn" data-keep>Save</button></div>`;
  b.querySelectorAll('[data-r]').forEach(x => x.onclick = () => { pick = Number(x.dataset.r); b.querySelectorAll('[data-r]').forEach(y => { const on = Number(y.dataset.r) <= pick; y.classList.toggle('on', on); y.textContent = on ? '♥' : '♡'; }); });
  b.querySelector('[data-skip]').onclick = () => b.close();
  b.querySelector('[data-keep]').onclick = () => { if (!pick) { b.querySelector('[data-r]').focus(); return; } S.ratings[p.rk] = { title: p.title, img: p.img || had.img || null, kind: p.series ? 'Show' : 'Movie', score: pick, review: b.querySelector('#rvw').value.trim().slice(0, 280), at: Date.now() }; save('ratings', S.ratings); b.close(); draw(); };
  b.showModal();
}
// KICK BACK (Scott 11/14): coming back within 3 minutes of opening a service almost always means it didn't play (payment pending, signed out,
// not available, an error). Marvel Magic offers the other places to watch it, the service's sign-in, and its account / payment page.
const ACCOUNT_URL = { Netflix: 'https://www.netflix.com/YourAccount', Hulu: 'https://secure.hulu.com/account', 'Disney+': 'https://www.disneyplus.com/account', 'Prime Video': 'https://www.amazon.com/gp/video/settings',
  'HBO Max': 'https://www.hbomax.com/account', Peacock: 'https://www.peacocktv.com/account', 'Paramount+': 'https://www.paramountplus.com/account/', 'Apple TV': 'https://tv.apple.com/settings',
  'YouTube TV': 'https://tv.youtube.com/settings', 'Sling Orange': 'https://www.sling.com/my-account', 'Sling Blue': 'https://www.sling.com/my-account', 'Hulu + Live TV': 'https://secure.hulu.com/account', Fubo: 'https://www.fubo.tv/account' };
// UNUSED SERVICE REMINDER (Scott 11/14): a paid service not opened from Marvel Magic for 30 days gets a reminder, again at 60, 90 ...
// unless the person turns reminders off in Settings. Days count from the last open, or from when the service was ticked if never opened.
const DAY = 86400000;
function unusedSvcs() {
  if (S.svcRemindOff || kidsOn()) return [];
  const now = Date.now();
  return S.mine.filter(n => !FREE_SVC.has(n)).map(n => {
    if (!S.svcSince[n]) { S.svcSince[n] = now; save('svcSince', S.svcSince); }
    const days = Math.floor((now - (S.lastOpen[n] || S.svcSince[n])) / DAY), step = Math.floor(days / 30);
    return { n, days, step };
  }).filter(u => u.step >= 1 && u.step > (S.svcSnooze[u.n] || 0)).sort((a, b) => b.days - a.days);
}
// FREE PREVIEWS (Scott 11/14): free_previews.json lists them; Home announces the ones running now that this household can get
let PREVIEWS = null;
function loadPreviews() { if (PREVIEWS) return; PREVIEWS = []; fetch('free_previews.json?v=' + Math.floor(Date.now() / 3600000)).then(r => r.json()).then(j => { PREVIEWS = j.previews || []; previewNotify(); if (S.tab === HOME) { const y = window.scrollY; draw(); window.scrollTo(0, y); } }).catch(() => {}); }
const dayOf = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
const previewsNow = () => (PREVIEWS || []).filter(v => { const now = Date.now(); return now >= dayOf(v.start) && now < dayOf(v.end) + 86400000 && (!v.for || S.mine.includes(v.for)); });
function previewCards() {
  loadPreviews(); const l = previewsNow(); if (!l.length) return '';
  return `<div class="unused">${l.map(v => { const last = new Date(dayOf(v.end)).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    return `<div class="uncard prevcard"><span class="unico">🎉</span><span class="t"><b>${esc(v.title)}</b><small>${esc(v.note || '')} Free through ${esc(last)}.</small>${(() => { const t0 = new Date(); t0.setHours(0, 0, 0, 0); const n = Math.round((dayOf(v.end) - t0.getTime()) / 86400000); return n <= 3 ? `<small class="prevend">⏳ Free preview ending ${n <= 0 ? 'today' : n === 1 ? 'tomorrow' : 'in ' + n + ' days'}</small>` : ''; })()}</span>${v.url ? `<a class="btn gold" href="${esc(v.url)}" target="_blank" rel="noopener" data-rtry="${esc(v.svc || '')}">▶ Watch free</a>` : ''}<button class="btn alt" data-laterx="${reg({ key: 'pv' + v.id, title: v.title.replace(/^Free( preview)?:\s*/, ''), svc: v.svc || null, exact: v.url || null, url: v.url || null, free: true, series: false })}">${isLater({ key: 'pv' + v.id, title: v.title.replace(/^Free( preview)?:\s*/, '') }) ? '✓ Saved' : '⏰ Watch Later'}</button></div>`; }).join('')}</div>`;
}
// LEAVING SOON (Scott 11/19, Streaming Availability free plan): leaving_soon.json is written by the Action (tools/build_leaving_soon.py), never by the
// browser, and lists titles leaving a service within 30 days. Home shows the ones on THIS household's services (soonest first); My Stuff shows more.
// Hidden when empty (no key yet / nothing leaving). Kids Lock keeps only titles tagged Children. Watch = openIt with the service's own title link.
let LEAVING = null;
function loadLeaving() { if (LEAVING) return; LEAVING = []; fetch('leaving_soon.json?v=' + Math.floor(Date.now() / 3600000)).then(r => r.json()).then(j => { LEAVING = (j && j.items) || []; if (S.tab === HOME || S.tab === 3) { const y = window.scrollY; draw(); window.scrollTo(0, y); } }).catch(() => {}); }
function leavingRows() {
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  return (LEAVING || []).filter(v => v && v.title && v.img && v.svc && v.leave && ownSvc(v.svc) && (!S.mine.length || S.mine.includes(v.svc) || FREE_SVC.has(v.svc)) && kidOk({ genres: v.genres || [] }))
    .map(v => ({ v, days: Math.round((dayOf(v.leave) - t0.getTime()) / 86400000) })).filter(r => r.days >= 0 && r.days <= 31).sort((a, b) => a.days - b.days || a.v.title.localeCompare(b.v.title));
}
function leavingSoon(limit, head, more) {
  loadLeaving(); const rows = leavingRows(); if (!rows.length) return '';
  const card = r => { const v = r.v, when = r.days === 0 ? 'Last day today' : r.days === 1 ? 'Leaves tomorrow' : 'Leaves in ' + r.days + ' days';
    const x = { key: 'ls' + v.id + v.svc, title: v.title, svc: v.svc, exact: v.link || null, url: v.link || null, series: v.type === 'show', year: v.year || null, genres: v.genres || [] };
    return `<div class="cu"><div class="cuart"><img src="${esc(v.img)}"${tvmSet(v.img)} alt="" loading="lazy"><span class="sv">${esc(v.svc)}</span><span class="cub ${r.days <= 3 ? 'lshot' : 'lssoon'}">${when}</span></div>
      <div class="cut"><b>${esc(v.title)}</b><small>${v.type === 'show' ? 'Series' : 'Movie'}${v.year ? ' · ' + esc(v.year) : ''} · until ${esc(new Date(dayOf(v.leave)).toLocaleDateString([], { month: 'short', day: 'numeric' }))}</small></div>
      <div class="cubtn"><button class="btn watch" data-cuw="${reg(x)}">▶ Watch</button></div></div>`; };
  return `<section class="cusec"><div class="hh" style="margin-top:22px"><h2>${head || '⏳ Leaving Soon'} <small class="fine">${rows.length} title${rows.length === 1 ? '' : 's'} on your services</small></h2>${more ? '<button class="more" data-tab="3">See all ›</button>' : ''}</div><div class="cugrid">${rows.slice(0, limit).map(card).join('')}</div>
    <p class="fine" style="margin:8px 2px 0;opacity:.75">Dates from Streaming Availability; services can change them.</p></section>`;
}
function previewNotify() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const told = load('prevTold', {}); let ch = false;
  for (const v of previewsNow()) { if (told[v.id]) continue; told[v.id] = Date.now(); ch = true; try { new Notification('Free preview on now', { body: v.title, icon: 'icon-192.png' }); } catch {} }
  if (ch) save('prevTold', told);
}
function unusedCards() {
  const u = unusedSvcs().slice(0, 2); if (!u.length) return '';
  return `<div class="unused">${u.map(x => `<div class="uncard"><span class="unico">💤</span><span class="t"><b>You haven't used ${esc(x.n)} in ${x.days} days</b><small>${PRICE[x.n] ? 'That’s about $' + PRICE[x.n].toFixed(2) + ' a month. ' : ''}Still want it?</small></span><button class="btn alt" data-unkeep="${esc(x.n)}">Keep it</button>${ACCOUNT_URL[x.n] ? `<a class="btn" href="${esc(ACCOUNT_URL[x.n])}" target="_blank" rel="noopener" data-unman="${esc(x.n)}">Manage / pause</a>` : ''}</div>`).join('')}</div>`;
}
function unusedNotify() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const told = load('svcTold', {}); let ch = false;
  for (const x of unusedSvcs()) { const k = x.n + ':' + x.step; if (told[k]) continue; told[k] = Date.now(); ch = true; try { new Notification('Marvel Magic', { body: `You haven't used ${x.n} in ${x.days} days. Still want it?`, icon: 'icon-192.png' }); } catch {} }
  if (ch) save('svcTold', told);
}
function askRescue(p) {
  const b = $('back'); if (b.open) return;
  const svc = p.svc || '', sign = SIGN_IN.find(([n]) => n.replace('- ', '') === svc || (svc.startsWith('Sling') && n === 'Sling TV'));
  const others = (p.options || []).filter(o => o.svc !== svc && o.url).sort((a, c) => Number(hasIt(c.svc)) - Number(hasIt(a.svc))).slice(0, 4);
  b.innerHTML = `<b>Did ${esc(p.title)} play${svc ? ' on ' + esc(svc) : ''}?</b>
    <div class="act"><button class="btn" data-rok>Yes, it's playing</button><button class="btn alt" data-rno>No, it didn't</button></div>
    <div id="rfix" hidden><p class="fine" style="margin:12px 0 6px">${svc ? esc(svc) + ' may need a sign-in or a payment update. ' : ''}Try one of these:</p>
      ${others.map(o => `<a class="btn" style="display:flex;align-items:center;justify-content:center;text-decoration:none;margin-top:6px" href="${esc(o.url)}" target="_blank" rel="noopener" data-rtry="${esc(o.svc)}">▶ Watch on ${esc(o.svc)}${hasIt(o.svc) ? ' ✓' : ''}</a>`).join('')}
      ${sign ? `<a class="btn alt" style="display:flex;align-items:center;justify-content:center;text-decoration:none;margin-top:6px" href="${esc(sign[1])}" target="_blank" rel="noopener">🔑 Sign in to ${esc(svc)}</a>` : ''}
      ${ACCOUNT_URL[svc] ? `<a class="btn alt" style="display:flex;align-items:center;justify-content:center;text-decoration:none;margin-top:6px" href="${esc(ACCOUNT_URL[svc])}" target="_blank" rel="noopener">💳 ${esc(svc)} account &amp; payment</a>` : ''}
      <button class="btn alt" data-rpick style="width:100%;margin-top:6px">✨ Pick something else for me</button></div>`;
  b.dataset.kind = 'rescue';
  b.querySelector('[data-rok]').onclick = () => { b.close(); save('pending', { ...p, at: Date.now() - 200000 }); };   // later return = normal flow
  b.querySelector('[data-rno]').onclick = () => { b.querySelector('#rfix').hidden = false; b.querySelector('.act').hidden = true; const f = b.querySelector('#rfix a, #rfix button'); if (f) f.focus(); };
  b.querySelector('[data-rpick]').onclick = () => { b.close(); showTab(1); const ps = tonightPicks().filter(kidOk); if (ps.length) { S.sel = ps[0]; draw(); enrich(S.sel); } };
  b.querySelectorAll('[data-rtry]').forEach(a => a.onclick = () => { b.close(); countOpen(a.dataset.rtry); save('pending', { ...p, svc: a.dataset.rtry, url: a.href, at: Date.now() }); armFull(); });
  b.showModal();
}
function cameBack() {
  if (askSetup()) return;   // Scott 11/08: a series offers the next one or "done"; anything else just lands back here
  const p = load('pending', null), b = $('back'); if (!p || Date.now() - p.at < 4000 || b.open) return;
  if (Date.now() - p.at < 180000 && !p.sport) { askRescue(p); return; }   // back within 3 minutes: it probably didn't play
  save('pending', null); if (!p.series) { if (!p.sport) askReview(p); return; }
  const finish = () => { if (p.id) { step(p.id, 1); if (S.tab === 3 || S.tab === 6 || S.tab === HOME) draw(); } else logWatch({ k: 't' + p.title + '-' + dayKey(Date.now()), title: p.title, kind: 'Show', svc: '', img: null }); };
  b.innerHTML = `<b>${esc(p.title)}</b><p>Welcome back. Watch the next episode?</p><div class="act"><button class="btn alt" data-done>I'm done</button><button class="btn" data-next>Next episode</button></div><button class="btn alt" data-not style="width:100%;margin-top:8px">Didn't finish it</button>`;
  b.querySelector('[data-done]').onclick = () => { finish(); b.close(); askReview(p); };
  b.querySelector('[data-not]').onclick = () => b.close();
  b.querySelector('[data-next]').onclick = () => { finish(); b.close(); armFull(); window.open(p.url, '_blank', 'noopener'); save('pending', { ...p, at: Date.now() }); };
  b.showModal();
}
document.addEventListener('click', e => {
  const link = e.target.closest('a[target=_blank]');
  if (link && link.hasAttribute('data-opt') && S.sel) save('pending', { title: S.sel.title, series: S.sel.series, sport: !!S.sel.sport, rk: rateKey(S.sel), img: S.sel.img || null, url: link.href, at: Date.now(), id: S.sel.show && S.list.some(s => s.id === S.sel.show.id) ? S.sel.show.id : null, svc: link.textContent.replace(' ✓', '').trim(), options: (S.sel.options || []).slice(0, 8) });
  if (link && link.hasAttribute('data-opt')) { countOpen(link.textContent.replace(' ✓', '')); logPick(S.sel); }
  if (link && link.dataset.free) countOpen(link.dataset.free);
  if (link && link.dataset.unman) { S.svcSnooze[link.dataset.unman] = (unusedSvcs().find(x => x.n === link.dataset.unman) || { step: 1 }).step; save('svcSnooze', S.svcSnooze); setTimeout(draw, 300); }
  if (link) { armFull(); if (link.dataset.setup) save('pendingSetup', { name: link.dataset.setup, at: Date.now() }); if (!link.dataset.setup && !/(whop\.com|themoviedb|tvmaze|myaccount)/.test(link.href)) { e.preventDefault(); openWin(link.href, link.dataset.rtry || link.dataset.free || (link.hasAttribute('data-opt') ? link.textContent.replace(' ✓', '').trim() : '')); } return; }
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.tab != null) { const n = Number(t.dataset.tab); if (n !== S.tab) history.pushState({ tab: n }, ''); showTab(n); if (t.hasAttribute('data-q') && $('q')) $('q').focus(); }
  else if (t.dataset.f) { S.filter = t.dataset.f; const y = window.scrollY; draw(); window.scrollTo(0, y); }
  else if (t.dataset.cuh) { const [id, se, no] = t.dataset.cuh.split('|'), sh = S.hShows[id], ep = (S.hEps[id] || []).find(e => String(e.season) === se && String(e.number) === no); if (sh && ep) logWatch({ k: 's' + id + '-' + se + '-' + no, title: sh.name, kind: 'Show', ep: 'S' + se + ' E' + no + (ep.name ? ' · ' + ep.name : ''), svc: NETWORK_SERVICE[sh.net] || sh.net || '', img: sh.img || null }); const y = window.scrollY; draw(); window.scrollTo(0, y); }
  else if (t.dataset.cuw != null) openIt(items[Number(t.dataset.cuw)]);
  else if (t.dataset.w) { step(Number(t.dataset.w), Number(t.dataset.d)); const y = window.scrollY; draw(); window.scrollTo(0, y); }
  else if (t.dataset.i != null && t.hasAttribute('data-go')) { const x = items[Number(t.dataset.i)]; if (!x.svc || hasIt(x.svc)) openIt(x); else { S.sel = x; const y = window.scrollY; draw(); window.scrollTo(0, y); } }
  else if (t.dataset.gs) { for (const id of ['ggrid', 'fgrid']) { const g = $(id); if (g) g.scrollBy({ left: Number(t.dataset.gs) * 568, behavior: 'smooth' }); } }
  else if (t.dataset.addlist != null) { toggleList(items[Number(t.dataset.addlist)].show); const y = window.scrollY; draw(); window.scrollTo(0, y); }
  else if (t.dataset.i != null) { const x = items[Number(t.dataset.i)]; if (S.sel && S.sel.key === x.key) { if (!S.sel.svc || hasIt(S.sel.svc)) openIt(S.sel); return; } S.sel = x; const y = window.scrollY; draw(); window.scrollTo(0, y); enrich(x); }
  else if (t.dataset.rate) { const x = S.sel, k = rateKey(x), n = Number(t.dataset.rate); setRating(x, S.ratings[k] && S.ratings[k].score === n ? 0 : n); const y = window.scrollY; draw(); window.scrollTo(0, y); }
  else if (t.dataset.unrate) { delete S.ratings[t.dataset.unrate]; save('ratings', S.ratings); shareRefresh(); draw(); }
  else if (t.dataset.mv) { const [n, d] = t.dataset.mv.split('|'), a = rankedSvcs(), i = a.indexOf(n), j = i + Number(d); if (j >= 0 && j < a.length) { [a[i], a[j]] = [a[j], a[i]]; S.rank = a; save('rank', S.rank); const y = window.scrollY; draw(); window.scrollTo(0, y); } }
  else if (t.dataset.team != null) { S.teams = [...S.teams, S.teamHits[Number(t.dataset.team)]]; S.teamHits = null; S.tq = ''; save('teams', S.teams); draw(); loadTeamGames(); }
  else if (t.dataset.rmteam) { const [p, id] = t.dataset.rmteam.split('|'); S.teams = S.teams.filter(x => !(x.path === p && x.id === id)); save('teams', S.teams); draw(); loadTeamGames(); }
  else if (t.dataset.only != null) { S.onlyTeams = t.dataset.only === '1'; const y = window.scrollY; draw(); window.scrollTo(0, y); }
  else if (t.hasAttribute('data-later')) { toggleLater(S.sel); dock(); if (S.tab === HOME || S.tab === 3) { const y = window.scrollY; draw(); window.scrollTo(0, y); } }
  else if (t.dataset.laterx != null) { toggleLater(items[Number(t.dataset.laterx)]); const y = window.scrollY; draw(); window.scrollTo(0, y); }
  else if (t.dataset.unlater) { S.later = S.later.filter(l => l.k !== t.dataset.unlater); save('later', S.later); const y = window.scrollY; draw(); window.scrollTo(0, y); }
  else if (t.dataset.unkeep) { const u = unusedSvcs().find(x => x.n === t.dataset.unkeep); S.svcSnooze[t.dataset.unkeep] = u ? u.step : 1; save('svcSnooze', S.svcSnooze); draw(); }
  else if (t.hasAttribute('data-mkhouse')) { S.house = { members: [] }; S.houseRole = 'owner'; saveHouse({}).then(() => draw()).catch(() => { S.house = null; S.houseRole = null; S.houseErr = true; draw(); }); }
  else if (t.dataset.rmmember) { saveHouse({ members: (S.house.members || []).filter(m => m.id !== t.dataset.rmmember) }).then(() => draw()).catch(() => {}); draw(); }
  else if (false && t.dataset.whokid) { S.kidName = t.dataset.whokid; if (S.kids.pin) { S.kids = { ...S.kids, on: true }; save('kids', S.kids); draw(); } else kidsPress(); }
  else if (t.dataset.whoprof) { const id = t.dataset.whoprof; withPin('Enter the PIN to switch profiles', () => switchProfile(id)); }
  else if (t.hasAttribute('data-whome')) { const back = () => { if (kidsOn()) { S.kids = { ...S.kids, on: false }; save('kids', S.kids); } switchProfile(null); }; if (S.profLock || kidsOn()) pinBox('Enter the PIN to switch profiles', v => { if (v !== S.kids.pin) return false; S.profLock = false; save('profLock', false); back(); }); else back(); }
  else if (t.hasAttribute('data-proflock')) { if (S.profLock) pinBox('Enter the PIN to unlock this TV', v => { if (v !== S.kids.pin) return false; S.profLock = false; save('profLock', false); draw(); }); else if (!S.kids.pin) pinBox('Pick a 4-digit household PIN first', v => { S.kids = { ...S.kids, pin: v }; save('kids', S.kids); S.profLock = true; save('profLock', true); draw(); }); else { S.profLock = true; save('profLock', true); draw(); } }
  else if (t.dataset.mmeasy) { const ms = (S.house.members || []).map(m => m.id === t.dataset.mmeasy ? { ...m, easy: !m.easy } : m); saveHouse({ members: ms }).then(() => draw()).catch(() => {}); draw(); }
  else if (t.dataset.svcrate) { svcRateBox(t.dataset.svcrate); }
  else if (t.dataset.thumb != null) { rateBox(items[Number(t.dataset.thumb)]); }
  else if (t.hasAttribute('data-paircode')) { startPair(); }
  else if (t.dataset.tvsignin) { openWin(ACTIVATE[t.dataset.tvsignin] || '', t.dataset.tvsignin); }
  else if (t.dataset.rmdevice) { const dv = { ...(S.house.devices || {}) }; delete dv[t.dataset.rmdevice]; S.house.devices = dv; saveHouse({ devices: dv }).then(() => draw()).catch(() => {}); draw(); }
  else if (t.dataset.rkind) { S.rkind = t.dataset.rkind; draw(); }
  else if (t.dataset.rtab) { S.rtab = t.dataset.rtab; draw(); }
  else if (t.dataset.tmv) { const [k, d] = t.dataset.tmv.split('|'); moveTop(k, Number(d)); const y = window.scrollY; draw(); window.scrollTo(0, y); }
  else if (t.hasAttribute('data-sharelist')) { publishList().then(() => { S.shared = true; save('shared', true); S.lists = null; draw(); }).catch(() => { const b = $('back'); b.innerHTML = '<b>Couldn\'t share yet</b><p class="fine">Shared lists switch on once the database allows them.</p><div class="act"><button class="btn" data-castok>OK</button></div>'; b.querySelector('[data-castok]').onclick = () => b.close(); b.showModal(); }); }
  else if (t.hasAttribute('data-unshare')) { if (me && db) db.collection('toplists').doc(me.uid).delete().catch(() => {}); S.shared = false; save('shared', false); S.lists = null; draw(); }
  else if (t.hasAttribute('data-copylist')) { const u = listLink(me.uid); (navigator.share ? navigator.share({ title: 'My Marvel Magic Top 50', url: u }) : navigator.clipboard.writeText(u)).catch(() => {}); t.textContent = '✓ Copied'; }
  else if (t.dataset.openlist) { openList(t.dataset.openlist); draw(); }
  else if (t.hasAttribute('data-closelist')) { S.viewList = null; if (location.hash.startsWith('#list=')) history.replaceState(history.state, '', location.pathname); draw(); }
  else if (t.dataset.rmactor) { S.actors = S.actors.filter(a => a !== t.dataset.rmactor); save('actors', S.actors); const y = window.scrollY; draw(); window.scrollTo(0, y); }
  else if (t.hasAttribute('data-pfsave')) { S.profile = { ...S.profile, name: ($('pfname').value || '').trim().slice(0, 40) }; save('profile', S.profile); draw(); }
  else if (t.hasAttribute('data-acct2')) acctPress();
  else if (t.hasAttribute('data-tvupd')) { try { MMNative.checkUpdate(); } catch (e) { /* older TV app: the box explains */ } }
  else if (t.hasAttribute('data-mmunlock')) { if (window.mmMembership) mmMembership.open('Unlock Marvel Magic'); }
  else if (t.dataset.frsvc) { S.freeSvc = t.dataset.frsvc; save('freeSvc', S.freeSvc); const y = window.scrollY; draw(); window.scrollTo(0, y); }
  else if (t.dataset.frcat) { S.freeCat = t.dataset.frcat; const y = window.scrollY; draw(); window.scrollTo(0, y); }
  else if (t.dataset.plcat) { S.plutoCat = t.dataset.plcat; const y = window.scrollY; draw(); window.scrollTo(0, y); }
  else if (t.hasAttribute('data-plgo')) { const g = document.querySelector('.plgrid'); if (g) g.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  else if (t.dataset.cats) { S.catSvc = t.dataset.cats; const y = window.scrollY; draw(); window.scrollTo(0, y); }
  else if (t.dataset.catk) { S.catKind = t.dataset.catk; const y = window.scrollY; draw(); window.scrollTo(0, y); }
  else if (t.hasAttribute('data-refpool')) { S.pool = null; draw(); loadPool(true); }
  else if (t.dataset.like) { const g = t.dataset.like; S.likes = S.likes.includes(g) ? S.likes.filter(x => x !== g) : [...S.likes, g]; save('likes', S.likes); const y = window.scrollY; draw(); window.scrollTo(0, y); }
  else if (t.hasAttribute('data-kids')) kidsPress();
  else if (t.hasAttribute('data-kidsreset')) pinBox('Pick a new 4-digit PIN', v => { S.kids = { ...S.kids, pin: v }; save('kids', S.kids); draw(); });
  else if (t.hasAttribute('data-alerts')) { if ('Notification' in window) Notification.requestPermission().then(() => draw()); }
  else if (t.hasAttribute('data-pick')) { const ps = tonightPicks().filter(kidOk); if (ps.length) { S.pickI = ((S.pickI == null ? -1 : S.pickI) + 1) % Math.min(ps.length, 8); S.sel = ps[S.pickI]; draw(); enrich(S.sel); } }
  else if (t.hasAttribute('data-clearq')) { S.q = ''; S.results = null; S.movies = null; draw(); }
  else if (t.dataset.sport) { S.sport = t.dataset.sport; const y = window.scrollY; draw(); window.scrollTo(0, y); }
  else if (t.dataset.sf) { S.sf = t.dataset.sf; const y = window.scrollY; draw(); window.scrollTo(0, y); }
  else if (t.dataset.remind) { const k = t.dataset.remind; if (S.remind[k]) delete S.remind[k]; else { S.remind[k] = { title: t.dataset.rt, when: Number(t.dataset.rw) }; if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } save('remind', S.remind); const y = window.scrollY; draw(); window.scrollTo(0, y); }
  else if (t.dataset.wf) { S.wf = t.dataset.wf; draw(); }
  else if (t.dataset.unwatch) { S.history = S.history.filter(h => h.k !== t.dataset.unwatch); save('history', S.history); const y = window.scrollY; draw(); window.scrollTo(0, y); }
  else if (t.id === 'acct') acctPress();
  else if (t.id === 'castbtn') { if (typeof castPress === 'function') castPress(); else castHelp(); }   // cast.js: one-tap Google Cast in Chrome, else the steps
  else if (t.dataset.offer) openOffer(t.dataset.offer);
  else if (t.dataset.chg) { S.chg = t.dataset.chg; S.chlim = 60; const y = window.scrollY; draw(); window.scrollTo(0, y); }   // Channel Directory
  else if (t.dataset.chopen != null) chOpen(Number(t.dataset.chopen));
  else if (t.hasAttribute('data-chmore')) { S.chlim = (S.chlim || 60) + 60; const y = window.scrollY; draw(); window.scrollTo(0, y); }   // Settings → Get more services
  else if (t.hasAttribute('data-open')) openIt(S.sel);
  else if (t.hasAttribute('data-save')) { toggleList(S.sel.show); dock(); }
});
document.addEventListener('input', e => { if (!e.target.hasAttribute || !e.target.hasAttribute('data-chq')) return; S.chq = e.target.value; S.chlim = 60; clearTimeout(window.__chqT);
  window.__chqT = setTimeout(() => { const pos = e.target.selectionStart, y = window.scrollY; draw(); window.scrollTo(0, y); const el = document.querySelector('[data-chq]'); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch {} } }, 250); });   // Channel Directory search
document.addEventListener('change', e => { if (e.target.hasAttribute('data-offersw')) { save('offersOff', !e.target.checked); draw(); return; } if (e.target.dataset.svc && S.houseRole === 'owner') setTimeout(() => saveHouse({}).catch(() => {}), 50); if (e.target.hasAttribute('data-svcremind')) { S.svcRemindOff = !e.target.checked; save('svcRemindOff', S.svcRemindOff); return; } const k = e.target.dataset.st; if (k === 'likes' || k === 'moods') { const v = e.target.value; S[k] = e.target.checked ? [...new Set([...S[k], v])] : S[k].filter(x => x !== v); save(k, S[k]); return; } const s = e.target.dataset.svc; if (!s) return; S.mine = e.target.checked ? [...S.mine, s] : S.mine.filter(x => x !== s); save('mine', S.mine); });
document.addEventListener('submit', async e => {
  if (e.target.id === 'pairform') { e.preventDefault(); const code = ($('pcode').value || '').replace(/\D/g, ''), pid = $('pprof').value; if (code.length !== 6) { alert('Type the 6 numbers shown on the TV.'); return; }
    approvePair(code, pid).then(() => { alert('Done! That TV is set up for ' + (pid === 'owner' ? 'you' : (houseMember(pid) || {}).name || 'them') + '. It will change by itself in a moment.'); draw(); }).catch(err => alert(err.message || 'Could not add that TV. Try again.')); return; }
  if (e.target.id === 'addmember') { e.preventDefault(); const name = ($('mmname').value || '').trim().slice(0, 30), email = ($('mmemail').value || '').trim().toLowerCase().slice(0, 80), type = $('mmtype').value; const h = S.house || {};
    if (!name || (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) { alert('Add a name. An email is optional - leave it blank for someone who only watches on this TV.'); return; }
    if (email && ((h.members || []).some(m => m.email === email) || email === h.ownerEmail)) { alert('That email is already in the household.'); return; }
    if ((h.members || []).length + 1 >= HOUSE_MAX) return;
    saveHouse({ members: [...(h.members || []), { id: 'm' + Date.now().toString(36), name, email: type === 'Kid' ? '' : email, type, easy: !!($('mmeasy') && $('mmeasy').checked) }] }).then(() => draw()).catch(() => {}); draw(); return; }
  if (e.target.id === 'actorfind') { e.preventDefault(); const a = ($('aq').value || '').trim().replace(/\s+/g, ' ').slice(0, 60); if (a && !S.actors.some(x => x.toLowerCase() === a.toLowerCase())) { S.actors = [...S.actors, a]; save('actors', S.actors); } const y = window.scrollY; draw(); window.scrollTo(0, y); return; }
  if (e.target.id === 'teamfind') { e.preventDefault(); S.tq = $('tq').value.trim(); const w = S.tq.toLowerCase(); if (!w) { S.teamHits = null; return draw(); } const all = await loadAllTeams(); S.teamHits = all.filter(t => t.name.toLowerCase().includes(w)).slice(0, 12); return draw(); }
  if (e.target.id !== 'find') return; e.preventDefault(); S.q = $('q').value.trim(); if (!S.q) { S.results = null; return draw(); }
  const q = S.q;
  const [shows, movies] = await Promise.all([
    fetch('https://api.tvmaze.com/search/shows?q=' + encodeURIComponent(q)).then(r => r.json()).then(j => j.map(r => showItem(r.show))).catch(() => []),
    relay({ a: 'find', q }).then(j => (j.results || []).filter(r => r.type === 'movie').map(r => ({ key: 'm' + r.id, wmId: r.id, title: r.name, note: 'Movie' + (r.year ? ' · ' + r.year : ''), img: r.img, series: false, url: 'https://www.google.com/search?q=' + encodeURIComponent(r.name + ' watch') }))).catch(() => [])]);
  S.results = shows; S.movies = movies;
  draw();
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) cameBack(); });
window.addEventListener('focus', cameBack);
// REMOTE (Scott 11/08: "design everything around remote left right up down forward and back buttons, mouse click on pc and touch on phone")
