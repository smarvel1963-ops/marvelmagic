// phonehome.js | Save to: C:\MarvelApps\marvelmagic\js\phonehome.js
// PHONE HOME DECK (Scott's design, emailed 11/25 "Marvel magic", built 11/27 "work on marvel magic"): on a phone the Home page opens with
// the hub-style top - banner (logo, mascot, tagline), a row of big icon tiles, a search bar, the Top Pick, My Streaming Services,
// three boxes (Live TV Guide / Live Sports Center / My Watchlist) and a row of category tiles. The rest of Home follows underneath.
// PC / TV keep the approved wide Home (docs\marvelmagic_redesign_2026-11-14\05). CSS hides .pdeck above 760 px; .hero is hidden below it.
// Every tile goes to a page that exists; nothing here plays video (Watch opens the real service, as everywhere else).
const PD_TOP = [['🏠', 'Home', HOME], ['📺', 'Live TV Guide', 0], ['🎬', 'Movies', 11], ['📡', 'TV Shows', 1], ['🏈', 'Sports', 2],
  ['❤️', 'My Watchlist', 3], ['⭐', 'Top 50', 5, 'p50'], ['🆓', 'Free TV', 4], ['⚙️', 'Settings', 10]];
const PD_CATS = [['🔥', 'Coming Soon', 8, 'c1'], ['✨', 'For You', 9, 'c2'], ['⭐', 'Top 50', 5, 'c3', 'p50'], ['🎞️', 'Browse Movies', 11, 'c4'],
  ['🆓', 'Free TV', 4, 'c5'], ['👍', 'My Ratings', 5, 'c6', 'mine'], ['🕘', 'Watched', 6, 'c7'], ['📌', 'My Stuff', 3, 'c8']];
const PD_FREE = ['Tubi', 'The Roku Channel', 'Pluto TV', 'Plex'];
const PD_LEAGUE = { NFL: '🏈', NBA: '🏀', MLB: '⚾', NHL: '🏒', NCAAF: '🏈', NCAAB: '🏀', WNBA: '🏀', MLS: '⚽' };
let PD_PICK = 0;

function pdSvcItem(n) { return { key: 'svc:' + n, title: n, svc: n, url: SERVICE_URL[n] ? SERVICE_URL[n]('') : '', note: n }; }
function pdSvcBtn(n) { return `<button class="pdsvc" data-i="${reg(pdSvcItem(n))}" data-go>${esc(n)}</button>`; }

