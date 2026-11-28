// js/guide.js
// Save to: C:\MarvelApps\marvelmagic\js\guide.js
// Marvel Magic - Live TV Guide, On Your Services, Settings, free channel guide, Pluto, Watch Later, one card per title, Movies & Shows (Lounge).
// Split out of index.html 2026-11-15 (sell-readiness pass). Plain script, shared global scope, loaded in order:
// core -> guide -> sports -> home -> app. After editing, run  python tools\stamp_versions.py  then  python tests\smoke_test.py

const strip = h => String(h || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
const BG = {};
// 11/21: TVmaze backgrounds come ONLY as originals (often 3840x2160, 1-2 MB) and the preview panel shows them as a CSS
// background (no <img>, so no srcset) - the ~6 big phone downloads with initiator "other". Same free wsrv.nl resizer as the
// posters, sized to the screen; it is test-loaded first, and if wsrv fails (or takes 6 s) the original is used as before.
function bgSmall(u) {
  if (!/^https:\/\/static\.tvmaze\.com\//.test(u || '')) return Promise.resolve(u || '');
  const w = (innerWidth || 1280) < 700 ? 900 : 1600;
  const s = `https://wsrv.nl/?url=${encodeURIComponent(u.slice(8))}&w=${w}&output=webp&q=78`;
  return new Promise(ok => { const im = new Image(); const t = setTimeout(() => ok(u), 6000); im.onload = () => { clearTimeout(t); ok(s); }; im.onerror = () => { clearTimeout(t); ok(u); }; im.src = s; });
}
function bgFor(show) {
  if (!show) return '';
  if (BG[show.id] !== undefined) return BG[show.id] || '';
  BG[show.id] = null;   // stays null (no art yet) until the small copy is ready, so a re-render never grabs the original
  const fall = (show.image && show.image.original) || '';
  fetch(`https://api.tvmaze.com/shows/${show.id}/images`).then(r => r.ok ? r.json() : []).then(j => {
    const b = j.find(i => i.type === 'background' && i.main) || j.find(i => i.type === 'background');
    return (b && b.resolutions && b.resolutions.original && b.resolutions.original.url) || fall;
  }).catch(() => fall).then(bgSmall).then(u => { BG[show.id] = u || ''; const el = document.querySelector(`.gpv-art[data-id="${show.id}"]`); if (el && BG[show.id]) el.style.setProperty('--img', `url("${BG[show.id]}")`); });
  return '';
}
const mineGame = g => g.teams && S.teams.some(t => t.path === g.path && g.teams.includes(t.id));
function ticker() {
  const live = S.games.filter(g => g.state === 'in'), g = live.find(mineGame) || live[0];
  const nx = S.games.filter(x => x.state === 'pre').sort((a, b) => (mineGame(b) - mineGame(a)) || a.when - b.when)[0];
  if (!g && !nx) return '';
  return `<button class="tick" data-tab="2"><span class="tkb">MAGIC SPORTS</span>${g ? `<span class="glive">● LIVE</span><b class="spvs">${tlogo(g.awayLogo)}${esc(g.away)} vs ${tlogo(g.homeLogo)}${esc(g.home)}</b><b class="tks">${esc(g.score)}</b><span>${esc(g.detail)}</span>` : ''}${nx ? `<span class="tkn">Next: ${esc(nx.title)} · ${esc(clock(new Date(nx.when)))}</span>` : ''}</button>`;
}
function preview(pv, now) {
  if (!pv) return '';
  const sh = pv.show || {}, live = pv.start <= now && pv.end > now, bg = bgFor(pv.show), saved = pv.show && S.list.some(x => x.id === sh.id);
  const sum = strip(sh.summary), short = sum.length > 230 ? sum.slice(0, 227).replace(/\s+\S*$/, '') + '…' : sum;
  const tags = [...(sh.genres || []).slice(0, 3), sh.rating && sh.rating.average ? '★ ' + sh.rating.average : ''].filter(Boolean);
  return `<section class="gpv"><div class="gpv-art" data-id="${esc(sh.id || '')}" style="${bg ? `--img:url('${esc(bg)}')` : ''}"></div><div class="gpv-in">
    <div class="gpvk"><span class="chb">${esc(pv.net)}</span><span>${live ? 'Now Live' : 'Coming Up'} · ${esc(clock(new Date(pv.start)))} – ${esc(clock(new Date(pv.end)))}</span></div>
    <h1 class="gpvt">${esc(pv.title)}</h1>${pv.ep || pv.epName ? `<div class="gpve">${esc([pv.ep, pv.epName].filter(Boolean).join('  '))}</div>` : ''}
    ${short ? `<p class="gpvd">${esc(short)}</p>` : ''}${tags.length ? `<div class="gtags">${tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
    <div class="gpvb">${thumbBtn(pv)}<button class="pill" data-laterx="${reg(pv)}">${isLater(pv) ? '✓ Watch Later' : '⏰ Watch Later'}</button><button class="btn watch" data-i="${reg(pv)}" data-go>▶ ${live ? 'Watch Live' : 'Open'} ↗</button>${pv.show ? `<button class="pill" data-addlist="${reg(pv)}">${saved ? '✓ On My List' : '＋ My List'}</button>` : ''}</div>${whereRow(pv)}</div></section>`;
}
function guide() {
  if (S.err && !S.airings.length) return `<h1>Live TV Guide</h1><p>${esc(S.err)}</p>`;
  if (!S.airings.length) return `<h1>Live TV Guide</h1><p class="fine">Loading tonight's listings…</p>`;
  const now = Date.now(), t0 = Math.floor(now / SLOT) * SLOT, span = SLOT * SLOTS, t1 = t0 + span, by = {};
  for (const a of S.airings) if (a.end > t0 && a.start < t1) (by[a.net] = by[a.net] || []).push(a);
  loadFreeGuide();   // CABLE listings (Scott 11/14 "load up with more channels"): HGTV, Food, TLC, Discovery, ID... fill the gaps TVmaze leaves
  for (const [n, l] of Object.entries((FREE_G && FREE_G.cab) || {})) for (const q of l) {
    const st = q[0] * 1000, en = q[1] * 1000; if (en <= t0 || st >= t1) continue;
    const have = by[n] || []; if (have.some(a => a.start < en && a.end > st)) continue;
    (by[n] = have).push({ key: 'c' + n + q[0], title: q[2], net: n, start: st, end: en, svc: NETWORK_SERVICE[n] || null, series: true, ep: q[4] || '', epName: q[3] || '', img: q[5] ? q[5].replace(/^http:/, 'https:') : null, note: `${n} · ${clock(new Date(st))}${q[3] ? ' · ' + q[3] : ''}` });
  }
  for (const g of gameAirings(t0, t1)) { const L = by[g.net] = (by[g.net] || []).filter(a => a.isGame || a.end <= g.start || a.start >= g.end); L.push(g); }
  for (const pk of Object.keys(LIVE_PKG)) if (S.mine.includes(pk) && Array.isArray(LIVE_PKG[pk])) for (const n of LIVE_PKG[pk]) if (!['ESPN3', 'Local Now', 'USA Network', 'ACCN', 'MSNBC'].includes(n)) by[n] = by[n] || [];
  // Only channels this account can reach (Scott 11/08). YouTube TV is a live bundle, so it opens every network; nothing set up yet = ask them to set up.
  if (!S.mine.length) return `<h1>Live TV Guide</h1><p>Your guide shows only the channels you can watch. Set up your streaming accounts to fill it in.</p><button class="btn" data-tab="3">Set up my accounts</button>`;
  const canSee = n => !!livePkgFor(n) || (n === 'ESPN+' && S.mine.includes('ESPN')) || (!['ABC', 'FX'].includes(n) && S.mine.includes(NETWORK_SERVICE[n]));   // plain Hulu has these on demand, not live
  const nets = Object.keys(by).filter(n => canSee(n) && (!kidsOn() || KIDS_NETS.has(n))).sort((a, b) => a.localeCompare(b));
  const freeSet = FREE_TV.filter(([n]) => S.setup.includes(n) && n !== 'Pluto TV');
  const freeRows = freeSet.map(([n, u]) => `<div class="row"><div class="ch"><b class="chn">${esc(n)}</b><small>Free</small></div><div class="track"><a class="cell freecell" data-free="${esc(n)}" href="${esc(u)}" target="_blank" rel="noopener" style="left:0;width:100%">Open ${esc(n)} live guide</a></div></div>`).join('');
  const freeCards = freeSet.map(([n, u]) => `<a class="card freecard" data-free="${esc(n)}" href="${esc(u)}" target="_blank" rel="noopener"><span class="t"><small>Free</small><b>${esc(n)}</b><small>Open its live guide</small></span></a>`).join('');
  if (!nets.length && !freeSet.length) return `<h1>Live TV Guide</h1><p class="fine">None of your services have channel listings in the next 8 hours.</p>`;
  const onNow = nets.flatMap(n => by[n].filter(a => a.start <= now && a.end > now));
  const pv = (S.sel && S.sel.net) ? S.sel : onNow.sort((a, b) => ((b.show && b.show.weight) || 0) - ((a.show && a.show.weight) || 0))[0] || null;
  const nowPct = (now - t0) / span * 100;
  const times = Array.from({ length: SLOTS }, (_, i) => `<div>${esc(clock(new Date(t0 + i * SLOT)))}</div>`).join('');
  // 11/27 GUIDE IN PAGES (Scott: "load a page and while looking and moving down it load next page only that way it smaller batches and way
  // faster"): the guide draws GPAGE channel rows; a marker below the last one loads the next GPAGE as you get near it (gMore, core.js).
  const gLim = S.gLim || GPAGE, gHas = nets.length > gLim;
  const rows = nets.slice(0, gLim).map(n => {
    const ways = waysFor(n), mineW = ways.filter(w => S.mine.includes(w.svc)), svc = (mineW[0] || ways[0] || {}).svc || null, ok = !svc || hasIt(svc);
    for (const a of by[n]) if (!a.isGame) { a.svc = svc; a.options = ways; a.exact = null; }   // Watch = your first way in (live package before the network's app)
    const cells = by[n].sort((a, b) => a.start - b.start).map(a => {
      const l = Math.max(0, (a.start - t0) / span * 100), r = Math.min(100, (a.end - t0) / span * 100), on = pv && pv.key === a.key, live = a.start <= now && a.end > now;
      return `<button class="cell ${on ? 'on' : ok ? '' : 'off'}${a.isGame ? ' isg' : ''}${live ? ' live' : ''}" data-i="${reg(a)}" style="left:${l}%;width:${r - l}%;--el:${live ? Math.round((now - a.start) / (a.end - a.start) * 100) : 0}%" title="${esc(a.title)}"><span class="ci"><b>${a.isGame ? '🏟 ' : ''}${esc(a.title)}</b><small>${a.isGame ? esc((a.state === 'in' ? 'LIVE ' + a.score + ' · ' + a.detail : a.state === 'post' ? 'Final ' + a.score : clock(new Date(a.start))) + ' · ' + a.league) : esc(clock(new Date(a.start))) + ' – ' + esc(clock(new Date(a.end)))}</small></span>${on && live ? '<span class="lv">● LIVE</span>' : ''}</button>`;
    }).join('');
    // Scott 11/14 "keep guide uniform easy to see": every hole in a row gets a plain box, so all rows read the same way
    let gaps = '', cur = t0;
    const gapBox = (a, b) => { if (b - a < 10 * 60000) return; const x = { key: 'gap' + n + a, title: n + ' live', net: n, svc, options: ways, start: a, end: b, series: false, url: svc && SERVICE_URL[svc] ? SERVICE_URL[svc]('') : '' }; const l = (a - t0) / span * 100, r = (b - t0) / span * 100; gaps += `<button class="cell gap ${pv && pv.key === x.key ? 'on' : ''}" data-i="${reg(x)}" style="left:${l}%;width:${r - l}%"><span class="ci"><b>${esc(gapWord(n))}</b><small>${svc ? 'Watch live on ' + esc(svc) : 'Live channel'}</small></span></button>`; };
    for (const a of by[n].slice().sort((x, y) => x.start - y.start)) { if (a.start > cur) gapBox(cur, Math.min(a.start, t1)); cur = Math.max(cur, a.end); }
    if (cur < t1) gapBox(cur, t1);
    return `<div class="row"><div class="ch ${pv && pv.net === n ? 'on' : ''}"><b class="chn">${esc(n)}</b><small class="${ok ? '' : 'no'}">${esc(svc || 'Network')}</small></div><div class="track">${cells}${gaps}<div class="nowline" style="left:${nowPct}%"></div></div></div>`;
  }).join('');
  // FREE CHANNELS with real schedules (free_guide.json), one category at a time, on the same timeline; one row per channel, every service that has it
  loadFreeGuide();
  const fsvcs = FREE_GSVC.filter(v => (FREE_G.ch || []).some(r => r.p.some(q => q[0] === v)));
  const fsvc = fsvcs.includes(S.freeSvc) ? S.freeSvc : 'All';   // one service's own guide, or every free channel (Scott 11/14)
  const fall = (FREE_G.ch || []).filter(r => fsvc === 'All' || r.p.some(q => q[0] === fsvc)).map(r => fsvc === 'All' ? r : { ...r, p: [...r.p.filter(q => q[0] === fsvc), ...r.p.filter(q => q[0] !== fsvc)] });
  const fcats = FREE_ORDER.filter(c => fall.some(r => r.g === c) && (!kidsOn() || c === 'Kids'));
  const fcat = fcats.includes(S.freeCat) ? S.freeCat : (kidsOn() ? 'Kids' : 'Movies');
  const fchAll = fall.filter(r => r.g === fcat).slice(0, 150), fLim = S.fLim || GPAGE, fch = fchAll.slice(0, fLim), fHas = fchAll.length > fLim;
  const fRows = fch.map(r => {
    const places = r.p.map(q => ({ svc: q[0], url: q[1] })), first = places[0];
    const cells = r.s.filter(q => q[1] * 1000 > t0 && q[0] * 1000 < t1).map(q => {
      const a = q[0] * 1000, b = q[1] * 1000, x = { key: 'f' + r.n + q[0], title: q[2] || r.n, net: r.n, start: a, end: b, svc: first.svc, exact: first.url, options: places, series: false, ep: q[3] || '' };
      const l = Math.max(0, (a - t0) / span * 100), w = Math.min(100, (b - t0) / span * 100) - l, on = pv && pv.key === x.key, live = a <= now && b > now;
      return `<button class="cell ${on ? 'on' : ''}${live ? ' live' : ''}" data-i="${reg(x)}" style="left:${l}%;width:${w}%;--el:${live ? Math.round((now - a) / (b - a) * 100) : 0}%" title="${esc(x.title)}"><span class="ci"><b>${esc(x.title)}</b><small>${esc(clock(new Date(a)))} – ${esc(clock(new Date(b)))}${q[3] ? ' · ' + esc(q[3]) : ''}</small></span>${on && live ? '<span class="lv">● LIVE</span>' : ''}</button>`;
    }).join('');
    return `<div class="row"><div class="ch">${r.l ? `<img class="chlogo" src="${esc(r.l)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<span class="cht"><b class="chn">${esc(r.n)}</b><small>Free · ${esc(r.p[0][0])}${r.p.length > 1 ? ' +' + (r.p.length - 1) : ''}</small></span></div><div class="track">${cells}<div class="nowline" style="left:${nowPct}%"></div></div></div>`;
  }).join('');
  const fCards = fch.map(r => { const cur = r.s.find(q => q[1] * 1000 > now) || r.s[0]; if (!cur) return ''; const x = { key: 'f' + r.n + cur[0], title: cur[2] || r.n, net: r.n, start: cur[0] * 1000, end: cur[1] * 1000, svc: r.p[0][0], exact: r.p[0][1], options: r.p.map(q => ({ svc: q[0], url: q[1] })), series: false }; return `<button class="card" data-i="${reg(x)}"><span class="t"><small>${esc(r.n)} · Free</small><b>${esc(x.title)}</b><small>${cur[0] * 1000 <= now ? 'On now' : esc(clock(new Date(cur[0] * 1000)))}</small></span></button>`; }).join('');
  const fBar = fcats.length ? `<div class="gbar gfree"><span class="gday">📺 Free channels · ${fall.length.toLocaleString()} with schedules</span>${fsvcs.length > 1 ? `<div class="filters fsvcs">${['All', ...fsvcs].map(v => `<button class="chip ${v === fsvc ? 'on' : ''}" data-frsvc="${esc(v)}">${esc(v === 'All' ? 'All free' : v)}</button>`).join('')}</div>` : ''}<div class="filters">${fcats.map(c => `<button class="chip ${c === fcat ? 'on' : ''}" data-frcat="${esc(c)}">${esc(c)} <small>${fall.filter(r => r.g === c).length}</small></button>`).join('')}</div></div>` : (FREE_G.ch ? '' : '<p class="fine">Loading free channels…</p>');
  // ON-DEMAND ROWS: a streaming service has no timetable, so its row shows what's on it (top movies + shows), each watch-anytime
  const odSvcs = catSvcs().filter(n => n !== 'Pluto TV' && n !== 'Samsung TV Plus');
  const od = odSvcs.map(n => { loadCat(n, 'movie'); loadCat(n, 'tv'); const k = kidsOn() ? 1 : 0, m = (S.cat[n + '|movie|' + k] || {}).items || [], t = (S.cat[n + '|tv|' + k] || {}).items || []; const mix = []; for (let i = 0; i < 6; i++) { if (m[i]) mix.push(m[i]); if (t[i]) mix.push(t[i]); } return [n, mix.slice(0, 8), S.cat[n + '|movie|' + k]]; });
  const odRows = od.map(([n, mix, st]) => `<div class="row"><div class="ch"><b class="chn">${esc(n)}</b><small>${FREE_SVC.has(n) ? 'Free · ' : ''}On demand · anytime</small></div><div class="track">${mix.length ? mix.map((x, i) => `<button class="cell od ${S.sel && S.sel.key === x.key ? 'on' : ''}" data-i="${reg(x)}" style="left:${i * 12.5}%;width:12.5%" title="${esc(x.title)}"><span class="ci"><b>${esc(x.title)}</b><small>${esc((x.series ? 'Series' : 'Movie') + (x.note.match(/^\d{4}/) ? ' · ' + x.note.slice(0, 4) : ''))}</small></span></button>`).join('') : `<span class="cell gap" style="left:0;width:100%"><span class="ci"><b>${st && st.error ? 'Catalog not available' : 'Loading…'}</b><small>${esc(n)}</small></span></span>`}</div></div>`).join('');
  const odCards = od.map(([n, mix]) => mix.slice(0, 4).map(x => `<button class="card" data-i="${reg(x)}"><span class="t"><small>${esc(n)} · anytime</small><b>${esc(x.title)}</b><small>${x.series ? 'Series' : 'Movie'}</small></span></button>`).join('')).join('');
  const odBar = odRows ? '<div class="gbar gfree"><span class="gday">🎬 On your streaming services · watch anytime</span><span class="fine">What\'s popular on each service you ticked right now. Tap one to open it there.</span></div>' : '';
  const list = nets.map(n => {
    if (!by[n].length) { const pk = livePkgFor(n), x = { key: 'gap' + n, title: n + ' live', net: n, svc: pk, start: now, end: now + SLOT, series: false }; return `<button class="card" data-i="${reg(x)}"><span class="t"><small>${esc(n)}${pk ? ' · ' + esc(pk) : ''}</small><b>${esc(gapWord(n))}</b><small>Watch live</small></span></button>`; }
    const sorted = by[n].sort((a, b) => a.start - b.start), cur = sorted.find(a => a.end > now) || sorted[0], next = sorted[sorted.indexOf(cur) + 1], ok = !cur.svc || hasIt(cur.svc);
    return `<button class="card ${S.sel && S.sel.key === cur.key ? 'on' : ok ? '' : 'off'}" data-i="${reg(cur)}"><span class="t"><small>${esc(n)}${cur.svc ? ' · ' + esc(cur.svc) : ''}</small><b>${esc(cur.title)}</b><small>${cur.start <= now ? 'On now' : esc(clock(new Date(cur.start)))}${next ? ' · Next: ' + esc(next.title) : ''}</small></span></button>`;
  }).join('');
  const today = new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return `${preview(pv, now)}<div class="gbar"><span class="gday">📅 Today, ${esc(today)}</span><button class="pill gsb" data-gs="-1" aria-label="Earlier">‹</button><button class="pill gsb" data-gs="1" aria-label="Later">›</button><span class="fine">${nets.length} channel${nets.length === 1 ? '' : 's'} you can watch · next 8 hours${Object.keys(LIVE_PKG).some(pk => S.mine.includes(pk) && LIVE_PKG[pk] !== '*') ? ' · package channels can vary by plan and area' : ''}</span></div>
    <div class="grid" id="ggrid"><div class="times">${times}<span class="nowtab" style="left:${nowPct}%">NOW ${esc(clock(new Date(now)))}</span></div>${rows}${gHas ? `<div class="gsent" data-gmore="gLim" aria-hidden="true"></div>` : freeRows}</div><div class="phone">${list}${freeCards}</div>
    ${odBar}<div class="grid gplut gond">${odRows}</div><div class="phone">${odCards}</div>
    ${fBar}<div class="grid" id="fgrid"><div class="times">${times}<span class="nowtab" style="left:${nowPct}%">NOW</span></div>${fRows}${fHas ? `<div class="gsent" data-gmore="fLim" aria-hidden="true"></div>` : ''}</div><div class="phone">${fCards}</div>${kidsOn() ? '' : ticker()}${freeTv()}${credit()}`;
}
const card = x => `<button class="card ${S.sel && S.sel.key === x.key ? 'on' : !x.svc || hasIt(x.svc) ? '' : 'off'}" data-i="${reg(x)}">${x.img ? `<img src="${esc(x.img)}"${tvmSet(x.img)} alt="" loading="lazy">` : ''}<span class="t"><b>${esc(x.title)}</b><small>${esc(x.note || '')}</small></span></button>`;
function showItem(s) {
  const net = (s.webChannel && s.webChannel.name) || (s.network && s.network.name) || '';
  return { key: 's' + s.id, title: s.name, svc: NETWORK_SERVICE[net] || null, url: s.officialSite || s.url, note: [net, (s.genres || []).slice(0, 2).join(', ')].filter(Boolean).join(' · '), series: true, img: s.image && s.image.medium, show: { id: s.id, name: s.name, net, img: s.image && s.image.medium, url: s.officialSite || s.url, genres: s.genres || [] } };
}
// ON YOUR SERVICES (Scott 11/14: "pull movie list from ... each streaming service so can be on guides for shows or movie list"; a service the person
// doesn't have "shouldnt show"). Popular movies + shows per service from TMDB through the relay ('cat'); free services count as yours.
const TMDB_G = { 28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Science-Fiction', 53: 'Thriller', 10752: 'War', 37: 'Western', 10759: 'Action', 10762: 'Children', 10765: 'Science-Fiction', 10768: 'War', 10764: 'Reality', 10767: 'Talk Show', 10763: 'News', 10766: 'Soap' };
const LIVE_ONLY = new Set(['YouTube TV', 'ESPN', 'Fox One', 'Sling Orange', 'Sling Blue', 'Hulu + Live TV', 'DirecTV Stream', 'Fubo']);   // live channel bundles: they're in the Live TV Guide, not a movie catalog
const catSvcs = () => S.mine.length ? [...new Set([...S.mine.filter(n => !LIVE_ONLY.has(n) && !FREE_SVC.has(n)), ...FREE_SVC])] : [];
const catItem = (r, svc, kind, kid) => ({ key: 't' + kind[0] + r.id, title: r.t, svc, note: [r.y, kind === 'tv' ? 'Series' : 'Movie', svc].filter(Boolean).join(' · '), series: kind === 'tv', img: r.p ? 'https://image.tmdb.org/t/p/w342' + r.p : null, big: r.p ? 'https://image.tmdb.org/t/p/w342' + r.p : null, sum: r.o, genres: (r.g || []).map(g => TMDB_G[g]).filter(Boolean), kid, show: null });
function loadCat(svc, kind) {
  const kid = kidsOn(), k = svc + '|' + kind + '|' + (kid ? 1 : 0); if (S.cat[k]) return;
  S.cat[k] = { busy: true };
  relay({ a: 'cat', svc, kind, kids: kid ? '1' : '0' })
    .then(j => { S.cat[k] = j.error ? { error: j.error } : { items: (j.items || []).map(r => catItem(r, svc, kind, kid)) }; })
    .catch(() => { S.cat[k] = { error: 'net' }; })
    .then(() => { if (S.tab === 1 || S.tab === 9 || S.tab === 0 || S.tab === 4) { const y = window.scrollY; draw(); window.scrollTo(0, y); } });
}
// FREE-TRIAL SHELVES (Scott 11/15: "we show some of their programming when free or introductory"): with offers on, the big services you
// don't have get a tab too, marked Free trial; their posters carry the Free trial tag and tapping one offers the trial.
const TRY_CAT = ['Peacock', 'Paramount+', 'Hulu', 'Disney+', 'HBO Max', 'Prime Video', 'Netflix', 'Apple TV'];
function catSection() {
  const svcs = [...catSvcs(), ...(S.mine.length && offersOn() ? TRY_CAT.filter(n => !S.mine.includes(n) && OFFER[n]) : [])];
  if (!svcs.length) return `<div class="hh" style="margin-top:22px"><h2>On Your Services</h2></div><div class="hbox" style="padding:16px"><p class="fine" style="margin:0 0 10px">Pick the services you have and their movies and shows show up here.</p><button class="btn" data-tab="3">Set up my services</button></div>`;
  const svc = svcs.includes(S.catSvc) ? S.catSvc : svcs[0], kind = S.catKind || 'movie', k = svc + '|' + kind + '|' + (kidsOn() ? 1 : 0);
  const full = kind === 'movie' && mlHas(svc);   // 11/16: Movies = the service's full movie list (catalogs.js)
  if (!full) loadCat(svc, kind);
  const c = S.cat[k] || { busy: true };
  const body = full ? mlBlock(svc) : c.busy ? '<p class="fine">Loading…</p>'
    : (c.error === 'nokey' || c.error === 'unknown') ? '<div class="hbox" style="padding:16px"><p class="fine" style="margin:0">Service catalogs switch on once the movie database key is added to the Marvel Magic relay.</p></div>'
    : c.error === 'noservice' ? `<p class="fine">No catalog listed for ${esc(svc)} yet.</p>`
    : c.error ? '<p class="fine">Couldn’t load right now. Try again in a bit.</p>'
    : c.items.length ? `<div class="lgrid">${mergeByTitle([...c.items, ...Object.values(S.cat).flatMap(o => o.items || []).filter(o => o.svc !== svc && c.items.some(i => tkey(i) === tkey(o)))]).filter(x => !(S.hideT && S.hideT.has(tkey(x)))).map(x => lposter(x)).join('')}</div>` : '<p class="fine">Nothing listed.</p>';
  return `<div class="hh" style="margin-top:22px"><h2>On Your Services</h2><div class="filters"><button class="chip ${kind === 'movie' ? 'on' : ''}" data-catk="movie">Movies</button><button class="chip ${kind === 'tv' ? 'on' : ''}" data-catk="tv">Shows</button></div></div>
    <div class="filters catsv">${svcs.map(n => `<button class="chip ${n === svc ? 'on' : ''}" data-cats="${esc(n)}">${esc(n)}${FREE_SVC.has(n) ? ' · Free' : !S.mine.includes(n) ? ' · Free trial' : ''}</button>`).join('')}</div>${!S.mine.includes(svc) && !FREE_SVC.has(svc) && OFFER[svc] ? `<div class="hbox" style="padding:12px 16px;display:flex;gap:12px;align-items:center;justify-content:space-between"><span class="fine" style="margin:0">You don't have ${esc(svc)}. Watch these with a free trial.<br><small style="opacity:.7">Offer · Marvel Magic may earn a commission</small></span><button class="btn" data-offer="${esc(svc)}">Try ${esc(svc)} ›</button></div>` : ''}${body}
    <p class="fine">Popular titles from <a href="https://www.themoviedb.org/" target="_blank" rel="noopener">TMDB</a>, where-to-watch by JustWatch. This product uses the TMDB API but is not endorsed or certified by TMDB.</p>`;
}
// SETTINGS (Scott 11/14): profile, favorite teams, favorite actors, tick boxes for favorite movie + show types, moods, services, alerts, Kids Lock.
// Synced to the person's account (Google sign-in) like the rest.
const WHOP_MM = 'https://whop.com/commander-marvel-por-picks/marvel-magic';   // Scott 11/14: $4.99/mo, 30-day free trial (prod_jXXGU9TnSIgHR)
const MOODS = ['Funny', 'Action', 'Mystery', 'Romance', 'Scary', 'Feel-good', 'Family Night', 'True story'];
// v11/21 the membership box shows where this device stands: unlocked (with the email), or the free days left + Join + unlock with
// the joined email (opens the same screen as the lock, with Not now). membership.js owns the checks; this only reads them.
// v11/21 (Scott: "firestick doesnt show version number anywhere"): in the Fire TV / Android TV app, Settings shows the app's
// version and a Check for update button (TV app 1.6+). An older app has no version() - it says so and how to get the update.
function tvAppBox() {
  let plat = ''; try { plat = window.MMNative && MMNative.platform ? MMNative.platform() : ''; } catch (e) { plat = ''; }
  if (plat !== 'firetv' && plat !== 'androidtv') return '';
  let v = ''; try { v = typeof MMNative.version === 'function' ? MMNative.version() : ''; } catch (e) { v = ''; }
  const body = v ? `<p style="margin:0 0 10px">Marvel Magic TV app <b>version ${esc(v)}</b>.</p><button class="btn" data-tvupd>Check for update</button>`
    : `<p style="margin:0 0 8px">This TV has an <b>older Marvel Magic app</b> (1.5 or before).</p><p class="fine" style="margin:0">To update: close Marvel Magic all the way (Settings &gt; Applications &gt; Manage Installed Applications &gt; Marvel Magic &gt; Force stop), then open it again and pick <b>Update now</b>.</p>`;
  // 11/21 memory (Scott: "do we need to monitor memory use on fire stick"): free memory from the TV app (1.6.3+) and low-memory mode
  const m = memRead(), on = load('liteForce', false);
  const mem = (m ? `<p style="margin:14px 0 4px">Memory: <b>${Number(m.avail).toLocaleString()} MB free</b> of ${Number(m.total).toLocaleString()} MB${m.low ? ' · <b>low right now</b>' : ''}</p>` : '<div style="height:10px"></div>')
    + `<p class="fine" style="margin:0 0 8px">Low-memory mode: <b>${S.lite ? 'on' : 'off'}</b>${S.lite ? ' (' + esc(S.liteWhy) + ')' : ''}. ${S.lite ? 'Smaller pictures and fewer cards, so the guide and your shows stay quick.' : 'Turns on by itself if this TV runs low on memory.'}</p>`
    + `<button class="btn alt" data-liteforce>${on ? 'Stop always using low-memory mode' : 'Always use low-memory mode'}</button>`;
  return `<section class="glow plain stbox"><h3>📺 TV App</h3>${body}${mem}</section>`;
}
function memberBox() {
  const mm = window.mmMembership, join = `<a class="btn gold" href="${WHOP_MM}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;text-decoration:none">Keep the Magic - $4.99/month ›</a>`;
  if (!mm) return `<p style="margin:0 0 8px"><b>30 days free, then $4.99 a month</b> for the whole household. Cancel any time.</p>${join}`;
  const m = mm.member();
  if (mm.owner && mm.owner()) return `<p style="margin:0 0 8px"><b>✓ Owner.</b> This is your product - this device never locks.</p><p class="fine" style="margin:0">Customers get 30 days free, then $4.99 a month for the household.</p>`;
  if (mm.memberGood() && mm.storeApp && mm.storeApp()) return `<p style="margin:0 0 8px"><b>✓ Member.</b> This device is unlocked${m && m.buyer ? ' for ' + esc(m.buyer) : ''}.</p>`;
  if (mm.memberGood()) return `<p style="margin:0 0 8px"><b>✓ Member.</b> This device is unlocked${m && m.buyer ? ' for ' + esc(m.buyer) : ''}.</p><p class="fine" style="margin:0">One membership covers every TV and phone in your home, up to 6. Manage or cancel on Whop.</p><a class="btn alt" href="https://whop.com/@me/settings/memberships/" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;text-decoration:none;margin-top:10px">Manage my membership ›</a>`;
  const left = mm.daysLeft();
  if (mm.storeApp && mm.storeApp()) return `<p style="margin:0 0 8px"><b>${left ? left + ' free day' + (left === 1 ? '' : 's') + ' left.' : 'Your free days are up.'}</b></p><p class="fine" style="margin:0 0 10px">Already a member? Sign in with the email you joined with.</p><button class="btn alt" data-mmunlock>Members: sign in</button>`;
  return `<p style="margin:0 0 8px"><b>${left ? left + ' free day' + (left === 1 ? '' : 's') + ' left.' : 'Your free days are up.'}</b> Then $4.99 a month for the whole household. Cancel any time.</p><p class="fine" style="margin:0 0 10px">Have a code? Enter it at checkout.</p><div style="display:flex;gap:8px;flex-wrap:wrap">${join}<button class="btn alt" data-mmunlock>Already joined? Unlock</button></div>`;
}
function settingsPage() {
  if (S.paired) return `${pageHero('pwatch', '⚙ SETTINGS', 'This TV', 'Set up for ' + esc(profName()) + '. Nothing to sign in to.')}<div style="margin-top:18px">${signTvBox()}</div><div style="margin-top:18px">${tvAppBox()}</div><div style="margin-top:18px" class="glow plain" ><p>This screen belongs to <b>${esc(profName())}</b> in ${esc((S.house && S.house.name) || 'the household')}. To change it, the household owner removes it in their Settings.</p></div>`;
  if (kidsOn()) return `${pageHero('pwatch', '⚙ SETTINGS', 'Settings', 'Locked while Kids Lock is on.')}<div style="margin-top:18px">${kidsSection()}</div>`;
  const mineT = t => S.teams.some(x => x.path === t.path && x.id === t.id);
  const hits = S.teamHits ? `<div class="teamhits">${S.teamHits.length ? S.teamHits.map((t, i) => `<button class="chip" data-team="${i}" ${mineT(t) ? 'disabled' : ''}>${esc(t.name)} · ${esc(t.league)}${mineT(t) ? ' ✓' : ''}</button>`).join('') : '<p class="fine">No team found.</p>'}</div>` : '';
  const box = (title, body, cls) => `<section class="glow ${cls || 'plain'} stbox"><h3>${title}</h3>${body}</section>`;
  const tick = (list, key, v) => `<label class="stck"><input type="checkbox" data-st="${key}" value="${esc(v)}" ${list.includes(v) ? 'checked' : ''}><span>${esc(v)}</span></label>`;
  const notif = !('Notification' in window) ? 'Not supported on this device.' : Notification.permission === 'granted' ? '✓ On. New episodes and game reminders pop up while Marvel Magic is open.' : Notification.permission === 'denied' ? 'Blocked in this browser\'s site settings.' : '<button class="btn" data-alerts>Turn on alerts</button>';
  return `<img class="top50ban" src="banner_settings.jpg" alt="Settings - My Settings: tell Marvel Magic what you like. It shapes For You, picks, Sports and alerts">
    <div class="stgrid">
    ${box('🏠 My Household', houseBox(), 'stwide')}
    ${typeof tipBox === 'function' ? tipBox() : ''}
    ${S.prof || S.profLock ? box('🔒 This TV', `<p class="fine">This TV opens as <b>${esc(profName())}</b> every time.</p><button class="btn ${S.profLock ? '' : 'alt'}" data-proflock>${S.profLock ? '🔒 Locked to ' + esc(profName()) + ' (PIN to unlock)' : 'Lock this TV to ' + esc(profName())}</button>`) : ''}
    ${signTvBox()}
    ${tvAppBox()}
    ${box('⭐ Marvel Magic Membership', memberBox(), 'amber')}
    ${box('👤 Profile', `<label class="stlab">Your name<input id="pfname" class="stin" maxlength="40" value="${esc(S.profile.name || firstName() || '')}" placeholder="Your name"></label><button class="btn alt" data-pfsave style="margin-top:8px">Save name</button>
      <p class="fine" style="margin:12px 0 6px">${me ? '✓ Signed in as ' + esc(me.email || me.displayName || '') + '. Your settings follow you to every device.' : 'Sign in with Google and your settings follow you to every device.'}</p><button class="btn ${me ? 'alt' : ''}" data-acct2>${me ? 'Sign out' : 'Sign in with Google'}</button>`)}
    ${box('🏈 Favorite Teams', `${S.teams.length ? S.teams.map(t => `<div class="spmy"><span>★</span><b>${esc(t.name)}</b><small>${esc(t.league)}</small><button class="round" data-rmteam="${esc(t.path + '|' + t.id)}" aria-label="Remove ${esc(t.name)}">✕</button></div>`).join('') : '<p class="fine">No teams yet.</p>'}
      <form class="search" id="teamfind" style="margin-top:10px"><input id="tq" aria-label="Find a team" placeholder="Add a team, like Razorbacks or Chiefs" value="${esc(S.tq || '')}"><button class="btn">Add</button></form>${hits}<p class="fine">Their games show first on Sports and Home, with reminders.</p>`)}
    ${box('🎭 Favorite Actors', `<div class="stchips">${S.actors.map(a => `<button class="chip on" data-rmactor="${esc(a)}" aria-label="Remove ${esc(a)}">${esc(a)} ✕</button>`).join('') || '<p class="fine">None yet.</p>'}</div>
      <form class="search" id="actorfind" style="margin-top:10px"><input id="aq" maxlength="60" aria-label="Add an actor" placeholder="Add an actor, like Tom Hanks"><button class="btn">Add</button></form>`)}
    ${box('🎬 Favorite Movie &amp; Show Types', `<div class="stticks">${GENRES.map(g => tick(S.likes, 'likes', g)).join('')}</div><p class="fine">For You picks lean on these.</p>`, 'stwide')}
    ${box('😀 Moods I Like', `<div class="stticks">${MOODS.map(m => tick(S.moods, 'moods', m)).join('')}</div>`)}
    ${box('📺 My Services', `<p class="fine">Tick what you have. The guide, catalogs and picks show only these.</p><div class="svcs">${SERVICES.map(x => `<label><input type="checkbox" data-svc="${esc(x)}" ${S.mine.includes(x) ? 'checked' : ''}>${esc(x)}</label>`).join('')}</div><button class="btn alt" data-tab="3" style="margin-top:10px">Sign in to services ›</button>`, 'stwide')}
    ${box('✨ Get more services', `<label class="fine" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-offersw ${offersOn() ? 'checked' : ''}> Show offers (free trials for services you don't have)</label>`
      + (offersOn() ? `<div class="svcs" style="margin-top:8px">${SERVICES.filter(x => OFFER[x] && !S.mine.includes(x)).map(x => `<button class="btn alt" data-offer="${esc(x)}">${esc(x)} ›</button>`).join('')}</div><p class="fine" style="opacity:.7;margin-top:8px">${OFFER_NOTE}</p>` : ''), 'stwide')}
    ${box('🔔 Alerts', `<p class="fine">${notif}</p><label class="stck" style="margin-top:8px"><input type="checkbox" data-svcremind ${S.svcRemindOff ? '' : 'checked'}><span>Remind me when I haven't used a paid service for 30 days (again every 30)</span></label>`)}
    ${kidsSection()}
    </div>`;
}
// FREE CHANNEL GUIDE (Scott 11/14): free_guide.json is rebuilt every 3 hours by tools/build_free_guide.py (GitHub Actions) from the community
// XMLTV mirror at i.mjh.nz - Pluto TV, Samsung TV Plus, Plex, Roku Channel. Test build only: not licensed; licensed data before selling.
let FREE_G = null;
const FREE_GSVC = ['Pluto TV', 'Samsung TV Plus', 'Plex', 'The Roku Channel'];
function loadFreeGuide() { if (FREE_G) return; FREE_G = { ch: [] }; fetch('free_guide.json?v=' + Math.floor(Date.now() / 3600000)).then(r => r.json()).then(j => {
  let sam = true; try { sam = !inTvApp() || MMNative.has('Samsung TV Plus'); } catch { sam = false; }
  if (!sam) j.ch = (j.ch || []).map(r => ({ ...r, p: r.p.filter(q => q[0] !== 'Samsung TV Plus') })).filter(r => r.p.length);   // a TV without the Samsung TV Plus app (Fire TV) skips it (Scott 11/14)
  FREE_G = j; if (S.tab === 0 || S.tab === 4) { const y = window.scrollY; draw(); window.scrollTo(0, y); } }).catch(() => {}); }
const FREE_ORDER = ['Movies', 'News', 'Sports', 'Drama', 'Comedy', 'Crime', 'Reality', 'Classic TV', 'Westerns', 'Sci-Fi', 'Kids', 'Food & Home', 'Nature & History', 'Music', 'En Español', 'Other'];
// PLUTO CHANNELS (Scott 11/14): the channel list ships with the app (pluto_channels.json - name, slug, number, category; collected once from
// Pluto's public lineup, no schedules). A tap opens that channel already playing on Pluto, never Pluto's own guide.
let PLUTO_CH = null;
function loadPluto() { if (PLUTO_CH) return; PLUTO_CH = []; fetch('pluto_channels.json').then(r => r.json()).then(j => { PLUTO_CH = j; if ([0, 4].includes(S.tab)) { const y = window.scrollY; draw(); window.scrollTo(0, y); } }).catch(() => {}); }
const plutoUrl = slug => 'https://pluto.tv/us/live-tv/' + encodeURIComponent(slug);
function plutoBlock() {
  loadPluto();
  if (!PLUTO_CH.length) return '<p class="fine">Loading Pluto TV channels…</p>';
  const cats = [...new Set(PLUTO_CH.map(c => c[3]))].filter(c => !kidsOn() || c === 'Kids');
  const cat = cats.includes(S.plutoCat) ? S.plutoCat : (kidsOn() ? 'Kids' : 'Movies');
  const list = PLUTO_CH.filter(c => c[3] === cat);
  return `<div class="hh" style="margin-top:22px"><h2>📺 Pluto TV Channels <small class="fine">${PLUTO_CH.length} free channels</small></h2></div>
    <div class="filters catsv">${cats.map(c => `<button class="chip ${c === cat ? 'on' : ''}" data-plcat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <div class="plgrid">${list.map(c => `<a class="plc" href="${esc(plutoUrl(c[1]))}" target="_blank" rel="noopener" data-free="Pluto TV"><span class="pln">${c[2] || ''}</span><b>${esc(c[0])}</b><span class="plw">Watch ↗</span></a>`).join('')}</div>
    <p class="fine">Opens the channel playing on Pluto TV (free, no account needed). Channel lineup from Pluto TV.</p>`;
}
// WATCH LATER (Scott 11/14): anything can be saved for later; each entry keeps where it can be watched
const laterKey = x => tkey(x);
const isLater = x => !!x && S.later.some(l => l.k === laterKey(x));
function toggleLater(x) {
  if (!x) return; const k = laterKey(x);
  if (S.later.some(l => l.k === k)) S.later = S.later.filter(l => l.k !== k);
  else S.later = [{ k, title: x.title, img: x.big || x.img || (x.show && x.show.img) || null, svc: x.svc || null, exact: x.exact || null, url: x.url || null, series: !!x.series, options: (x.options || []).slice(0, 8), when: x.start || x.when || null, free: !!x.free || FREE_SVC.has(x.svc), at: Date.now() }, ...S.later].slice(0, 200);
  save('later', S.later);
}
const laterFree = l => !!l.free || FREE_SVC.has(l.svc);
const laterItem = l => ({ key: 'WL' + l.k, title: l.title, img: l.img, big: l.img, svc: l.svc, exact: l.exact, url: l.url || 'https://www.google.com/search?q=' + encodeURIComponent(l.title + ' watch'), series: l.series, options: l.options, note: l.svc || '' });
function laterRow(max, which) {
  const its = S.later.filter(l => which == null || laterFree(l) === which).slice(0, max || 12); if (!its.length) return '';
  return `<div class="lgrid six">${its.map(l => { const x = laterItem(l); return `<div class="wlwrap">${lposter(x)}<button class="round wlx" data-unlater="${esc(l.k)}" aria-label="Remove ${esc(l.title)} from Watch Later">✕</button></div>`; }).join('')}</div>`;
}
// ONE CARD PER TITLE: the same movie or show from several places becomes one card; options = every place, the ones you have first.
const tkey = x => String(x.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + '|' + (x.series ? 'tv' : 'm');
function mergeByTitle(list) {
  const m = new Map();
  for (const x of list) {
    const k = tkey(x), place = x.svc ? { svc: x.svc, url: SERVICE_URL[x.svc] ? SERVICE_URL[x.svc](slug(x.title)) : '' } : null;
    const have = m.get(k);
    if (!have) { m.set(k, { ...x, options: [...(x.options || []), ...(place ? [place] : [])] }); continue; }
    if (place && !have.options.some(o => o.svc === place.svc)) have.options.push(place);
    if (!have.img && x.img) { have.img = x.img; have.big = x.big || x.img; }
    if (!have.svc || (!hasIt(have.svc) && x.svc && hasIt(x.svc))) have.svc = x.svc;
  }
  for (const v of m.values()) { v.options.sort((a, b) => Number(hasIt(b.svc)) - Number(hasIt(a.svc))); if (v.options[0] && !hasIt(v.svc || '')) v.svc = v.options[0].svc; }
  return [...m.values()];
}
const placesBadge = x => x.svc ? `<span class="sv">${esc(x.svc)}${x.options && x.options.length > 1 ? ' +' + (x.options.length - 1) : ''}</span>` : '';
// MOVIES & SHOWS = THE LOUNGE (Scott 11/14 board): Movie Night hero, Find Tonight's Pick, big poster cards. Picks lean on the genres of the shows you saved.
function tasteOf() { const c = {}; for (const s of S.list) for (const g of (s.genres || [])) c[g] = (c[g] || 0) + 1; return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]); }
function todayShows() {
  const seen = new Set();
  // Scott 11/21 ("when a show list a particular channel and you open it ... that channel is one of the choices"): the card names the channel
  // it airs on and every choice is a way to THAT channel (chanWays) - an NBC show re-running on USA opens USA, never the show's home app.
  // Only shows on a channel you can reach (11/14).
  return S.airings.filter(a => a.show && a.end > Date.now() && !seen.has(a.show.id) && seen.add(a.show.id)).map(a => {
    const it = showItem(a.show), cw = chanWays(a.net), mine = waysFor(a.net)[0];
    return { ...it, big: a.show.image && (a.show.image.original || a.show.image.medium), when: a.start, chan: a.net, w: a.show.weight || 0, options: cw,
      svc: (mine && mine.svc) || (cw[0] && cw[0].svc) || null, note: [a.net ? 'On ' + a.net : '', (it.show.genres || []).slice(0, 2).join(', ')].filter(Boolean).join(' · ') };
  }).filter(yours);
}
function tonightPicks() {
  const taste = tasteOf(), have = new Set(S.list.map(s => s.id));
  return todayShows().map(x => ({ x, sc: (x.show.genres || []).filter(g => taste.includes(g)).length * 100 + (have.has(x.show.id) ? -50 : 0) + x.w / 10 })).filter(r => r.x.big).sort((a, b) => b.sc - a.sc).map(r => r.x);
}
// 11/20: TVmaze posters came as full originals (up to 1.6 MB, 4K) even where they show ~180 px wide - ~4 MB on the TV home. srcset offers
// TVmaze's own 210-px poster too; the browser takes it when that is enough (a TV) and keeps the original for big posters / sharp phone
// screens. "auto" = the poster's real width (lazy images); older browsers use 200px. A missing small one falls back to the original.
// Later 11/20: sharp phone screens still took the original (1-2 MB 4K posters for ~170 px), so a 600-px copy from wsrv.nl (free image
// resizer, webp) sits between; if wsrv fails, onerror shows the original.
// 11/21: big posters (.lp.big, 172 px) on a 3x phone still took the original - Chrome's sizes=auto guess landed on the 1200w step,
// which WAS the original (TVmaze originals run up to 3-4K, 1-3 MB; 16 of them = 21 MB in a phone's first minute). Now 1200w is a
// wsrv copy too and the original is listed as 4000w, so it is only used if wsrv fails (onerror).
const tvmSet = u => /^https:\/\/static\.tvmaze\.com\/uploads\/images\/original_untouched\/[\w\/.-]+$/.test(u || '') ? ` srcset="${esc(u.replace('/original_untouched/', '/medium_portrait/'))} 210w, https://wsrv.nl/?url=${encodeURIComponent(u.slice(8))}&amp;w=600&amp;output=webp&amp;q=80 600w, https://wsrv.nl/?url=${encodeURIComponent(u.slice(8))}&amp;w=1200&amp;output=webp&amp;q=80 1200w, ${esc(u)} 4000w" sizes="auto, 200px" onerror="if(this.srcset){this.removeAttribute('srcset');this.src='${esc(u)}'}"` : '';
const _lposter = (x, big) => `<button class="lp${big ? ' big' : ''}${S.sel && S.sel.key === x.key ? ' on' : ''}${x.svc && !hasIt(x.svc) ? (offersOn() && OFFER[x.svc] ? ' offer' : ' off') : ''}" data-i="${reg(x)}">${x.svc && !hasIt(x.svc) && offersOn() && OFFER[x.svc] ? '<span class="trialtag">Free trial</span>' : ''}${x.big || x.img ? `<img src="${esc(x.big || x.img)}"${tvmSet(x.big || x.img)} alt="" loading="lazy">` : `<span class="lpno">🎬</span>`}${placesBadge(x)}<span class="lpt"><b>${esc(x.title)}</b><small>${esc(x.when ? (x.when <= Date.now() ? 'On now' : clock(new Date(x.when))) + (x.chan ? ' · ' + x.chan : '') : x.note || '')}</small></span></button>`;
function shows() {
  if (S.mlAll) return mlAllPage(S.mlAll);   // a full movie list, See all (catalogs.js)
  const taste = tasteOf(), picks = tonightPicks().filter(kidOk).slice(0, 4), pickKeys = new Set(picks.map(p => p.key));
  S.hideT = new Set(picks.map(tkey));
  const rest = todayShows().filter(x => !pickKeys.has(x.key) && kidOk(x) && !S.hideT.has(tkey(x))).slice(0, lite(24, 12));   // low-memory mode: half the posters (11/21)
  const res = S.results;
  const found = res ? `<div class="hh"><h2>Results for “${esc(S.q)}”</h2><button class="more" data-clearq>Clear ✕</button></div>${S.movies && S.movies.length && !kidsOn() ? `<h3 class="lsub">Movies</h3><div class="lgrid">${S.movies.map(m => lposter(m)).join('')}</div>` : ''}<h3 class="lsub">Shows</h3>${res.filter(kidOk).length ? `<div class="lgrid">${res.filter(kidOk).map(x => lposter({ ...x, big: x.show && x.show.img })).join('')}</div>` : '<p class="fine">No shows found.</p>'}` : '';
  return `<section class="lounge"><div class="lounge-art"></div><div class="lounge-theater"></div><div class="lounge-in"><div class="lk">🛋 THE LOUNGE</div><h1 class="lt">Movie Night</h1><p class="lsub2">Settle in and find something good tonight, from the services you have.</p>
      <div class="lb"><button class="btn gold" data-pick>▶ Find Tonight's Pick</button><button class="btn alt" data-tab="11">🎬 Browse All Movies</button><form class="search lsearch" id="find"><input id="q" aria-label="Search movies and shows" placeholder="Search any movie or show" value="${esc(S.q || '')}"><button class="btn">Search</button></form></div>
      <div class="ltaste">${taste.length ? `<b>Your taste:</b>${taste.map(g => `<span>${esc(g)}</span>`).join('')}` : '<span class="fine">Save a few shows and Marvel Magic learns your taste.</span>'}</div></div></section>
    ${found}${res ? mlFound(S.q) : ''}
    <div class="hh" style="margin-top:18px"><h2>${taste.length ? 'Picked for Your Lounge' : 'Popular Tonight'}</h2></div>${picks.length ? `<div class="lgrid four">${picks.map(x => lposter(x, true)).join('')}</div>` : `<p class="fine">${S.airings.length ? 'Nothing with artwork on tonight.' : 'Loading tonight’s shows…'}</p>`}
    ${catSection()}${mlShelf('YouTube', 12)}${rest.length ? `<div class="hh" style="margin-top:18px"><h2>On Today</h2><button class="more" data-tab="0">Guide ›</button></div><div class="lgrid">${rest.map(x => lposter(x)).join('')}</div>` : ''}${credit()}`;
}
// SPORTS = WHERE'S MY GAME (Scott 11/14 board; "Where Can I Watch My Team?" 11/08). Team names + team colors from ESPN, no team logos (trademarks).
