/* catalogs.js
   Save to: C:\MarvelApps\marvelmagic\js\catalogs.js
   FULL MOVIE LISTS (Scott 11/16: "what about all movie listings?" -> "Yes, every 2 weeks"; grew out of Free on YouTube, 11/15 "we also
   get all free movie you tube"). Every movie on 14 services, most popular first:
     paid  Netflix, Prime Video, HBO Max, Hulu, Paramount+, Disney+, Peacock, Apple TV  - catalogs/<slug>.json (+ _top.json)
     free  Tubi, The Roku Channel, Pluto TV, Freevee, Plex                              - catalogs/<slug>.json (+ _top.json)
           YouTube                                                                      - youtube_free.json (+ _top.json)
   The _top files (300 with posters + a summary) fill the shelves; the full files load for See all and for search.
   Built by tools/build_catalogs.py (1st + 15th) and tools/build_youtube_free.py (weekly): Watchmode listings, TMDB posters.
   Where they show: Movies & Shows > On Your Services > Movies (that service's full list, See all), the Free on YouTube shelf
   (Movies & Shows + Free TV), Free TV's "Every free movie" buttons, and Movies & Shows search (every list the person can watch).
   A tap asks the relay for that movie's own page on THAT service (core.js enrich, x.pref); if the lookup fails it opens the
   service's search for the title. Paid lists show only services the person ticked; free ones show for everyone (core.js FREE_WEB).
   Kids Lock: only TMDB Family movies that aren't Horror, Thriller, Crime or War. After editing run  python tools\stamp_versions.py  */
const ML_FILES = { YouTube: ['youtube_free_top.json', 'youtube_free.json'], Netflix: 'netflix', 'Prime Video': 'prime', 'HBO Max': 'hbomax', Hulu: 'hulu',
  'Paramount+': 'paramount', 'Disney+': 'disney', Peacock: 'peacock', 'Apple TV': 'appletv', Tubi: 'tubi', 'The Roku Channel': 'roku', 'Pluto TV': 'pluto', Freevee: 'freevee', Plex: 'plex' };
