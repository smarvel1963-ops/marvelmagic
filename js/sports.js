// js/sports.js
// Save to: C:\MarvelApps\marvelmagic\js\sports.js
// Marvel Magic - Sports (Where's My Game), team logos, watchlist, Free TV, sign-in buttons, My Top 50, profiles, TV code, QR pairing, household, Marvel Magic Top 50, service quality.
// Split out of index.html 2026-11-15 (sell-readiness pass). Plain script, shared global scope, loaded in order:
// core -> guide -> sports -> home -> app. After editing, run  python tools\stamp_versions.py  then  python tests\smoke_test.py

// Prices are approximate monthly prices as of 11/2026, Claude's general knowledge, not a feed - services change them, so the page says "about" and "check".
const PRICE = { Peacock: 10.99, 'Paramount+': 7.99, ESPN: 29.99, 'YouTube TV': 82.99, 'HBO Max': 10.99, 'Fox One': 19.99, 'Prime Video': 8.99, 'Apple TV': 12.99, Hulu: 9.99, Netflix: 7.99, 'Disney+': 9.99, 'Sling Orange': 45.99, 'Sling Blue': 50.99, 'Hulu + Live TV': 82.99, 'DirecTV Stream': 86.99, Fubo: 84.99 };
// TEAM LOGOS (Scott 11/14 "sports teams should have logos"): from ESPN's game data. Fine for the test build; licensing comes before selling.
const tlogo = (u, cls) => u ? `<img class="${cls || 'tlg'}" src="${esc(u)}" alt="" loading="lazy" onerror="this.remove()">` : '';
const tcol = c => /^[0-9a-f]{6}$/i.test(String(c || '')) ? '#' + c : '';
function sports() {
  const now = Date.now(), sel = x => S.sel && S.sel.key === x.key ? ' on' : '';
  const mine = t => S.teams.some(x => x.path === t.path && x.id === t.id);
  const live = S.games.filter(g => g.state === 'in'), nextMine = S.teamGames.filter(g => g.when > now - 4 * 3600000).sort((a, b) => a.when - b.when);
  const auto = live.find(mineGame) || (nextMine[0] && (S.games.find(g => g.key === nextMine[0].key) || nextMine[0])) || live[0] || S.games.filter(g => g.state === 'pre').sort((a, b) => a.when - b.when)[0] || null;
  const f = (S.sel && S.sel.sport) ? (S.games.find(g => g.key === S.sel.key) || S.sel) : auto;
  // featured game
  let hero = `<section class="spf"><p class="fine">${S.gamesDone ? 'No games today. Add your teams and their next games show up here.' : 'Loading games…'}</p></section>`;
  if (f) {
    const st = f.state === 'in' ? `<span class="spbadge">● LIVE NOW</span>` : f.state === 'post' ? `<span class="spbadge fin">FINAL</span>` : `<span class="spbadge up">UPCOMING</span>`;
    const [as, hs] = f.score ? f.score.split(' - ') : ['', ''];
    const mid = f.state === 'pre' ? `<span class="spmid"><span class="ko">STARTS IN</span><span class="cd" data-when="${f.when}">${esc(cdText(f.when))}</span><small>${esc(f.detail)}</small></span>` : `<span class="spmid"><span class="spclock">${f.state === 'in' ? '● ' : ''}${esc(f.detail)}</span></span>`;
    const opts = (f.options || []).slice().sort((a, b) => Number(hasIt(b.svc)) - Number(hasIt(a.svc)));
    hero = `<section class="spf" style="--ac:${tcol(f.awayColor) || '#2B4FD8'};--hc:${tcol(f.homeColor) || '#C8283C'}">${st}<div class="splg">${esc(f.note.split(' · ')[0])}</div>
      <div class="spteams"><div class="spt">${tlogo(f.awayLogo, 'splg2')}<b>${esc(f.away || f.title)}</b>${f.score ? `<span class="spsc">${esc(as)}</span>` : ''}</div>${mid}<div class="spt">${tlogo(f.homeLogo, 'splg2')}<b>${esc(f.home || '')}</b>${f.score ? `<span class="spsc">${esc(hs)}</span>` : ''}</div></div>
      <div class="spwatch"><span>WATCH ON</span>${!opts.length ? '<em class="fine">Channel not announced yet</em>' : opts.some(o => hasIt(o.svc)) ? opts.filter(o => hasIt(o.svc)).map(o => `<a class="spw yours" data-opt href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.svc)} ✓</a>`).join('') : (offersOn() && opts.some(o => OFFER[o.svc]) ? opts.filter(o => OFFER[o.svc]).map(o => `<button class="spw" data-offer="${esc(o.svc)}">Try ${esc(o.svc)} ›</button>`).join('') + `<em class="fine" style="display:block;opacity:.7">Offer · Marvel Magic may earn a commission</em>` : `<em class="fine">Not on your services (on ${esc(opts.map(o => o.svc).join(', '))})</em>`)}</div></section>`;   // Scott 11/15: show offers
  }
  // today's games, filtered
  const flt = S.sf || 'all', rank = { in: 0, pre: 1, post: 2 };
  // sport buttons: one per league with games today; leagues your favorite teams play get a star and always sit first
  const favL = new Set(S.teams.map(t => t.league)), lg = [...new Set(S.games.map(g => g.league))].sort((a, b) => (favL.has(b) - favL.has(a)) || LEAGUES.findIndex(l => l[0] === a) - LEAGUES.findIndex(l => l[0] === b));
  const spt = lg.includes(S.sport) ? S.sport : 'all';
  const sportChips = `<button class="chip ${spt === 'all' ? 'on' : ''}" data-sport="all">All sports <small>${S.games.length}</small></button>` + lg.map(l => `<button class="chip ${spt === l ? 'on' : ''} ${favL.has(l) ? 'fav' : ''}" data-sport="${esc(l)}">${favL.has(l) ? '★ ' : ''}${esc(l)} <small>${S.games.filter(g => g.league === l).length}</small></button>`).join('');
  const shown = S.games.filter(g => spt === 'all' || g.league === spt).filter(g => flt === 'all' || (flt === 'live' && g.state === 'in') || (flt === 'up' && g.state === 'pre') || (flt === 'final' && g.state === 'post') || (flt === 'mine' && mineGame(g))).sort((a, b) => (mineGame(b) - mineGame(a)) || rank[a.state] - rank[b.state] || a.when - b.when);
  const gc = g => `<button class="spc${sel(g)}${f && f.key === g.key ? ' feat' : ''}" data-i="${reg(g)}"><span class="spct ${g.state === 'in' ? 'l' : g.state === 'post' ? 'f' : 'u'}">${g.state === 'in' ? '● LIVE' : g.state === 'post' ? 'FINAL' : 'UPCOMING'}</span>${mineGame(g) ? '<span class="spstar">★</span>' : ''}<b class="spvs">${tlogo(g.awayLogo)}${esc(g.away)} <i>vs</i> ${tlogo(g.homeLogo)}${esc(g.home)}</b><small>${g.state === 'pre' ? esc(clock(new Date(g.when))) : esc(g.score + ' · ' + g.detail)}</small><small class="spcl">${esc(g.note)}</small></button>`;
  const chips = [['all', 'All'], ['live', '● Live'], ['up', 'Upcoming'], ['final', 'Final'], ['mine', '★ My Teams']].map(([v, l]) => `<button class="chip ${flt === v ? 'on' : ''}" data-sf="${v}">${l}</button>`).join('');
  // right column
  const hits = S.teamHits ? `<div class="teamhits">${S.teamHits.length ? S.teamHits.map((t, i) => `<button class="chip" data-team="${i}" ${mine(t) ? 'disabled' : ''}>${esc(t.name)} · ${esc(t.league)}${mine(t) ? ' ✓' : ''}</button>`).join('') : '<p class="fine">No team found.</p>'}</div>` : '';
  const teamsBox = `<section class="sps"><h3>★ My Teams <small>${S.teams.length} picked</small></h3>${S.teams.map(t => `<div class="spmy"><span>★</span><b>${esc(t.name)}</b><small>${esc(t.league)}</small><button class="round" data-rmteam="${esc(t.path + '|' + t.id)}" aria-label="Remove ${esc(t.name)}">✕</button></div>`).join('')}
    <form class="search" id="teamfind" style="margin-top:10px"><input id="tq" aria-label="Find a team" placeholder="Add a team, like Razorbacks" value="${esc(S.tq || '')}"><button class="btn">Add</button></form>${hits}</section>`;
  const upBox = `<section class="sps"><h3>📅 Upcoming Games</h3>${nextMine.length ? nextMine.slice(0, 4).map(g => `<button class="spup${sel(g)}" data-i="${reg(g)}"><span class="t"><b class="spvs">${tlogo(g.awayLogo)}${esc(g.away)} <i>vs</i> ${tlogo(g.homeLogo)}${esc(g.home)}</b><small>${esc(g.detail)} · ${esc(g.note.split(' · ').slice(1).join(' · '))}</small></span><span class="spcd"><small>${new Date(g.when).toDateString() === new Date().toDateString() ? 'TONIGHT' : 'IN'}</small><b class="cd" data-when="${g.when}">${esc(cdText(g.when))}</b></span></button>`).join('') : `<p class="fine">${S.teams.length ? 'Looking up your teams’ games…' : 'Add a team and its next games show here.'}</p>`}</section>`;
  const fo = f ? (f.options || []) : [];
  const chanBox = `<section class="sps"><h3>📺 Channel Availability <small>this game</small></h3>${fo.length ? `<div class="spch">${fo.map(o => `<div class="${hasIt(o.svc) ? 'ok' : 'no'}"><b>${esc(o.svc)}</b><small>${hasIt(o.svc) ? '✓ You have it' : 'Not in your services'}</small></div>`).join('')}</div>` : '<p class="fine">Pick a game to see where it’s on.</p>'}</section>`;
  // costs + reminder
  const missing = fo.filter(o => !hasIt(o.svc));
  const costs = !f ? '' : missing.length ? missing.map(o => `<div class="spcost"><b>${esc(o.svc)}</b><span class="spp">${PRICE[o.svc] ? 'about $' + PRICE[o.svc].toFixed(2) + '/mo' : 'price varies'}</span><small>Carries this game</small>${offersOn() && OFFER[o.svc] ? `<button class="btn alt" data-offer="${esc(o.svc)}">Try it ›</button>` : ''}</div>`).join('') : `<p class="spall">✓ You already have ${fo.length ? 'a service that carries this game' : 'what you need'}.</p>`;
  const rg = (f && f.state === 'pre') ? f : nextMine.find(g => g.when > now) || null, on = rg && S.remind[rg.key];
  const remind = rg ? `<button class="sprem" data-remind="${esc(rg.key)}" data-rt="${esc(rg.away + ' vs ' + rg.home)}" data-rw="${rg.when}" aria-pressed="${on ? 'true' : 'false'}"><span class="t"><b>🔔 Remind me 15 min before</b><small>${esc(rg.away)} vs ${esc(rg.home)} · ${esc(rg.detail)}</small></span><span class="tog ${on ? 'on' : ''}"><i></i></span></button>` : '';
  return `<img class="top50ban" src="banner_sports.jpg" alt="Where's My Game? Find your game. See where it's on. Live, upcoming or final, all in one place.">
    <div class="spgrid"><div class="spmain">${hero}
      <div class="hh" style="margin-top:18px"><h2>Today's Games <small class="fine">${shown.length}</small></h2><div class="filters">${chips}</div></div>
      <div class="filters spsports">${sportChips}</div>
      <div class="spcards">${shown.length ? shown.map(gc).join('') : '<p class="fine">Nothing here right now.</p>'}</div></div>
    <aside class="spside">${teamsBox}${upBox}${chanBox}</aside></div>
    <section class="spbot"><div class="spbt"><h3>💲 What it costs to watch</h3><small class="fine">Services that carry ${f ? 'this game' : 'today’s games'} that you don’t have. Approximate prices, check the service.</small></div><div class="spcosts">${costs}</div>${remind}</section>
    <p class="fine">Scores and game channels from ESPN. Streaming options can vary by area. Reminders work while Marvel Magic is open.</p>`;
}
async function loadAllTeams() {
  if (S.allTeams) return S.allTeams;
  const j = await fetch('teams.json').then(r => r.json()).catch(() => ({}));   // ESPN doesn't let browsers read its team lists, so the list ships with the app
  const lists = Object.entries(j).map(([league, v]) => v.teams.map(([id, name]) => ({ id, name, league, path: v.path })));
  return (S.allTeams = lists.flat());
}
async function loadTeamGames() {
  const now = Date.now(), out = await Promise.all(S.teams.map(t => fetch(`https://site.api.espn.com/apis/site/v2/sports/${t.path}/teams/${t.id}/schedule`).then(r => r.json()).then(j => (j.events || []).filter(e => Date.parse(e.date) > now - 3 * 3600000).slice(0, 6).map(e => {
    const c = e.competitions[0], home = c.competitors.find(x => x.homeAway === 'home'), away = c.competitors.find(x => x.homeAway === 'away'), when = Date.parse(e.date);
    const tv = [...new Set((c.broadcasts || []).map(b => b.media && b.media.shortName).filter(Boolean))], options = optsFor(tv);
    return { key: 'g' + e.id, title: `${away.team.shortDisplayName} at ${home.team.shortDisplayName}`, away: away.team.shortDisplayName, home: home.team.shortDisplayName, awayColor: away.team.color, homeColor: home.team.color, awayLogo: (away.team.logos && away.team.logos[0] && away.team.logos[0].href) || away.team.logo || null, homeLogo: (home.team.logos && home.team.logos[0] && home.team.logos[0].href) || home.team.logo || null, state: 'pre', detail: new Date(when).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + clock(new Date(when)), when, score: '', options, svc: (options.find(o => hasIt(o.svc)) || {}).svc || null, url: (e.links && e.links[0] && e.links[0].href) || 'https://www.espn.com/', note: [t.league, tv.join(', ') || 'Channel not announced yet'].join(' · '), series: false, sport: true };
  })).catch(() => [])));
  const seen = new Set(); S.teamGames = out.flat().filter(g => !seen.has(g.key) && seen.add(g.key));
  if (S.tab === 2 || S.tab === HOME) { const y = window.scrollY; draw(); window.scrollTo(0, y); }
}
// WATCHLIST (Scott 11/08 design + "maybe progress in both 2 bars"): where you are is kept by Marvel Magic; services don't share it.
const epLabel = e => `S${e.season} E${e.number}`, day = t => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });
function track(s) {
  const eps = S.eps[s.id]; if (!eps) return null;
  const now = Date.now(), at = Math.min(s.at || 0, eps.length), aired = eps.filter(e => Date.parse(e.airstamp) <= now).length, next = eps[at] || null, nextAt = next ? Date.parse(next.airstamp) : 0;
  const ref = next || eps[eps.length - 1], inSeason = ref ? eps.filter(e => e.season === ref.season) : [], seasonSeen = ref ? eps.slice(0, at).filter(e => e.season === ref.season).length : 0;
  const open = !!next && nextAt && nextAt <= now, status = !next ? 'Completed' : !open ? 'Waiting' : at > 0 ? 'Watching' : 'Up Next';
  return { at, total: eps.length, aired, next, nextAt, open, status, season: ref ? ref.season : 0, seasonSeen, seasonTotal: inSeason.length, fresh: open && now - nextAt < 14 * 86400000, soon: !!next && !open && nextAt - now < 7 * 86400000 };
}
const bar = (label, a, b) => `<div class="prog"><span>${esc(label)}: ${a} of ${b}</span><div class="bar"><i style="width:${b ? Math.round(a / b * 100) : 0}%"></i></div></div>`;
function stuff() {
  const rows = S.list.map(s => ({ s, t: track(s), x: { key: 's' + s.id, title: s.name, svc: NETWORK_SERVICE[s.net] || null, url: s.url, note: s.net, series: true, img: s.img, show: s } }));
  const known = rows.filter(r => r.t), n = st => known.filter(r => r.t.status === st).length, alerts = known.filter(r => r.t.fresh), soon = known.filter(r => r.t.soon).length;
  const f = S.filter || 'Watching', shown = rows.filter(r => (f === 'All' || (r.t && r.t.status === f)) && kidOk({ genres: r.s.genres || [], net: r.s.net }));
  const upcoming = known.filter(r => r.t.next && !r.t.open).sort((x, y) => x.t.nextAt - y.t.nextAt);
  const cont = known.filter(r => r.t.status === 'Watching').slice(0, 4);
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const svcName = r => r.x.svc || r.s.net || '';
  const nextLine = t => !t.next ? 'All caught up' : t.open ? epLabel(t.next) + ' - Now Available!' : epLabel(t.next) + ' - ' + day(t.nextAt);
  const tile = (cls, icon, label, big) => `<div class="tile ${cls}"><span class="ti">${icon}</span><span><small>${label}</small><b>${big}</b></span></div>`;
  const poster = r => `<div class="pw"><button class="pc" data-i="${reg(r.x)}">${r.s.img ? `<img src="${esc(r.s.img)}" alt="">` : ''}<span class="sv">${esc(svcName(r))}</span><span class="pcname">${esc(r.s.name)}</span>
    <span class="pcfoot"><span>${r.t.next ? epLabel(r.t.next) : ''}</span><span>${pct(r.t.seasonSeen, r.t.seasonTotal)}%</span></span><span class="thin"><i style="width:${pct(r.t.seasonSeen, r.t.seasonTotal)}%"></i></span><span class="thin b2"><i style="width:${pct(r.t.at, r.t.total)}%"></i></span></button>${thumbBtn(r.x)}</div>`;
  const row = r => { const t = r.t, sel = S.sel && S.sel.key === r.x.key;
    return `<div class="wl ${sel ? 'on' : ''}"><button class="wlart" data-i="${reg(r.x)}" aria-label="Pick ${esc(r.s.name)}">${r.s.img ? `<img src="${esc(r.s.img)}" alt="">` : ''}<span class="wlname">${esc(r.s.name)}</span></button>
      <button class="play" data-i="${reg(r.x)}" aria-label="Pick ${esc(r.s.name)}">▶</button><div class="wlt"><b>${esc(r.s.name)}</b><small>${esc(svcName(r))}</small></div>
      ${t ? `<div class="bars">${bar('Season ' + t.season, t.seasonSeen, t.seasonTotal)}${bar('Series', t.at, t.total)}</div>
      <div class="nu"><b>${t.next ? 'Next Up:' : 'Done'}</b><small class="${t.open ? 'av' : ''}">${esc(nextLine(t))}</small></div>
      <div class="wlbtn">${thumbBtn(r.x)}<button class="round" data-w="${r.s.id}" data-d="-1" aria-label="Back one episode">−</button><button class="round go" data-w="${r.s.id}" data-d="1" aria-label="Watched one episode" ${t.next ? '' : 'disabled'}>✓</button></div>` : '<div class="fine">Loading…</div>'}</div>`; };
  const alertRow = r => `<button class="ar" data-i="${reg(r.x)}">${r.s.img ? `<img src="${esc(r.s.img)}" alt="">` : '<span class="noimg"></span>'}<span class="t"><b>${esc(r.s.name)}</b><small>${esc(epLabel(r.t.next))} - <em>Now Available!</em></small></span><span class="round go">▶</span></button>`;
  const soonRow = r => `<button class="ar" data-i="${reg(r.x)}">${r.s.img ? `<img src="${esc(r.s.img)}" alt="">` : '<span class="noimg"></span>'}<span class="t"><b>${esc(r.s.name)}</b><small>${esc(epLabel(r.t.next))} - ${esc(day(r.t.nextAt))}</small></span><span class="round">📅</span></button>`;
  const chips = [['All', 'All'], ['Watching', 'Watching'], ['Up Next', 'Up Next'], ['Completed', 'Completed']];
  return `<img class="top50ban" src="banner_mystuff.jpg" alt="My Watchlist and Progress - track what you watch, where you are, and see when new episodes drop"><div class="wh wh-b">
      <div class="whtabs"><button class="wtab ${f === 'Completed' ? '' : 'on'}" data-f="Watching">My Shows</button><button class="wtab" disabled title="Needs the paid feed">Movies</button><button class="wtab ${f === 'Completed' ? 'on' : ''}" data-f="Completed">Completed</button></div></div>
    <div class="wgrid"><div class="wmain"><div class="tiles">
      ${tile('blue', '▶', 'Watching', n('Watching') + (n('Watching') === 1 ? ' Show' : ' Shows'))}${tile('red', '🔔', 'New Episodes', alerts.length + ' Ready to Watch')}${tile('amber', '📅', 'Coming Soon', soon + ' This Week')}${tile('green', '✓', 'Completed', n('Completed') + (n('Completed') === 1 ? ' Show' : ' Shows'))}</div>
      <div class="wlhead"><h2>⏰ Watch Later <small>(${S.later.length})</small></h2></div>${S.later.length ? `${S.later.some(laterFree) ? `<h3 class="wlsub">🆓 Free to Watch <small>(${S.later.filter(laterFree).length})</small></h3>${laterRow(60, true)}` : ''}${S.later.some(l => !laterFree(l)) ? `<h3 class="wlsub">📺 On Your Services <small>(${S.later.filter(l => !laterFree(l)).length})</small></h3>${laterRow(60, false)}` : ''}` : '<p class="fine">Nothing saved yet. Pick anything and tap ⏰ Watch Later. Free movies, free channels and free previews go on their own Free to Watch shelf.</p>'}
      ${cont.length ? `<h2>Continue Watching</h2><div class="posters">${cont.map(poster).join('')}</div>` : ''}
      <div class="wlhead"><h2>My Watchlist <small>(All Shows)</small></h2><div class="filters">${chips.map(([v, l]) => `<button class="chip ${v === f ? 'on' : ''}" data-f="${v}">${l}</button>`).join('')}</div></div>
      <div class="wlbox">${S.list.length ? shown.map(row).join('') || '<p class="fine" style="padding:14px">Nothing here right now.</p>' : '<p class="fine" style="padding:14px">Nothing saved yet. Pick a show in Movies &amp; Shows and tap Save.</p>'}</div></div>
    <aside class="wside"><section class="glow amber"><h3>🔔 New Episode Alerts <span class="badge">${alerts.length}</span></h3>${'Notification' in window && Notification.permission === 'default' ? '<button class="btn alt" data-alerts style="width:100%;margin-bottom:8px">🔔 Notify me when a new episode drops</button>' : ''}${alerts.map(alertRow).join('')}${upcoming.slice(0, Math.max(0, 4 - alerts.length)).map(soonRow).join('')}${alerts.length || upcoming.length ? '' : '<p class="fine">Nothing new yet.</p>'}</section>
      <section class="glow blue"><h3>📅 Upcoming Episodes</h3>${upcoming.length ? upcoming.map(r => `<div class="up"><span><b>${esc(r.s.name)}</b> - ${esc(epLabel(r.t.next))}</span><span>${esc(day(r.t.nextAt))}</span></div>`).join('') : '<p class="fine">No dates announced yet.</p>'}</section>
      ${kidsSection()}${kidsOn() ? '' : `<section class="glow plain">${setupList()}</section><section class="glow plain"><h3>⚙ Your Services</h3><div class="signphone">${signIn()}</div><div class="svcs">${SERVICES.map(s => `<label><input type="checkbox" data-svc="${esc(s)}" ${S.mine.includes(s) ? 'checked' : ''}>${esc(s)}</label>`).join('')}</div></section>`}</aside></div>${credit()}`;
}
async function loadEps() {
  const need = S.list.filter(s => !S.eps[s.id] || !s.genres); if (!need.length) return;
  await Promise.all(need.map(s => fetch(`https://api.tvmaze.com/shows/${s.id}?embed=episodes`).then(r => r.ok ? r.json() : null).then(j => { if (!j) return; S.eps[s.id] = ((j._embedded && j._embedded.episodes) || []).filter(e => e.airstamp); if (j.image && j.image.original) s.img = j.image.original; if (j.genres) s.genres = j.genres; }).catch(() => {})));
  save('list', S.list);
  episodeAlerts();
  if (S.tab === 3 || S.tab === HOME) { const y = window.scrollY; draw(); window.scrollTo(0, y); }
}
function toggleList(s) { if (!s) return; const have = S.list.some(x => x.id === s.id); S.list = have ? S.list.filter(x => x.id !== s.id) : [...S.list, { id: s.id, name: s.name, net: s.net || (s.network && s.network.name) || (s.webChannel && s.webChannel.name) || '', img: s.img || (s.image && s.image.medium) || null, url: s.url, genres: s.genres || [], at: 0 }]; save('list', S.list); loadEps(); }
function step(id, d) { const s = S.list.find(x => x.id === id); if (!s) return; const eps = S.eps[id] || [], max = eps.length;
  const ep = eps[d > 0 ? (s.at || 0) : (s.at || 0) - 1];
  if (ep) { const k = 's' + id + '-' + ep.season + '-' + ep.number; if (d > 0) logWatch({ k, title: s.name, kind: 'Show', ep: 'S' + ep.season + ' E' + ep.number + (ep.name ? ' · ' + ep.name : ''), svc: NETWORK_SERVICE[s.net] || s.net || '', img: s.img || null }); else { S.history = S.history.filter(h => h.k !== k); save('history', S.history); } }
  s.at = Math.max(0, Math.min(max || Infinity, (s.at || 0) + d)); save('list', S.list); }