function phoneDeck() {
  const kids = kidsOn(), now = Date.now();
  const logo = (document.querySelector('header .logo') || {}).src || 'logo.png';
  const top = PD_TOP.filter(t => !(kids && (t[2] === 2 || t[2] === 10))).map(([ic, name, tab, flag]) =>
    `<button class="pdt${S.tab === tab && tab === HOME ? ' on' : ''}" data-tab="${tab}"${flag ? ` data-${flag}` : ''}><i>${ic}</i><span>${esc(name)}</span></button>`).join('');
  // Top Pick: tonight's best match on your services (same list as Find Tonight's Pick), arrows step through the first 6
  const picks = tonightPicks().filter(kidOk).slice(0, 6), p = picks.length ? picks[PD_PICK % picks.length] : null;
  const pick = p ? `<div class="pdpick" style="background-image:url('${esc(p.big)}')"><span class="pdtag">TOP PICK</span>
      <div class="pdpin"><b>${esc(p.title)}</b><small>${esc(p.note || '')}</small><button class="btn gold" data-i="${reg(p)}">▶ Watch Now</button></div>
      ${picks.length > 1 ? `<button class="pdar l" data-pdpick="-1" aria-label="Previous pick">‹</button><button class="pdar r" data-pdpick="1" aria-label="Next pick">›</button>
      <span class="pddots">${picks.map((_, i) => `<i class="${i === PD_PICK % picks.length ? 'on' : ''}"></i>`).join('')}</span>` : ''}</div>`
    : `<div class="pdpick pdempty"><span class="pdtag">TOP PICK</span><div class="pdpin"><b>Finding tonight's pick…</b><small>Tick your services in Settings and picks fill in.</small></div></div>`;
  const paid = S.mine.filter(n => !FREE_SVC.has(n));
  const svcs = `<section class="pdbox pdsvcs"><div class="pdh"><b>My Streaming Services</b><button class="pdgear" data-tab="10" aria-label="Pick my services">⚙</button></div>
      <div class="pdsg">${paid.length ? paid.slice(0, 8).map(pdSvcBtn).join('') : '<button class="pill" data-tab="10">Pick my services</button>'}</div>
      <p class="pdfree">▸ FREE TV &amp; MOVIES ◂</p><div class="pdsg">${PD_FREE.map(pdSvcBtn).join('')}</div></section>`;
  // Live TV Guide: next 4 on channels you can watch
  const canSee = n => !S.mine.length || !!livePkgFor(n) || S.mine.includes(NETWORK_SERVICE[n]);
  const seen = new Set(), on = S.airings.filter(a => a.end > now && canSee(a.net) && kidOk(a) && !seen.has(a.net) && seen.add(a.net)).sort((a, b) => a.start - b.start).slice(0, 4);
  const guide = `<section class="pdbox"><div class="pdh"><b><span class="pdlive">LIVE</span> Live TV Guide</b></div>
      ${on.length ? on.map(a => `<button class="pdrow" data-i="${reg(a)}"><span class="pdnet">${esc(a.net)}</span><span class="pdt2">${esc(a.title)}</span><small>${a.start <= now ? '<em>● LIVE</em>' : esc(clock(new Date(a.start)))}</small></button>`).join('')
        : `<p class="fine">${S.airings.length ? 'Nothing on your channels right now.' : 'Loading the guide…'}</p>`}
      <button class="pdgo" data-tab="0">Open Full TV Guide »</button></section>`;
  const live = S.games.filter(g => g.state === 'in').length, left = S.games.filter(g => g.state !== 'post').length;
  const lg = [...new Set(S.games.map(g => g.league))].filter(l => PD_LEAGUE[l]).slice(0, 6);
  const sports = kids ? '' : `<section class="pdbox pdsport"><div class="pdh"><b>🏆 Live Sports Center</b></div>
      <div class="pdlg">${(lg.length ? lg : ['NFL', 'NBA', 'NHL', 'MLB']).map(l => `<span><i>${PD_LEAGUE[l]}</i>${esc(l)}</span>`).join('')}</div>
      <p class="fine">${S.gamesDone ? (left ? `${live ? live + ' live now · ' : ''}${left} game${left === 1 ? '' : 's'} today` : 'No more games today') : 'Loading games…'}</p>
      <button class="pdgo red" data-tab="2">Today's Games &amp; Channels »</button></section>`;
  const wl = S.list.filter(s => kidOk({ genres: s.genres || [], net: s.net })).slice(0, 4).map(s => ({ key: 's' + s.id, title: s.name, svc: NETWORK_SERVICE[s.net] || null, url: s.url, note: s.net, series: true, img: s.img, show: s }));
  const watch = `<section class="pdbox"><div class="pdh"><b>❤️ My Watchlist</b></div>
      ${wl.length ? wl.map(x => `<button class="pdrow pdwl" data-i="${reg(x)}">${x.img ? `<img src="${esc(x.img)}" alt="" loading="lazy">` : '<span class="pdnoimg">📺</span>'}<span class="pdt2">${esc(x.title)}</span><span class="pdplay">▶</span></button>`).join('')
        : '<p class="fine">Save a show in Movies &amp; Shows and it shows up here.</p>'}
      <button class="pdgo" data-tab="3">My Stuff »</button></section>`;
  const cats = PD_CATS.filter(c => !(kids && c[2] === 10)).map(([ic, name, tab, col, flag]) =>
    `<button class="pdc ${col}" data-tab="${tab}"${flag ? ` data-${flag}` : ''}><i>${ic}</i><span>${esc(name)}</span></button>`).join('');
  return `<div class="pdeck"><div class="pdban"><img class="pdmas" src="img/tipster/thumbs.webp" alt=""><div class="pdbrand"><img src="${logo}" alt="Marvel Magic"><small>by Marvel Corp</small><em>Your All-in-One Streaming &amp; Live TV Guide</em><small class="pdver">${esc(typeof mmVer === 'function' ? mmVer() : '')}</small></div></div>
    <div class="pdtiles">${top}</div>
    <div class="pdsearch"><button class="pdq" data-tab="1" data-q>🔍 Find a movie, show, game or channel…</button><button class="pdwhere" data-pick>✨ Tonight's Pick</button></div>
    <div class="pdmid">${pick}${svcs}</div>
    <div class="pd3">${guide}${sports}${watch}</div>
    <div class="pdcats">${cats}</div></div>`;
}

// Top 50 tiles open the Marvel Magic Top 50 chart; My Ratings opens your own list. Runs before the page's own click handler (capture).
document.addEventListener('click', e => {
  const t = e.target.closest && e.target.closest('button'); if (!t) return;
  if (t.hasAttribute('data-p50')) S.rtab = 'mm';
  else if (t.hasAttribute('data-mine')) S.rtab = 'me';
  else if (t.dataset.pdpick) { e.stopPropagation(); PD_PICK = Math.max(0, PD_PICK + 6 + Number(t.dataset.pdpick)); const y = window.scrollY; draw(); window.scrollTo(0, y); }
}, true);