const ML_FREE = ['YouTube', 'Tubi', 'The Roku Channel', 'Pluto TV', 'Freevee', 'Plex'];
const mlHas = svc => !!ML_FILES[svc];
const mlFile = (svc, all) => { const f = ML_FILES[svc]; return Array.isArray(f) ? f[all ? 1 : 0] : 'catalogs/' + f + (all ? '' : '_top') + '.json'; };
const ML = {};   // 'svc|top' or 'svc|all' -> { busy } | { items, count } | { error }
let ML_INDEX = null;
const ML_IMG = p => p ? 'https://image.tmdb.org/t/p/w342' + p : null;
const ML_NOKID = [27, 53, 80, 10752];
const ytSearch = (t, y) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(t + (y ? ' ' + y : '') + ' full movie');
const mlFreeSvc = svc => ML_FREE.includes(svc);
// YouTube rows: [wm, title, year, tmdb, poster, genres, summary, minutes]; the other lists: [wm, title, year, poster, genres, minutes, summary?]
function mlItem(svc, r) {
  const yt = svc === 'YouTube', o = yt ? { wm: r[0], t: r[1], y: r[2], p: r[4], g: r[5], s: r[6], m: r[7] } : { wm: r[0], t: r[1], y: r[2], p: r[3], g: r[4], m: r[5], s: r[6] };
  const g = o.g || [];
  return { key: 'c' + o.wm, wmId: o.wm, pref: svc, yt, title: o.t, year: o.y, svc, series: false,
    note: [o.y || '', o.m ? Math.floor(o.m / 60) + 'h ' + (o.m % 60) + 'm' : '', (mlFreeSvc(svc) ? 'Free on ' : 'On ') + svc].filter(Boolean).join(' · '),
    img: ML_IMG(o.p), big: ML_IMG(o.p), sum: o.s || '', genres: g.map(x => TMDB_G[x]).filter(Boolean), gids: g,
    kid: g.includes(10751) && !g.some(x => ML_NOKID.includes(x)),
    url: yt ? ytSearch(o.t, o.y) : svc === 'Freevee' ? 'https://www.amazon.com/gp/video/search?phrase=' + encodeURIComponent(o.t) : '' };
}
const mlRedraw = () => { if (S.tab === 1 || S.tab === 4) { const y = window.scrollY; draw(); window.scrollTo(0, y); } };
function mlLoad(svc, all) {
  const k = svc + (all ? '|all' : '|top'); if (ML[k] || !mlHas(svc)) return;
  ML[k] = { busy: true };
  fetch(mlFile(svc, all) + '?v=' + Math.floor(Date.now() / 86400000)).then(r => r.json())
    .then(j => { ML[k] = { items: (j.m || []).map(r => mlItem(svc, r)), count: j.count || (j.m || []).length }; })
    .catch(() => { ML[k] = { error: 1 }; }).then(mlRedraw);
}
function mlLoadIndex() {
  if (ML_INDEX) return; ML_INDEX = { busy: true };
  fetch('catalogs/index.json?v=' + Math.floor(Date.now() / 86400000)).then(r => r.json()).then(j => { ML_INDEX = j; }).catch(() => { ML_INDEX = { error: 1 }; }).then(mlRedraw);
}
const mlCount = svc => { const t = ML[svc + '|all'] || ML[svc + '|top']; if (t && t.count) return t.count; const s = ML_INDEX && ML_INDEX.services && ML_INDEX.services[svc]; return s ? s.count : 0; };
const mlCountText = svc => { const n = mlCount(svc); return n ? n.toLocaleString() + ' movies' : 'every movie'; };
const mlAllBtn = (svc, label) => `<button class="more" data-mlall="${esc(svc)}">${label || 'See all ›'}</button>`;
// one service's most popular posters (On Your Services, the YouTube shelf)
function mlGrid(svc, n) {
  mlLoad(svc, false);
  const c = ML[svc + '|top'] || { busy: true };
  if (c.error) return '<p class="fine">Couldn’t load this list right now. Try again in a bit.</p>';
  const list = (c.items || []).filter(kidOk).slice(0, n);
  return list.length ? `<div class="lgrid six">${list.map(x => lposter(x)).join('')}</div>` : `<p class="fine">${c.busy ? 'Loading…' : 'Nothing here with Kids Lock on.'}</p>`;
}
// On Your Services > Movies: the service's full list instead of a sample (guide.js catSection)
const mlBlock = svc => `<div class="hh" style="margin-top:6px"><p class="fine" style="margin:0">${esc(mlCountText(svc))} on ${esc(svc)}, most popular first.</p>${mlAllBtn(svc, 'See all ' + esc(mlCountText(svc)) + ' ›')}</div>${mlGrid(svc, 18)}`;
// the Free on YouTube shelf (Movies & Shows, Free TV)
function mlShelf(svc, n) {
  const c = ML[svc + '|top']; if (c && c.error) return '';
  const grid = mlGrid(svc, n);
  return `<div class="hh" style="margin-top:22px"><h2>▶ Free on ${esc(svc)} <small class="fine">${esc(mlCountText(svc))} · free with ads</small></h2>${mlAllBtn(svc)}</div>` + grid;
}
// Free TV: a button for every free service's full movie list
function mlFreeChips() {
  mlLoadIndex();
  return `<div class="hh" style="margin-top:22px"><h2>Every Free Movie <small class="fine">free with ads, no subscription</small></h2></div>
    <div class="filters">${ML_FREE.map(s => `<button class="chip" data-mlall="${esc(s)}">${esc(s)} · ${esc(mlCountText(s))} ›</button>`).join('')}</div>`;
}
// Movies & Shows search: every list this person can watch, one poster per movie (its other services ride along as options)
function mlFound(q) {
  q = String(q || '').trim().toLowerCase(); if (!q) return '';
  const svcs = Object.keys(ML_FILES).filter(s => hasIt(s));
  svcs.forEach(s => mlLoad(s, true));
  const busy = svcs.some(s => (ML[s + '|all'] || {}).busy);
  const by = new Map();
  for (const s of svcs) for (const x of ((ML[s + '|all'] || {}).items || [])) {
    if (!x.title.toLowerCase().includes(q) || !kidOk(x)) continue;
    const h = by.get(x.wmId);
    if (!h) by.set(x.wmId, { ...x, options: [{ svc: s, url: '' }] });
    else if (!h.options.some(o => o.svc === s)) { h.options.push({ svc: s, url: '' }); h.pref = null; h.yt = false; h.note = [h.year || '', h.options.length + ' services'].filter(Boolean).join(' · '); }
  }
  const hits = [...by.values()].slice(0, 24);
  if (!hits.length) return busy ? '<h3 class="lsub">Watch Now</h3><p class="fine">Searching every movie list…</p>' : '';
  return `<h3 class="lsub">Watch Now <small class="fine">on your services and free</small></h3><div class="lgrid">${hits.map(x => lposter(x)).join('')}</div>${busy ? '<p class="fine">Still searching…</p>' : ''}`;
}
// SEE ALL: one service's whole list, a search box, genre chips, 60 at a time
const ML_GENRES = [[0, 'All'], [28, 'Action'], [35, 'Comedy'], [18, 'Drama'], [53, 'Thriller'], [27, 'Horror'], [10749, 'Romance'], [878, 'Sci-Fi'], [16, 'Animation'], [10751, 'Family'], [80, 'Crime'], [99, 'Documentary'], [37, 'Western'], [10752, 'War']];
function mlAllPage(svc) {
  mlLoad(svc, true);
  const c = ML[svc + '|all'] || { busy: true }, g = S.mlG || 0, q = String(S.mlQ || '').trim().toLowerCase(), free = mlFreeSvc(svc);
  const list = (c.items || []).filter(kidOk).filter(x => !g || x.gids.includes(g)).filter(x => !q || x.title.toLowerCase().includes(q));
  const n = S.mlN || 60;
  const body = c.error ? '<p class="fine">Couldn’t load this movie list right now. Try again in a bit.</p>' : c.busy ? '<p class="fine">Loading every movie…</p>'
    : list.length ? `<div class="lgrid six">${list.slice(0, n).map(x => lposter(x)).join('')}</div>${list.length > n ? `<button class="btn alt" data-mlmore style="margin:18px auto 0;display:block">Show more (${(list.length - n).toLocaleString()} left)</button>` : ''}`
    : '<p class="fine">No movie matches that.</p>';
  const lead = svc === 'YouTube' ? `${esc(mlCountText(svc))} free to watch on YouTube, most popular first. Free with ads, no sign-up.`
    : free ? `${esc(mlCountText(svc))} free on ${esc(svc)}, most popular first. Free with ads.` : `${esc(mlCountText(svc))} on ${esc(svc)}, most popular first.`;
  return `<div class="hh"><button class="more" data-mlback>‹ Movies &amp; Shows</button></div>
    <h1>${free ? '▶ Free on ' : '🎬 Movies on '}${esc(svc)}</h1><p class="fine" style="margin-top:-4px">${lead} Pick one, then ▶ to open it on ${esc(svc === 'Freevee' ? 'Prime Video' : svc)}.</p>
    <form class="search" id="mlfind" style="margin:12px 0"><input id="mlq" aria-label="Search the ${esc(svc)} movies" placeholder="Search ${esc(svc)} movies" value="${esc(S.mlQ || '')}"><button class="btn">Search</button></form>
    <div class="filters" style="margin-bottom:12px">${ML_GENRES.filter(([id]) => !kidsOn() || [0, 16, 10751].includes(id)).map(([id, name]) => `<button class="chip ${g === id ? 'on' : ''}" data-mlg="${id}">${esc(name)}</button>`).join('')}</div>
    ${body}<p class="fine" style="margin-top:18px">Listings: Watchmode. Posters: <a href="https://www.themoviedb.org/" target="_blank" rel="noopener">TMDB</a>. This product uses the TMDB API but is not endorsed or certified by TMDB.</p>`;
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('button[data-tab]'); if (b) S.mlAll = null; }, true);   // a menu / tab button leaves See all (body carries data-tab too)
document.addEventListener('click', e => {
  const t = e.target.closest('[data-mlall],[data-mlg],[data-mlmore],[data-mlback]'); if (!t) return;
  if (t.dataset.mlall != null) { S.mlAll = t.dataset.mlall; S.mlN = 60; S.mlG = 0; S.mlQ = ''; S.sel = null; if (S.tab !== 1) { history.pushState({ tab: 1 }, ''); showTab(1); } else { draw(); } window.scrollTo(0, 0); return; }
  if (t.hasAttribute('data-mlback')) { S.mlAll = null; S.sel = null; draw(); window.scrollTo(0, 0); return; }
  if (t.dataset.mlg != null) { S.mlG = Number(t.dataset.mlg); S.mlN = 60; const y = window.scrollY; draw(); window.scrollTo(0, y); return; }
  if (t.hasAttribute('data-mlmore')) { S.mlN = (S.mlN || 60) + 60; const y = window.scrollY; draw(); window.scrollTo(0, y); }
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'mlfind') return;
  e.preventDefault(); S.mlQ = ($('mlq').value || '').trim().slice(0, 80); S.mlN = 60; draw();
});