// Free TV (Scott 11/08): launch buttons only. Their channel schedules need permission before they can appear in the guide.
const FREE_TV = [['Pluto TV', 'https://pluto.tv/'], ['Tubi', 'https://tubitv.com/live'], ['The Roku Channel', 'https://therokuchannel.roku.com/'], ['Plex', 'https://watch.plex.tv/live-tv'], ['Xumo Play', 'https://play.xumo.com/'], ['Samsung TV Plus', 'https://www.samsung.com/us/televisions-home-theater/tvs/tvplus/']];
const freeTv = () => `<h2>Free TV</h2><div class="svcs">${FREE_TV.map(([n, u]) => `<a class="btn alt" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a>`).join('')}</div>`;
// Sign-in buttons (Scott 11/08: "logos need to be cliclable so we can sign in permently"). Each opens the service's OWN sign-in page: the
// service keeps the person signed in on that device. Marvel Magic never sees or stores a password. Plain name tiles until there's permission to use their logos.
const SIGN_IN = [['Netflix', 'https://www.netflix.com/login', '#E50914'], ['Prime Video', 'https://www.amazon.com/gp/video/storefront', '#00739E'], ['Disney+', 'https://www.disneyplus.com/login', '#1B3FA8'], ['Hulu', 'https://auth.hulu.com/web/login', '#128A4E'],
  ['Apple TV', 'https://tv.apple.com/', '#3A3A3C'], ['HBO Max', 'https://auth.hbomax.com/login', '#4B2BD6'], ['Peacock', 'https://www.peacocktv.com/signin', '#26262B'], ['Para- mount+', 'https://www.paramountplus.com/account/signin/', '#0B5FFF'],
  ['Sling TV', 'https://www.sling.com/sign-in', '#1E73E8'], ['YouTube TV', 'https://tv.youtube.com/', '#CC0000'], ['Hulu + Live TV', 'https://auth.hulu.com/web/login', '#0B7A43'], ['Fubo', 'https://www.fubo.tv/signin', '#E3412C'],
  ['Pluto TV', 'https://pluto.tv/', '#7A3FF2'], ['Tubi', 'https://tubitv.com/login', '#E8552B'], ['The Roku Channel', 'https://therokuchannel.roku.com/', '#6C3AA6'], ['Plex', 'https://app.plex.tv/auth', '#B9770E'], ['Xumo Play', 'https://play.xumo.com/', '#0E7C86'], ['Samsung TV Plus', 'https://www.samsung.com/us/televisions-home-theater/tvs/tvplus/', '#1B4FB8']];
