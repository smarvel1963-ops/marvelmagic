/* browse.js
   Save to: C:\MarvelApps\marvelmagic\js\browse.js
   BROWSE MOVIES + FREE TONIGHT (Scott 11/16: "Yes, build both", from the "premium streaming service" plan he pasted).
   One card per movie across all 14 movie lists (43,716 different movies, not 89,616 listings): catalogs/browse_top.json (3,000 most
   popular) shows at once while catalogs/browse.json (all) loads. Each movie carries a bit per service it's on (catalogs.js ML_FILES
   names, order in browse.json "services"; the first 6 are free). Filters: service, Free / My services, genre, decade, length,
   rating; sort Popular / Top rated / Newest / Recently added (once a refresh has dated new arrivals). Watch free first: the card
   opens on a free service when there is one, then a service you have. Kids Lock = TMDB Family minus Horror / Thriller / Crime / War.
   FREE TONIGHT (Home): 12 of the best free movies (catalogs/free_tonight.json: free somewhere, TMDB 6.5+ with 300+ votes),
   a different 12 each day. Built by tools/build_catalogs.py. After editing run  python tools\stamp_versions.py  */
const BROWSE = 11;   // tab number (core.js TABS)
let BW_TOP = null, BW_ALL = null, BW_FT = null, BW_SVCS = ['YouTube', 'Tubi', 'The Roku Channel', 'Pluto TV', 'Freevee', 'Plex', 'Netflix', 'Prime Video', 'HBO Max', 'Hulu', 'Paramount+', 'Disney+', 'Peacock', 'Apple TV'];
const BW_FREE_MASK = 63;
const bwState = () => (S.bw = S.bw || { svc: '', price: 'all', g: 0, dec: 0, len: 0, rate: 0, sort: 'pop', q: '', n: 60 });
const mlUrl = (svc, title, year) => svc === 'YouTube' ? ytSearch(title, year) : svc === 'Freevee' ? 'https://www.amazon.com/gp/video/search?phrase=' + encodeURIComponent(title)
  : SERVICE_URL[svc] ? SERVICE_URL[svc](slug(title)) : 'https://www.google.com/search?q=' + encodeURIComponent(title + ' watch');