const signIn = () => `<p class="fine signhead">Sign in once. Each service keeps you signed in on this device.</p><div class="signgrid">${SIGN_IN.map(([n, u, c]) => `<a href="${esc(u)}" target="_blank" rel="noopener" data-setup="${esc(n.replace('- ', ''))}" style="background:${c}" aria-label="Set up ${esc(n.replace('- ', ''))}">${S.setup.includes(n.replace('- ', '')) ? '<span class="donechk">✓</span>' : ''}${esc(n)}</a>`).join('')}</div>`;
const setupList = () => `<h3>🔑 Set Up Your Accounts</h3><p class="fine">Sign in on each service's own page and let Chrome save the password. Marvel Magic never sees it.</p>${SIGN_IN.map(([raw, u]) => { const n = raw.replace('- ', ''), ok = S.setup.includes(n); return `<div class="setrow"><span>${esc(n)}</span>${ok ? '<b class="ok">✓ Set up</b>' : ''}<a class="btn ${ok ? 'alt' : ''}" href="${esc(u)}" target="_blank" rel="noopener" data-setup="${esc(n)}">${ok ? 'Open' : 'Set up'}</a></div>`; }).join('')}`;
function armFull() { document.title = 'Marvel Magic*'; setTimeout(() => { document.title = 'Marvel Magic'; }, 4000); }   // tells the PC helper a service window is coming: make it full-screen
const FREE_LOOK = { 'Pluto TV': '#7A3FF2', Tubi: '#E8552B', 'The Roku Channel': '#6C3AA6', Plex: '#B9770E', 'Xumo Play': '#0E7C86', 'Samsung TV Plus': '#1B4FB8' };
const pageHero = (cls, kick, title, sub) => `<section class="phero ${cls}"><div class="lk">${kick}</div><h1 class="hott">${title}</h1><p class="lsub2">${sub}</p></section>`;
// FREE TV (Scott 11/14): samples from the free services that match what you like and watch - live now (free_guide.json) + on demand (TMDB)
const LIKE2CAT = { Drama: 'Drama', Comedy: 'Comedy', Crime: 'Crime', Mystery: 'Crime', Thriller: 'Crime', Legal: 'Crime', Action: 'Movies', Adventure: 'Movies', War: 'Movies', Romance: 'Movies', Horror: 'Movies',
  'Science-Fiction': 'Sci-Fi', Fantasy: 'Sci-Fi', Supernatural: 'Sci-Fi', Western: 'Westerns', Family: 'Kids', Children: 'Kids', Anime: 'Kids', Food: 'Food & Home', Travel: 'Food & Home',
  Nature: 'Nature & History', History: 'Nature & History', Music: 'Music', Sports: 'Sports', Reality: 'Reality', Medical: 'Drama' };
const MOOD2CAT = { Funny: 'Comedy', Action: 'Movies', Mystery: 'Crime', Romance: 'Movies', Scary: 'Movies', 'Feel-good': 'Classic TV', 'Family Night': 'Kids', 'True story': 'Nature & History' };
const FREE_OD = ['Tubi', 'Pluto TV', 'Plex', 'The Roku Channel', 'Xumo Play'];
function freePage() {
  loadFreeGuide(); FREE_OD.forEach(n => { loadCat(n, 'movie'); loadCat(n, 'tv'); });
  const now = Date.now(), likes = [...new Set([...S.likes, ...tasteOf()])];
  const wantCats = [...new Set([...likes.map(g => LIKE2CAT[g]), ...S.moods.map(m => MOOD2CAT[m])].filter(Boolean))];
  const seenT = new Set(S.history.map(h => String(h.title || '').toLowerCase()));
  const all = (FREE_G && FREE_G.ch) || [];
  const live = all.filter(r => !kidsOn() || r.g === 'Kids').map(r => ({ r, q: r.s.find(q => q[0] * 1000 <= now && q[1] * 1000 > now) })).filter(x => x.q && x.q[2]);
  const score = x => (wantCats.includes(x.r.g) ? 100 : 0) + (seenT.has(x.q[2].toLowerCase()) ? 250 : 0) + (x.q[5] ? 30 : 0) + x.r.p.length * 5;
  const item = ({ r, q }) => ({ key: 'f' + r.n + q[0], title: q[2], net: r.n, start: q[0] * 1000, end: q[1] * 1000, svc: r.p[0][0], exact: r.p[0][1], options: r.p.map(z => ({ svc: z[0], url: z[1] })), series: false, img: q[5] || '', logo: r.l });
  const card = x => { const it = item(x), left = Math.max(0, Math.round((it.end - now) / 60000)), pct = Math.min(100, Math.round((now - it.start) / (it.end - it.start) * 100));
    return `<div class="pw"><button class="flc${S.sel && S.sel.key === it.key ? ' on' : ''}" data-i="${reg(it)}"><span class="flart">${it.img ? `<img src="${esc(it.img)}" alt="" loading="lazy" onerror="this.remove()">` : ''}${it.logo ? `<img class="fllogo" src="${esc(it.logo)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<span class="flive"><i class="fldot"></i>LIVE · FREE</span></span><span class="flbar"><i style="width:${pct}%"></i></span><span class="flt"><b>${esc(it.title)}</b><small>${esc(x.r.n)} · ${left} min left</small><small class="flsv">${esc(it.svc)}${x.r.p.length > 1 ? ' +' + (x.r.p.length - 1) : ''}</small></span></button>${thumbBtn({ ...it, series: true })}</div>`; };
  const ranked = live.slice().sort((a, b) => score(b) - score(a));
  const used = new Set(), top = ranked.filter(x => x.q[5]).slice(0, 8); top.forEach(x => used.add(x.r.n));
  const catRows = (wantCats.length ? wantCats : ['Movies', 'Comedy', 'Crime']).slice(0, 4).map(c => { const r = ranked.filter(x => x.r.g === c && !used.has(x.r.n)).slice(0, 8); r.forEach(x => used.add(x.r.n)); return [c, r]; }).filter(z => z[1].length);
  const od = mergeByTitle(FREE_OD.flatMap(n => [...((S.cat[n + '|movie|' + (kidsOn() ? 1 : 0)] || {}).items || []), ...((S.cat[n + '|tv|' + (kidsOn() ? 1 : 0)] || {}).items || [])]))
    .map(x => ({ x, sc: (x.genres || []).filter(g => likes.includes(g)).length })).sort((a, b) => b.sc - a.sc).map(z => z.x).filter(x => x.img).slice(0, 12);
  const why = likes.length || S.moods.length ? `Picked from what you like: ${[...likes.slice(0, 4), ...S.moods.slice(0, 2)].map(esc).join(', ')}.` : 'Tick what you like in ⚙ Settings and these get picked for you.';
  return `<img class="top50ban" src="banner_free.jpg" alt="Free TV - Free Right Now: free channels and movies, no subscription required"><p class="fine" style="margin:0 0 6px">${(all.length || 1500).toLocaleString()} free channels and thousands of free movies. ${why}</p>
    ${!all.length ? '<p class="fine" style="margin-top:16px">Loading free channels…</p>' : ''}
    ${top.length ? `<div class="hh" style="margin-top:18px"><h2>Free &amp; Live Now, Picked for You</h2><button class="more" data-tab="0">Full guide ›</button></div><div class="flgrid">${top.map(card).join('')}</div>` : ''}
    ${catRows.map(([c, r]) => `<div class="hh" style="margin-top:20px"><h2>Free ${esc(c)} On Now</h2></div><div class="flgrid">${r.map(card).join('')}</div>`).join('')}
    ${od.length ? `<div class="hh" style="margin-top:22px"><h2>Free Movies &amp; Shows for You <small class="fine">watch anytime</small></h2></div><div class="lgrid six">${od.map(x => lposter(x)).join('')}</div>` : ''}
    <div class="frsv"><b>Free services:</b>${FREE_TV.map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener" data-free="${esc(n)}">${esc(n)} ↗</a>`).join('')}</div>
    <p class="fine">Live schedules: community guide data (test build). Movies: <a href="https://www.themoviedb.org/" target="_blank" rel="noopener">TMDB</a>.</p>`;
}
function watchedPage() {
  const now = Date.now(), week = now - 7 * 86400000, H = S.history, n = f => H.filter(f).length, f = S.wf || 'All', shown = H.filter(h => f === 'All' || h.kind === f).slice(0, 300);
  const by = {}; for (const h of H) if (h.svc) by[h.svc] = (by[h.svc] || 0) + 1;
  const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 8), maxS = Math.max(1, ...top.map(t => t[1]));
  const label = t => { const d = new Date(t), today = dayKey(now), y = dayKey(now - 86400000); return dayKey(t) === today ? 'Today' : dayKey(t) === y ? 'Yesterday' : d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }); };
  let last = '', rows = '';
  for (const h of shown) { const l = label(h.at); if (l !== last) { rows += `<h2>${esc(l)}</h2>`; last = l; }
    rows += `<div class="rrow">${h.img ? `<img src="${esc(h.img)}" alt="">` : '<span class="noimg"></span>'}<span class="t"><b>${esc(h.title)}</b><small>${esc([h.ep, h.kind, h.svc, clock(new Date(h.at))].filter(Boolean).join(' · '))}</small></span><button class="round" data-unwatch="${esc(h.k)}" aria-label="Remove from tracker">✕</button></div>`; }
  const tile = (cls, big, small) => `<div class="tile ${cls}"><span><small>${small}</small><b>${big}</b></span></div>`;
  return `<img class="top50ban" src="banner_watched.jpg" alt="Watched - My Watch History: every show, movie and game you opened or marked watched"><div class="tiles" style="margin-top:18px">${tile('blue', H.length, 'All Time')}${tile('green', n(h => h.at > week), 'This Week')}${tile('amber', n(h => h.kind === 'Show'), 'Episodes')}${tile('red', n(h => h.kind === 'Movie') + ' / ' + n(h => h.kind === 'Sports'), 'Movies / Games')}</div>
    <div class="wgrid"><div class="wmain"><div class="filters" style="margin-top:16px">${[['All', 'All'], ['Show', 'Shows'], ['Movie', 'Movies'], ['Sports', 'Sports']].map(([v, l]) => `<button class="chip ${f === v ? 'on' : ''}" data-wf="${v}">${l}</button>`).join('')}</div>${rows || '<p class="fine">Nothing yet. Open a movie or game, or mark an episode watched, and it shows up here.</p>'}</div>
    <aside class="wside" style="margin-top:16px"><section class="glow plain"><h3>Most Watched On</h3>${top.length ? top.map(([n, c]) => `<div class="prog" style="margin-bottom:10px"><span>${esc(n)}: ${c}</span><div class="bar"><i style="width:${Math.round(c / maxS * 100)}%"></i></div></div>`).join('') : '<p class="fine">No services yet.</p>'}</section></aside></div>
    <p class="fine">Streaming services don't share what you watch, so this tracks what you open or mark here. Tap ✕ to remove anything you didn't actually watch.</p>`;
}
function rankedSvcs() {
  const have = S.mine.length ? S.mine.filter(n => SERVICE_URL[n]) : S.setup.filter(n => SERVICE_URL[n]), all = [...new Set([...S.rank, ...have, ...FREE_SVC])];
  return all.filter(n => have.includes(n) || FREE_SVC.has(n));
}
// MY TOP 50 (Scott 11/14): the person puts their rated titles in their own order (▲▼), can share the list (public link), browses other viewers'
// shared lists, and a list earns a point each time someone opens a title from it. Shared lists live in Firestore toplists/{uid}.
function topKeys() {
  const keys = Object.keys(S.ratings), inOrder = S.order.filter(k => S.ratings[k]);
  const rest = keys.filter(k => !inOrder.includes(k)).sort((a, b) => S.ratings[b].score - S.ratings[a].score || S.ratings[b].at - S.ratings[a].at);
  return [...inOrder, ...rest];
}
// Scott 11/14 "ranking on movies and another list on shows": two lists, each in its own order
const kindOf = r => r.kind === 'Show' ? 'Show' : 'Movie';
const topKeysK = kd => topKeys().filter(k => kindOf(S.ratings[k]) === kd);
function moveTop(k, d) {
  const full = topKeys(), kd = kindOf(S.ratings[k]), sub = full.filter(x => kindOf(S.ratings[x]) === kd), i = sub.indexOf(k), j = i + d;
  if (i < 0 || j < 0 || j >= sub.length) return; [sub[i], sub[j]] = [sub[j], sub[i]];
  let n = 0; S.order = full.map(x => kindOf(S.ratings[x]) === kd ? sub[n++] : x); save('order', S.order); shareRefresh();
}
const listItems = () => ['Movie', 'Show'].flatMap(kd => topKeysK(kd).slice(0, 50)).map(k => { const r = S.ratings[k]; return { k, title: r.title, img: r.img || null, kind: kindOf(r), score: r.score }; });
let shareTimer = null;
function shareRefresh() { if (!S.shared || !me || !db) return; clearTimeout(shareTimer); shareTimer = setTimeout(publishList, 1500); }
function publishList() {
  if (!me || !db) return Promise.reject('signin');
  return db.collection('toplists').doc(me.uid).set({ name: firstName() || 'Marvel Magic viewer', items: listItems(), svcRate: S.svcRate, at: firebase.firestore.FieldValue.serverTimestamp(), score: firebase.firestore.FieldValue.increment(0) }, { merge: true });
}
const listLink = uid => location.origin + location.pathname + '#list=' + uid;
function loadLists() {
  if (!db || S.lists) return; S.lists = [];
  db.collection('toplists').orderBy('score', 'desc').limit(60).get().then(q => { S.lists = q.docs.map(d => ({ id: d.id, ...d.data() })); if (S.tab === 5) { const y = window.scrollY; draw(); window.scrollTo(0, y); } }).catch(() => { S.lists = null; S.listsErr = true; });
}
function openList(uid) {
  if (!db) { S.viewList = { id: uid, loading: true }; return; }
  S.viewList = { id: uid, loading: true };
  db.collection('toplists').doc(uid).get().then(d => { S.viewList = d.exists ? { id: uid, ...d.data() } : { id: uid, missing: true }; draw(); window.scrollTo(0, 0); }).catch(() => { S.viewList = { id: uid, missing: true }; draw(); });
}
function scoreList(uid, item) {   // someone opened a title from another viewer's list -> that list earns a point
  if (!db || !uid || (me && me.uid === uid)) return;
  db.collection('toplists').doc(uid).update({ score: firebase.firestore.FieldValue.increment(1) }).catch(() => {});
}
// PROFILES (Scott 11/14): a managed profile (no email) is used on a shared TV - tap the picture. Its shows, ratings, likes and Watch Later are
// its own. While one is active the account sync pauses (the owner's cloud copy is never overwritten); switching back saves it and syncs.
// A TV remembers its profile (prof is saved on the device) and can be locked to it - switching then needs the household PIN.
const PERSONAL = ['list', 'ratings', 'history', 'likes', 'moods', 'later', 'order', 'teams', 'actors'];
const PDEF = { list: [], ratings: {}, history: [], likes: [], moods: [], later: [], order: [], teams: [], actors: [] };
const pick = () => Object.fromEntries(PERSONAL.map(k => [k, S[k]]));
const houseMember = id => ((S.house && S.house.members) || []).find(m => m.id === id) || null;
const myMember = () => S.houseRole === 'member' && me && ((S.house && S.house.members) || []).find(m => m.email && m.email === String(me.email || '').toLowerCase()) || null;
const activeEasy = () => { const m = S.prof ? houseMember(S.prof) : S.paired ? houseMember(S.paired.pid) : myMember(); return !!(m && m.easy); };
const profName = () => { const m = S.prof ? houseMember(S.prof) : S.paired ? houseMember(S.paired.pid) : myMember(); return m ? m.name : (S.paired && S.paired.name) || firstName() || 'Me'; };
function switchProfile(id) {
  if ((S.prof || null) === (id || null)) return;
  S.profiles[S.prof || '__me'] = pick();
  const next = id ? (S.profiles[id] || PDEF) : (S.profiles.__me || PDEF);
  for (const k of PERSONAL) { S[k] = JSON.parse(JSON.stringify(next[k] !== undefined ? next[k] : PDEF[k])); try { localStorage.setItem('mm_' + k, JSON.stringify(S[k])); } catch {} }
  if (!id) delete S.profiles.__me;
  S.prof = id || null; save('prof', S.prof); save('profiles', S.profiles);
  S.eps = {}; S.sel = null;
  const m = id && houseMember(id);
  if (m && m.type === 'Kid') { S.kidName = m.name; S.kids = { ...S.kids, on: true }; save('kids', S.kids); }
  if (!id) { lastCloud = ''; queueSync(); }
  showTab(HOME); loadEps(); loadTeamGames();
}
function withPin(msg, then) { if (!S.profLock) return then(); pinBox(msg, v => { if (v !== S.kids.pin) return false; S.profLock = false; save('profLock', false); then(); }); }
function easyHome() {
  return `${!S.paired && S.pairCode ? pairPanel() : ''}<div class="ezhead"><h1>Hi ${esc(profName())} 👋</h1><span class="hclock" id="hclock">${esc(clock(new Date()))}</span></div>
    <div class="ezgrid"><button class="ez" data-tab="0"><span>📺</span><b>Live TV</b></button><button class="ez" data-tab="4"><span>🆓</span><b>Free TV</b></button><button class="ez" data-tab="3"><span>⭐</span><b>My Shows</b></button><button class="ez" data-tab="2"><span>🏈</span><b>Sports</b></button></div>
    ${S.later.length ? `<h2 class="ezh2">⏰ Saved for Later</h2>${laterRow(6)}` : ''}
    ${S.profLock || !S.prof ? '' : `<button class="ez back" data-whome>↩ Back to ${esc(firstName() || 'the main')} profile</button>`}`;
}
// TV CODE (Scott 11/14): pair a TV to a household profile without a sign-in
let stopPair = null;
async function startPair() {
  if (!auth || !db) return;
  try {
    if (!me) await auth.signInAnonymously();
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await db.collection('pair').doc(code).set({ anon: auth.currentUser.uid, at: firebase.firestore.FieldValue.serverTimestamp(), status: 'waiting' });
    S.pairCode = code; draw();
    if (stopPair) stopPair();
    stopPair = db.collection('pair').doc(code).onSnapshot(d => {
      const x = d.data(); if (!x || x.status !== 'approved') return;
      S.paired = { hid: x.hid, pid: x.pid, name: x.pname || '' }; save('paired', S.paired); S.pairCode = null;
      stopPair(); stopPair = null; db.collection('pair').doc(code).delete().catch(() => {});
      loadDevice();
    }, () => {});
  } catch (e) { S.pairErr = true; draw(); }
}
function loadDevice() {
  if (!db || !S.paired || !me) return;
  const H = db.collection('households').doc(S.paired.hid);
  H.get().then(d => {
    if (!d.exists || !(d.data().devices || {})[me.uid]) { S.paired = null; save('paired', null); S.house = null; S.houseRole = null; draw(); return; }   // removed by the owner
    S.house = { id: d.id, ...d.data() }; S.houseRole = 'device';
    if ((S.house.services || []).length) { S.mine = [...new Set([...S.mine, ...S.house.services])]; save('mine', S.mine); }
    if (S.house.kidsPin) { S.kids = { ...S.kids, pin: S.house.kidsPin }; }
    const m = houseMember(S.paired.pid); if (m && m.type === 'Kid') S.kids = { ...S.kids, on: true };
    save('kids', S.kids);
    return H.collection('profiles').doc(S.paired.pid).get().then(pd => { if (pd.exists) { const c = pd.data(); for (const k of PERSONAL) if (c[k] !== undefined) { S[k] = c[k]; try { localStorage.setItem('mm_' + k, JSON.stringify(c[k])); } catch {} } } draw(); loadEps(); });
  }).catch(() => draw());
}
async function approvePair(code, pid) {
  const d = await db.collection('pair').doc(code).get();
  if (!d.exists) throw new Error('That code isn’t showing on any TV. Check the number on the TV.');
  const x = d.data(), m = houseMember(pid);
  if (x.at && Date.now() - x.at.toMillis() > 20 * 60000) throw new Error('That code is too old. Press "Show a new code" on the TV.');
  S.house.devices = { ...(S.house.devices || {}), [x.anon]: pid };
  await db.collection('households').doc(me.uid).set({ devices: S.house.devices }, { merge: true });
  if (pid === 'owner') await db.collection('households').doc(me.uid).collection('profiles').doc('owner').set({ ...pick(), at: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });   // the TV starts with my lists
  await db.collection('pair').doc(code).update({ status: 'approved', hid: me.uid, pid, pname: m ? m.name : (firstName() || 'Me') });
}
const pairPanel = () => S.pairCode ? `<section class="pairbox"><div class="lk">📺 SET UP THIS TV</div><div class="pairrow"><div id="pairqr" class="pairqr"></div><div><div class="paircode">${S.pairCode.slice(0, 3)} ${S.pairCode.slice(3)}</div><p><b>Point your phone's camera at the square</b> and tap the link,</p><p>or open Marvel Magic → ⚙ Settings → 🏠 My Household → Add a TV and type the code.</p></div></div><p class="fine">This screen sets itself up as soon as you approve it.</p></section>`
  : `<button class="pairask" data-paircode><span>📺</span><span class="t"><b>Setting this up for someone else's TV?</b><small>Show a code and approve it from your phone - nothing to sign in to here.</small></span><span class="fbgo">Show a TV code ›</span></button>`;