// a browse row -> a movie card: free services first, then services you have, then the rest (Watch free first)
function bwItem(r) {
  // browse rows: [wm, title, year, poster, genres, minutes, bits, popularity, rating, votes, added, tmdb]; free_tonight rows end with the summary instead
  const [wm, t, y, p, g, m, bits, , rating, votes] = r, ft = r.length === 11, added = ft ? '' : (r[10] || ''), sum = ft ? (r[10] || '') : '';
  const on = BW_SVCS.filter((s, i) => bits & (1 << i));
  const free = on.filter(s => mlFreeSvc(s)), mine = on.filter(s => !mlFreeSvc(s) && S.mine.includes(s)), rest = on.filter(s => !free.includes(s) && !mine.includes(s));
  const order = [...free, ...mine, ...rest], first = order.find(s => hasIt(s)) || order[0];
  const gg = g || [];
  return { key: 'c' + wm, wmId: wm, pref: first, yt: first === 'YouTube', title: t, year: y, svc: first, series: false,
    note: [y || '', m ? (m >= 60 ? Math.floor(m / 60) + 'h ' : '') + (m % 60) + 'm' : '', rating && votes >= 50 ? '★ ' + rating : '', (free.length ? 'Free on ' : 'On ') + first + (order.length > 1 ? ' +' + (order.length - 1) : '')].filter(Boolean).join(' · '),
    img: ML_IMG(p), big: ML_IMG(p), sum, genres: gg.map(x => TMDB_G[x]).filter(Boolean), gids: gg,
    kid: gg.includes(10751) && !gg.some(x => ML_NOKID.includes(x)), rating, votes, mins: m, bits, free: free.length > 0, added,
    options: order.map(s => ({ svc: s, url: mlUrl(s, t, y) })), url: mlUrl(first, t, y) };
}
const bwRedraw = () => { if (S.tab === BROWSE || S.tab === HOME) { const y = window.scrollY; draw(); window.scrollTo(0, y); } };
function bwLoad(which) {
  const f = which === 'top' ? 'catalogs/browse_top.json' : which === 'all' ? 'catalogs/browse.json' : 'catalogs/free_tonight.json';
  const cur = which === 'top' ? BW_TOP : which === 'all' ? BW_ALL : BW_FT; if (cur) return;
  const set = v => { if (which === 'top') BW_TOP = v; else if (which === 'all') BW_ALL = v; else BW_FT = v; };
  set({ busy: true });
  fetch(f + '?v=' + Math.floor(Date.now() / 86400000)).then(r => r.json())
    .then(j => { if (Array.isArray(j.services)) BW_SVCS = j.services; set({ items: (j.m || []).map(bwItem), count: j.count || (j.m || []).length }); })
    .catch(() => set({ error: 1 })).then(bwRedraw);
}
const BW_DEC = [[0, 'Any year'], [2020, '2020s'], [2010, '2010s'], [2000, '2000s'], [1990, '1990s'], [1980, '1980s'], [1970, '1970s'], [1, 'Older']];
const BW_LEN = [[0, 'Any length'], [1, 'Under 90 min'], [2, '90 min - 2 hrs'], [3, 'Over 2 hrs']];
const BW_RATE = [[0, 'Any rating'], [7, '★ 7+'], [8, '★ 8+']];
const BW_SORT = [['pop', 'Popular'], ['rate', 'Top rated'], ['year', 'Newest'], ['new', 'Recently added']];
function bwFilter(list, st) {
  const si = st.svc ? BW_SVCS.indexOf(st.svc) : -1, mineMask = BW_SVCS.reduce((a, s, i) => S.mine.includes(s) ? a | (1 << i) : a, 0), q = String(st.q || '').trim().toLowerCase();
  return list.filter(x => kidOk(x)
    && (si < 0 || (x.bits & (1 << si)))
    && (st.price === 'all' || (st.price === 'free' ? (x.bits & BW_FREE_MASK) : (x.bits & (mineMask | BW_FREE_MASK))))
    && (!st.g || x.gids.includes(st.g))
    && (!st.dec || (st.dec === 1 ? x.year && x.year < 1970 : x.year >= st.dec && x.year < st.dec + 10))
    && (!st.len || (st.len === 1 ? x.mins && x.mins < 90 : st.len === 2 ? x.mins >= 90 && x.mins <= 120 : x.mins > 120))
    && (!st.rate || (x.rating >= st.rate && x.votes >= 50))
    && (!q || x.title.toLowerCase().includes(q)));
}
function bwSort(list, sort) {
  if (sort === 'rate') return list.slice().sort((a, b) => (b.votes >= 200) - (a.votes >= 200) || b.rating - a.rating);
  if (sort === 'year') return list.slice().sort((a, b) => (b.year || 0) - (a.year || 0));
  if (sort === 'new') return list.slice().sort((a, b) => String(b.added || '').localeCompare(String(a.added || '')));
  return list;   // the files come most popular first
}
const bwChips = (key, opts, cur) => opts.map(([v, name]) => `<button class="chip ${String(cur) === String(v) ? 'on' : ''}" data-bwk="${key}" data-bwv="${esc(String(v))}">${esc(name)}</button>`).join('');
function browsePage() {
  const st = bwState();
  bwLoad('top'); if (BW_TOP && BW_TOP.items) bwLoad('all');   // the 3,000 most popular first, then everything
  const src = (BW_ALL && BW_ALL.items) || (BW_TOP && BW_TOP.items) || [], total = (BW_ALL && BW_ALL.count) || (BW_TOP && BW_TOP.count) || 0;
  const partial = !(BW_ALL && BW_ALL.items) && src.length > 0;
  const list = bwSort(bwFilter(src, st), st.sort), dated = src.some(x => x.added);
  const svcOpts = [['', 'All services'], ...BW_SVCS.filter(s => !S.mine.length || mlFreeSvc(s) || S.mine.includes(s)).map(s => [s, s + (mlFreeSvc(s) ? ' · Free' : '')])];
  const body = (BW_TOP && BW_TOP.error && !src.length) ? '<p class="fine">Couldn’t load the movie list right now. Try again in a bit.</p>' : !src.length ? '<p class="fine">Loading every movie…</p>'
    : list.length ? `<div class="lgrid six">${list.slice(0, st.n).map(x => lposter(x)).join('')}</div>${list.length > st.n ? `<button class="btn alt" data-bwmore style="margin:18px auto 0;display:block">Show more (${(list.length - st.n).toLocaleString()} left)</button>` : ''}`
    : '<p class="fine">No movie matches all of that. Try fewer filters.</p>';
  return `${pageHero('pwatch', '🎬 EXPLORE MOVIES', 'Browse Movies', `${total ? total.toLocaleString() : 'Every'} movies across 14 services, one card each. Free ones open free first.`)}
    <form class="search" id="bwfind" style="margin:16px 0 10px"><input id="bwq" aria-label="Search every movie" placeholder="Search every movie" value="${esc(st.q || '')}"><button class="btn">Search</button></form>
    <div class="filters">${bwChips('price', [['all', 'All'], ['free', '✨ Free'], ['mine', 'Free + my services']], st.price)}</div>
    <div class="filters" style="margin-top:6px">${bwChips('svc', svcOpts, st.svc)}</div>
    <div class="filters" style="margin-top:6px">${bwChips('g', ML_GENRES.filter(([id]) => !kidsOn() || [0, 16, 10751].includes(id)), st.g)}</div>
    <div class="filters" style="margin-top:6px">${bwChips('dec', BW_DEC, st.dec)}${bwChips('len', BW_LEN, st.len)}${bwChips('rate', BW_RATE, st.rate)}</div>
    <div class="hh" style="margin-top:12px"><p class="fine" style="margin:0"><b>${list.length.toLocaleString()}</b> movies match${partial ? ' (still loading the rest…)' : ''}</p><div class="filters">${bwChips('sort', BW_SORT.filter(([k]) => k !== 'new' || dated), st.sort)}</div></div>
    ${body}<p class="fine" style="margin-top:18px">Listings: Watchmode. Posters and ratings: <a href="https://www.themoviedb.org/" target="_blank" rel="noopener">TMDB</a>. This product uses the TMDB API but is not endorsed or certified by TMDB. Availability changes; the service has the final word.</p>`;
}
// FREE TONIGHT on Home: a different 12 of the best free movies each day
function freeTonight() {
  bwLoad('ft');
  const c = BW_FT || { busy: true };
  if (c.error) return '';
  const all = (c.items || []).filter(kidOk);
  const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000), n = 12;
  const start = all.length > n ? (day * n) % all.length : 0, pick = all.length ? [...all, ...all].slice(start, start + Math.min(n, all.length)) : [];
  return `<section><div class="hh" style="margin-top:22px"><h2>🌙 Free Tonight <small class="fine">great movies, no subscription</small></h2><button class="more" data-bwfree>All free movies ›</button></div>
    ${pick.length ? `<div class="lgrid six">${pick.map(x => lposter(x)).join('')}</div>` : `<p class="fine">${c.busy ? 'Loading tonight’s free movies…' : 'Nothing here with Kids Lock on.'}</p>`}</section>`;
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-bwk],[data-bwmore],[data-bwfree]'); if (!t) return;
  const st = bwState();
  if (t.hasAttribute('data-bwfree')) { Object.assign(st, { price: 'free', svc: '', g: 0, dec: 0, len: 0, rate: 0, sort: 'pop', q: '', n: 60 }); history.pushState({ tab: BROWSE }, ''); showTab(BROWSE); return; }
  if (t.hasAttribute('data-bwmore')) { st.n += 60; const y = window.scrollY; draw(); window.scrollTo(0, y); return; }
  const k = t.dataset.bwk, v = t.dataset.bwv;
  st[k] = ['g', 'dec', 'len', 'rate'].includes(k) ? Number(v) : v; st.n = 60;
  const y = window.scrollY; draw(); window.scrollTo(0, y);
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'bwfind') return;
  e.preventDefault(); const st = bwState(); st.q = ($('bwq').value || '').trim().slice(0, 80); st.n = 60; draw();
});