// QR + LINK APPROVAL (Scott 11/14): the TV's QR opens #pair=<code> on the phone; signed in as the owner, one tap adds the TV
function drawPairQr() {
  const el = document.getElementById('pairqr'); if (!el || !S.pairCode || typeof QRCode === 'undefined' || el.dataset.code === S.pairCode) return;
  el.innerHTML = ''; el.dataset.code = S.pairCode;
  new QRCode(el, { text: location.origin + location.pathname + '#pair=' + S.pairCode, width: 220, height: 220, colorDark: '#0B1020', colorLight: '#ffffff' });
}
let linkPair = (location.hash.match(/^#pair=(\d{6})$/) || [])[1] || null;
function maybeApproveFromLink() {
  if (!linkPair || inTvApp() || S.paired) return;
  const b = $('back'); if (b.open) return;
  if (!me || me.isAnonymous) { b.innerHTML = `<b>📺 Add a TV</b><p>Sign in first, then this TV is added with one tap.</p><div class="act"><button class="btn" data-pairsignin>Sign in with Google</button></div>`; b.querySelector('[data-pairsignin]').onclick = () => { b.close(); acctPress(); }; b.showModal(); return; }
  if (S.houseRole !== 'owner') { if (!S.house && S.houseRole === null && !S.houseErr) return; b.innerHTML = `<b>📺 Add a TV</b><p>${S.house ? 'Only the household owner can add a TV.' : 'Make your household first: Settings → 🏠 My Household → Create my household.'}</p><div class="act"><button class="btn" data-px>OK</button></div>`; b.querySelector('[data-px]').onclick = () => { b.close(); linkPair = null; history.replaceState(history.state, '', location.pathname); showTab(10); }; b.showModal(); return; }
  const code = linkPair, opts = [['owner', 'Me (' + (S.house.ownerName || firstName() || 'owner') + ')'], ...((S.house.members || []).map(m => [m.id, m.name]))];
  b.innerHTML = `<b>📺 Add this TV</b><p>Code ${code.slice(0, 3)} ${code.slice(3)}. Who watches on it?</p><div class="pairpick">${opts.map(([id, n]) => `<button class="btn ${id === 'owner' ? '' : 'alt'}" data-pp="${esc(id)}">${esc(n)}</button>`).join('')}</div><div class="act"><button class="btn alt" data-px>Cancel</button></div>`;
  b.querySelectorAll('[data-pp]').forEach(x => x.onclick = () => { b.close(); approvePair(code, x.dataset.pp).then(() => { alert('Done! The TV changes by itself in a moment.'); draw(); }).catch(err => alert(err.message || 'Could not add that TV.')); linkPair = null; history.replaceState(history.state, '', location.pathname); });
  b.querySelector('[data-px]').onclick = () => { b.close(); linkPair = null; history.replaceState(history.state, '', location.pathname); };
  b.showModal();
}
addEventListener('hashchange', () => { const m = location.hash.match(/^#pair=(\d{6})$/); if (m) { linkPair = m[1]; maybeApproveFromLink(); } });
// SIGN A TV IN (Scott 11/14): each service's own "activate with a code" page - the TV app shows the code, the phone (already signed in) enters it
const ACTIVATE = { Netflix: 'https://www.netflix.com/tv8', Hulu: 'https://www.hulu.com/activate', 'Hulu + Live TV': 'https://www.hulu.com/activate', 'Disney+': 'https://www.disneyplus.com/begin',
  'Prime Video': 'https://www.amazon.com/mytv', 'HBO Max': 'https://www.hbomax.com/tvsignin', Peacock: 'https://www.peacocktv.com/tv', 'Paramount+': 'https://www.paramountplus.com/activate/',
  'Sling Orange': 'https://www.sling.com/activate', 'Sling Blue': 'https://www.sling.com/activate', 'YouTube TV': 'https://tv.youtube.com/start', ESPN: 'https://www.espn.com/watch/activate',
  'Apple TV': 'https://activate.apple.com', Tubi: 'https://tubitv.com/activate', Plex: 'https://plex.tv/link', Fubo: 'https://www.fubo.tv/connect', 'DirecTV Stream': 'https://stream.directv.com/activate', 'Fox One': 'https://www.fox.com/activate' };
const signSvcs = () => [...new Set(S.mine.filter(n => ACTIVATE[n] && !(n === 'Sling Blue' && S.mine.includes('Sling Orange'))))];
function signTvBox() {
  const list = signSvcs(); if (!list.length) return '';
  if (inTvApp() || S.paired) return `<section class="glow amber stbox"><h3>📺 Sign this TV in to your services</h3><p class="fine">One time, no passwords here. Tap a service: its app opens and shows a short code. On your phone open Marvel Magic → ⚙ Settings → <b>Sign a TV in</b>, tap the same service and type the code.</p><div class="tvsign">${list.map(n => `<button class="btn alt" data-tvsignin="${esc(n)}">▶ ${esc(n.startsWith('Sling') ? 'Sling TV' : n)}</button>`).join('')}</div></section>`;
  return `<section class="glow plain stbox stwide"><h3>📺 Sign a TV in to your services</h3><p class="fine">On the TV, open the service's app: it shows a short code. Tap the same service here (you're already signed in on this phone) and type that code. No passwords on the TV.</p><div class="tvsign">${list.map(n => `<a class="btn alt" href="${esc(ACTIVATE[n])}" target="_blank" rel="noopener" data-activate>${esc(n.startsWith('Sling') ? 'Sling TV' : n)} ↗</a>`).join('')}</div></section>`;
}
// HOUSEHOLD (Scott 11/14): "how many accounts ... owner can assign emails with profiles ... keep groups together but also replace people"
const HOUSE_MAX = 6;   // owner + 5 (Netflix 5, Disney+ 7)
// OWNER MIRROR (Scott 11/14 "this one is my tv"): keeps households/{me}/profiles/owner in step with my own lists for a TV set up as me
let mirrorTimer = null;
function pushOwnerMirror() {
  if (!me || !db || me.isAnonymous || S.prof || S.houseRole !== 'owner' || !Object.values((S.house && S.house.devices) || {}).includes('owner')) return;
  clearTimeout(mirrorTimer);
  mirrorTimer = setTimeout(() => db.collection('households').doc(me.uid).collection('profiles').doc('owner').set({ ...pick(), at: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {}), 1500);
}
function pullOwnerMirror() {
  if (!me || !db || me.isAnonymous || S.houseRole !== 'owner') return;
  db.collection('households').doc(me.uid).collection('profiles').doc('owner').get().then(d => {
    if (!d.exists) return; const c = d.data(); let ch = false;
    for (const [k, r] of Object.entries(c.ratings || {})) if (!S.ratings[k] || (r.at || 0) > (S.ratings[k].at || 0)) { S.ratings[k] = r; ch = true; }
    const lk = new Set(S.later.map(l => l.k)); for (const l of (c.later || [])) if (!lk.has(l.k)) { S.later.push(l); ch = true; }
    const hk = new Set(S.history.map(h => h.k)); for (const h of (c.history || [])) if (!hk.has(h.k)) { S.history.push(h); ch = true; }
    if (c.list && c.list.length) { const before = JSON.stringify(S.list); S.list = mergeLists(c.list, S.list); if (JSON.stringify(S.list) !== before) ch = true; }
    for (const k of ['likes', 'moods', 'actors']) { const u = [...new Set([...(S[k] || []), ...(c[k] || [])])]; if (u.length !== (S[k] || []).length) { S[k] = u; ch = true; } }
    if (ch) { S.history.sort((a, b) => b.at - a.at); storeLocal(); queueSync(); draw(); }
  }).catch(() => {});
}
function loadHouse() {
  if (!me || !db) { S.house = null; S.houseRole = null; return; }
  const email = String(me.email || '').toLowerCase();
  db.collection('households').doc(me.uid).get().then(d => {
    if (d.exists) { S.house = { id: d.id, ...d.data() }; S.houseRole = 'owner'; return afterHouse(); }
    if (!email) return;
    return db.collection('households').where('memberEmails', 'array-contains', email).limit(1).get().then(q => {
      if (q.empty) { S.house = null; S.houseRole = null; } else { const h = q.docs[0]; S.house = { id: h.id, ...h.data() }; S.houseRole = 'member'; }
      afterHouse();
    });
  }).catch(() => { S.houseErr = true; draw(); });
}
function afterHouse() {
  const h = S.house;
  if (S.houseRole === 'owner') pullOwnerMirror();
  if (h && S.houseRole === 'member' && (h.services || []).length) { S.mine = [...new Set([...S.mine, ...h.services])]; save('mine', S.mine); }   // the household's services
  if (h && h.kidsPin && !S.kids.pin) { S.kids = { ...S.kids, pin: h.kidsPin }; save('kids', S.kids); }
  draw();
}
function saveHouse(patch) {
  if (!me || !db || S.houseRole !== 'owner') return Promise.reject('owner');
  const h = { ...S.house, ...patch }; h.memberEmails = (h.members || []).map(m => String(m.email || '').toLowerCase()).filter(Boolean);
  S.house = h;
  return db.collection('households').doc(me.uid).set({ owner: me.uid, ownerEmail: String(me.email || '').toLowerCase(), ownerName: firstName() || 'Owner', name: h.name || ((firstName() || 'My') + '’s household'), members: h.members || [], memberEmails: h.memberEmails, services: S.mine, kidsPin: S.kids.pin || '', devices: h.devices || {}, at: firebase.firestore.FieldValue.serverTimestamp() });
}
function houseBox() {
  const h = S.house, role = S.houseRole;
  if (!me) return `<p class="fine">Sign in with Google to make a household (up to ${HOUSE_MAX} people, one $4.99).</p><button class="btn" data-acct2>Sign in with Google</button>`;
  if (S.houseErr) return '<p class="fine">Households switch on once the database allows them.</p>';
  if (!h) return `<p class="fine">One membership for the whole home: up to ${HOUSE_MAX} people. You add them by email; each signs in on their own phone or TV with that email and joins. Kids need no email.</p><button class="btn gold" data-mkhouse>Create my household</button>`;
  const people = [{ name: (h.ownerName || 'Owner') + (role === 'owner' ? ' (you)' : ''), email: h.ownerEmail, type: 'Owner' }, ...(h.members || [])];
  const row = (m, i) => `<div class="hhrow"><span class="av hhav ${m.type === 'Kid' ? 'kid' : ''}">${esc((m.name || '?')[0].toUpperCase())}</span><span class="t"><b>${esc(m.name || '')}</b><small>${esc(m.type)}${m.email ? ' · ' + esc(m.email) : i > 0 ? ' · watches on this TV, no sign-in' : ''}${m.easy ? ' · Easy Mode' : ''}${me && m.email && m.email === String(me.email || '').toLowerCase() && role === 'member' ? ' · you' : ''}</small></span>${role === 'owner' && i > 0 ? `<button class="pill" data-mmeasy="${esc(m.id)}">${m.easy ? 'Easy Mode on' : 'Easy Mode'}</button>` : ''}${role === 'owner' && i > 0 ? `<button class="round" data-rmmember="${esc(m.id)}" aria-label="Remove ${esc(m.name)}">✕</button>` : ''}</div>`;
  const full = people.length >= HOUSE_MAX;
  return `<p class="fine" style="margin:0 0 8px">${esc(h.name || 'Household')} · ${people.length} of ${HOUSE_MAX} people${role === 'member' ? ' · managed by ' + esc(h.ownerName || 'the owner') : ''}</p>${people.map(row).join('')}
    ${role === 'owner' ? `<div class="tvadd"><h4>📺 TVs and computers set up for someone</h4>${Object.entries(h.devices || {}).map(([u, pid]) => `<div class="hhrow"><span class="t"><b>A TV for ${esc(pid === 'owner' ? 'me' : (houseMember(pid) || {}).name || 'someone')}</b><small>signs in with no password</small></span><button class="round" data-rmdevice="${esc(u)}" aria-label="Remove this TV">✕</button></div>`).join('')}
      <form id="pairform" class="hhadd"><input id="pcode" inputmode="numeric" maxlength="7" placeholder="Code on the TV" aria-label="Code shown on the TV" required><select id="pprof" aria-label="Who uses that TV"><option value="owner">Me (${esc(h.ownerName || firstName() || 'owner')})</option>${(h.members || []).map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('')}</select><button class="btn">Add a TV</button></form></div>` : ''}
    ${role === 'owner' ? (full ? '<p class="fine">Household is full. Remove someone to add someone new.</p>' : `<form id="addmember" class="hhadd"><input id="mmname" maxlength="30" placeholder="Name" aria-label="Name" required><input id="mmemail" type="email" maxlength="80" placeholder="Email (leave blank if they only watch on this TV)" aria-label="Email"><select id="mmtype" aria-label="Type"><option>Adult</option><option>Teen</option><option>Kid</option></select><label class="stck" style="min-height:44px"><input type="checkbox" id="mmeasy"><span>Easy Mode</span></label><button class="btn">Add</button></form>`) + '<p class="fine">They sign in to Marvel Magic with that email and join automatically. Removing someone takes them out right away; their own ratings and history stay theirs.</p>' : ''}`;
}
const houseKids = () => ((S.house && S.house.members) || []).filter(m => m.type === 'Kid' || !m.email);   // every profile that lives on this TV
// MARVEL MAGIC TOP 50 (Scott 11/14 "be marvelMagic top 50"): one chart from every shared list - a title earns more the higher people rank it,
// how many lists it's on, and how much those lists get watched from
function mmTop50() {
  const pts = {};
  const kd = S.rkind || 'Movie';
  for (const l of (S.lists || [])) (l.items || []).filter(it => (it.kind === 'Show' ? 'Show' : 'Movie') === kd).forEach((it, i) => { const k = String(it.title || '').toLowerCase(); if (!k) return; const e = pts[k] || (pts[k] = { title: it.title, img: it.img, kind: it.kind, pts: 0, lists: 0, sum: 0 }); e.pts += (51 - i) * (1 + Math.min(l.score || 0, 100) / 50); e.lists += 1; e.sum += (it.score > 5 ? it.score / 2 : it.score) || 0; if (!e.img && it.img) e.img = it.img; });
  return Object.values(pts).sort((a, b) => b.pts - a.pts).slice(0, 50);
}
// SERVICE QUALITY (Scott 11/14): hearts for each service's content + the average of your own title ratings on it
const titleAvg = n => { const r = Object.values(S.ratings).filter(x => x.svc === n); return r.length ? { avg: r.reduce((a, x) => a + x.score, 0) / r.length, n: r.length } : null; };
function svcRateBox(n) {
  const b = $('back'); if (b.open) b.close();
  const cur = S.svcRate[n] || 0;
  b.innerHTML = `<b>How good is ${esc(n)}'s content?</b><div class="hearts">${[1, 2, 3, 4, 5].map(h => `<button class="${h <= cur ? 'on' : ''}" data-h="${h}" aria-label="${h} of 5 hearts">${h <= cur ? '♥' : '♡'}</button>`).join('')}</div><p class="fine">${cur ? fmtH(cur) + ' of 5.0' : 'Tap a heart'}</p><div class="act">${cur ? '<button class="btn alt" data-hclear>Clear</button>' : ''}<button class="btn alt" data-hx>Close</button></div>`;
  const set = h => { if (h) S.svcRate[n] = h; else delete S.svcRate[n]; save('svcRate', S.svcRate); if (typeof shareRefresh === 'function') shareRefresh(); b.close(); const y = window.scrollY; draw(); window.scrollTo(0, y); };
  b.querySelectorAll('[data-h]').forEach(x => x.onclick = () => set(Number(x.dataset.h)));
  const c = b.querySelector('[data-hclear]'); if (c) c.onclick = () => set(0);
  b.querySelector('[data-hx]').onclick = () => b.close();
  b.showModal(); (b.querySelector('[data-h]') || b).focus();
}
function bestServices() {
  const t = {};
  for (const l of (S.lists || [])) for (const [n, h] of Object.entries(l.svcRate || {})) { const e = t[n] || (t[n] = { n, sum: 0, c: 0 }); e.sum += h; e.c += 1; }
  return Object.values(t).map(e => ({ ...e, avg: e.sum / e.c })).sort((a, b) => b.avg - a.avg || b.c - a.c);
}
function ratingsPage() {
  if (db) loadLists();
  const KD = S.rkind || 'Movie', keys = topKeysK(KD), top = keys.slice(0, 50), more = keys.slice(50), KW = KD === 'Show' ? 'Shows' : 'Movies';
  const rrow = (k, i) => { const r = S.ratings[k]; return `<div class="trow"><span class="rnum">${i + 1}</span>${r.img ? `<img src="${esc(r.img)}" alt="" loading="lazy">` : '<span class="noimg"></span>'}<span class="t"><b>${esc(r.title)}</b><small>${esc(r.kind || '')}${r.review ? ' · “' + esc(r.review) + '”' : ''}</small></span><span class="rscore">♥ ${fmtH(r.score)}<small>/5</small></span>
    <button class="round" data-tmv="${esc(k)}|-1" aria-label="Move ${esc(r.title)} up" ${i ? '' : 'disabled'}>▲</button><button class="round" data-tmv="${esc(k)}|1" aria-label="Move ${esc(r.title)} down" ${i < keys.length - 1 ? '' : 'disabled'}>▼</button><button class="round" data-unrate="${esc(k)}" aria-label="Remove ${esc(r.title)}">✕</button></div>`; };
  const v = S.viewList;
  const kchips = `<div class="filters" style="margin:12px 0 0"><button class="chip ${KD === 'Movie' ? 'on' : ''}" data-rkind="Movie">🎬 Movies</button><button class="chip ${KD === 'Show' ? 'on' : ''}" data-rkind="Show">📺 Shows</button></div>`;
  if (v) {   // viewing someone's shared list
    const its = (v.items || []).filter(it => (it.kind === 'Show' ? 'Show' : 'Movie') === KD);
    return `${pageHero('prate', '🏆 TOP LIST', v.loading ? 'Loading list…' : v.missing ? 'List not found' : esc(v.name || 'Viewer') + '’s Top ' + its.length + ' ' + KW, v.loading || v.missing ? '' : `⭐ ${v.score || 0} points · each time someone watches from this list it earns a point.`)}
      <div style="margin-top:14px"><button class="pill" data-closelist>‹ Back to my Top 50</button></div>${kchips}
      <div class="tlist" style="margin-top:12px">${its.map((it, i) => { const x = { key: 'L' + v.id + i, title: it.title, img: it.img, series: it.kind === 'Show', fromList: v.id, url: 'https://www.google.com/search?q=' + encodeURIComponent(it.title + ' watch') }; return `<button class="trow tpick${S.sel && S.sel.key === x.key ? ' on' : ''}" data-i="${reg(x)}"><span class="rnum">${i + 1}</span>${it.img ? `<img src="${esc(it.img)}" alt="" loading="lazy">` : '<span class="noimg"></span>'}<span class="t"><b>${esc(it.title)}</b><small>${esc(it.kind || '')}</small></span><span class="rscore">♥ ${fmtH(it.score > 5 ? it.score / 2 : it.score)}<small>/5</small></span><span class="pill">Watch ›</span></button>`; }).join('')}</div>`;
  }
  const lists = S.lists || [];
  const shareBox = `<section class="glow amber"><h3>🔗 Share My Top 50</h3>${!me ? '<p class="fine">Sign in with Google to share your list.</p><button class="btn" data-acct2>Sign in with Google</button>' : S.shared ? `<p class="fine">✓ Shared. It updates when you change it. People who watch from it give it points.</p><div class="where"><span>Link:</span><a href="${esc(listLink(me.uid))}" target="_blank" rel="noopener">${esc(listLink(me.uid))}</a></div><div class="act" style="display:flex;gap:8px;margin-top:8px"><button class="btn" data-copylist>Copy link</button><button class="btn alt" data-unshare>Stop sharing</button></div>` : `<p class="fine">Publish your list so friends and other Marvel Magic viewers can watch from it.</p><button class="btn gold" data-sharelist ${top.length ? '' : 'disabled'}>Share my list</button>`}</section>`;
  const listsBox = `<section class="glow plain"><h3>🏆 Top Lists from Viewers</h3>${!db ? '<p class="fine">Loading…</p>' : S.listsErr ? '<p class="fine">Shared lists switch on once the database allows them.</p>' : lists.length ? lists.map((l, i) => `<button class="tlc" data-openlist="${esc(l.id)}"><span class="rnum">${i + 1}</span><span class="tlimgs">${(l.items || []).slice(0, 3).map(it => it.img ? `<img src="${esc(it.img)}" alt="" loading="lazy">` : '').join('')}</span><span class="t"><b>${esc(l.name || 'Viewer')}${me && l.id === me.uid ? ' (you)' : ''}</b><small>Top ${(l.items || []).length} · ⭐ ${l.score || 0} points</small></span></button>`).join('') : '<p class="fine">No shared lists yet. Be the first.</p>'}</section>`;
  const svcs = rankedSvcs().sort((a, b) => (S.opens[b] || 0) - (S.opens[a] || 0)), maxOpen = Math.max(1, ...svcs.map(n => S.opens[n] || 0));   // Scott 11/14: always by use, best to worst
  const svc = (n, i) => `<div class="rrow"><span class="rnum">${i + 1}</span><span class="t"><b>${esc(n)}</b>${titleAvg(n) ? `<small class="tavg">your ${titleAvg(n).n} rated title${titleAvg(n).n === 1 ? "" : "s"}: ♥ ${fmtH(titleAvg(n).avg)}</small>` : ""}<small>Opened ${S.opens[n] || 0} time${S.opens[n] === 1 ? '' : 's'}${FREE_SVC.has(n) ? ' · Free' : S.lastOpen[n] ? ' · last ' + (Math.floor((Date.now() - S.lastOpen[n]) / DAY) ? Math.floor((Date.now() - S.lastOpen[n]) / DAY) + ' days ago' : 'today') : ' · not used yet'}</small><div class="bar"><i style="width:${Math.round((S.opens[n] || 0) / maxOpen * 100)}%"></i></div></span><button class="thumb ${S.svcRate[n] ? 'on' : ''}" data-svcrate="${esc(n)}" aria-label="Rate ${esc(n)}">${S.svcRate[n] ? '♥ ' + fmtH(S.svcRate[n]) : '♡'}</button></div>`;
  const mmTab = S.rtab === 'mm', chart = mmTop50();
  const tabs = `<div class="whtabs" style="margin:16px 0 4px"><button class="wtab ${mmTab ? '' : 'on'}" data-rtab="me">⭐ My Top 50</button><button class="wtab ${mmTab ? 'on' : ''}" data-rtab="mm">🏆 Marvel Magic Top 50</button></div>${kchips}`;
  const best = bestServices();
  const bestHtml = best.length ? `<section class="glow amber"><h3>🏆 Marvel Magic Best Services</h3><p class="fine">Content quality, from every viewer who shared a list.</p>${best.map((e, i) => `<div class="rrow"><span class="rnum">${i + 1}</span><span class="t"><b>${esc(e.n)}</b><small>${e.c} rating${e.c === 1 ? '' : 's'}</small></span><span class="rscore">♥ ${fmtH(e.avg)}<small>/5</small></span></div>`).join('')}</section>` : '';
  const chartHtml = !db || S.lists === null ? '<p class="fine">Loading…</p>' : S.listsErr ? '<div class="hbox" style="padding:16px"><p class="fine" style="margin:0">The Marvel Magic Top 50 switches on once the database allows shared lists.</p></div>' : chart.length ? `<div class="tlist">${chart.map((c, i) => { const x = { key: 'MM' + i, title: c.title, img: c.img, series: c.kind === 'Show', url: 'https://www.google.com/search?q=' + encodeURIComponent(c.title + ' watch') }; return `<button class="trow tpick${S.sel && S.sel.key === x.key ? ' on' : ''}" data-i="${reg(x)}"><span class="rnum">${i + 1}</span>${c.img ? `<img src="${esc(c.img)}" alt="" loading="lazy">` : '<span class="noimg"></span>'}<span class="t"><b>${esc(c.title)}</b><small>On ${c.lists} list${c.lists === 1 ? '' : 's'} · avg ♥ ${fmtH(c.sum / c.lists)}/5</small></span><span class="pill">Watch ›</span></button>`; }).join('')}</div>` : '<div class="hbox" style="padding:16px"><p class="fine" style="margin:0">No shared lists yet. Share yours and it starts the chart.</p></div>';
  return `${mmTab ? `<img class="top50ban" src="banner_top50.jpg" alt="Marvel Magic Top 50 - the most watched, trending now">` : ''}${mmTab ? `<p class="fine" style="margin:0">The ${KW.toLowerCase()} chart from every viewer’s shared list: ranked high, on many lists, and watched from.</p>` : `<img class="top50ban" src="${KW === 'Movies' ? 'banner_mytop50.jpg' : 'banner_mytop50_shows.jpg'}" alt="My Ratings - My Top 50 ${KW}"><p class="fine" style="margin:0 0 6px">Put what you’ve rated in your own order: what ranks above what. Share it if you want.</p>`}${tabs}
    <div class="wgrid" style="margin-top:12px"><div class="wmain">${mmTab ? chartHtml : top.length ? `<div class="tlist">${top.map(rrow).join('')}</div>` : '<div class="hbox" style="padding:18px"><p style="margin:0 0 10px">No ' + KW.toLowerCase() + ' rated yet.</p><p class="fine" style="margin:0 0 12px">Tap 👍 on any show or movie and give it 1 to 5 hearts. It lands here and you can move it up or down.</p><button class="btn gold" data-tab="1">Find something to rate</button></div>'}
      ${!mmTab && more.length ? `<h2>Also Rated</h2><div class="tlist">${more.map((k, i) => rrow(k, i + 50)).join('')}</div>` : ''}</div>
    <aside class="wside">${mmTab ? bestHtml : ''}${shareBox}${listsBox}<section class="glow plain svcq"><h3>My Streaming Services</h3><p class="fine">Ranked by how much you use them, best to worst. Tap ♡ to rate each one's content.</p>${svcs.map(svc).join('')}</section></aside></div>`;
}
// HOME (Scott 11/14 board): everything on it is real data - his watchlist, tonight's listings, his teams' next game. No made-up titles or people.
