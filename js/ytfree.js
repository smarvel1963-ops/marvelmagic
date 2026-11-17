/* ytfree.js
   Save to: C:\MarvelApps\marvelmagic\js\ytfree.js
   FREE ON YOUTUBE (Scott 11/15: "we also get all free movie you tube"; 11/16 "Yes, build it"): every movie free to watch on YouTube in
   the US (~6,900, free with ads), most popular first. youtube_free_top.json (300 with posters) fills the shelves on Movies & Shows and
   Free TV; youtube_free.json (all of them) loads for See all and for search. Both are rebuilt weekly by tools/build_youtube_free.py
   (Watchmode listings, TMDB posters). Tapping a poster asks the relay for that movie's own YouTube page (core.js enrich, x.yt), then opens it;
   if the lookup fails it opens a YouTube search for the title. YouTube counts as free for everyone (core.js hasIt / ownSvc).
   Kids Lock: only TMDB Family movies that aren't Horror, Thriller, Crime or War. After editing run  python tools\stamp_versions.py  */
let YT_TOP = null, YT_ALL = null;
const YT_IMG = p => p ? 'https://image.tmdb.org/t/p/w342' + p : null;
const YT_NOKID = [27, 53, 80, 10752];
const ytSearch = (t, y) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(t + (y ? ' ' + y : '') + ' full movie');
const ytItem = r => ({
  key: 'yt' + r[0], wmId: r[0], yt: true, title: r[1], svc: 'YouTube', series: false,
  note: [r[2] || '', r[7] ? Math.floor(r[7] / 60) + 'h ' + (r[7] % 60) + 'm' : '', 'Free on YouTube'].filter(Boolean).join(' · '),
  img: YT_IMG(r[4]), big: YT_IMG(r[4]), sum: r[6] || '', genres: (r[5] || []).map(g => TMDB_G[g]).filter(Boolean), gids: r[5] || [],
  kid: (r[5] || []).includes(10751) && !(r[5] || []).some(g => YT_NOKID.includes(g)), url: ytSearch(r[1], r[2]) });
function loadYt(all) {
  if (all ? YT_ALL : YT_TOP) return;
  const busy = { busy: true }; if (all) YT_ALL = busy; else YT_TOP = busy;
  fetch((all ? 'youtube_free.json' : 'youtube_free_top.json') + '?v=' + Math.floor(Date.now() / 86400000))
    .then(r => r.json()).then(j => { const v = { items: (j.m || []).map(ytItem), count: j.count || (j.m || []).length }; if (all) YT_ALL = v; else YT_TOP = v; })
    .catch(() => { if (all) YT_ALL = { error: 1 }; else YT_TOP = { error: 1 }; })
    .then(() => { if (S.tab === 1 || S.tab === 4) { const y = window.scrollY; draw(); window.scrollTo(0, y); } });
}
// the shelf (Movies & Shows, Free TV): the first n posters the person may watch
function ytShelf(n) {
  loadYt(false);
  const c = YT_TOP || { busy: true };
  if (c.error) return '';
  const list = (c.items || []).filter(kidOk).slice(0, n);
  return `<div class="hh" style="margin-top:22px"><h2>▶ Free on YouTube <small class="fine">${(c.count || 6900).toLocaleString()} movies · free with ads</small></h2><button class="more" data-ytall>See all ›</button></div>`
    + (list.length ? `<div class="lgrid six">${list.map(x => lposter(x)).join('')}</div>` : `<p class="fine">${c.busy ? 'Loading…' : 'Nothing here with Kids Lock on.'}</p>`);
}
// search results on Movies & Shows also list the matching free YouTube movies
function ytFound(q) {
  q = String(q || '').trim().toLowerCase(); if (!q) return '';
  loadYt(true);
  const c = YT_ALL || { busy: true };
  if (c.error) return '';
  if (c.busy) return '<h3 class="lsub">Free on YouTube</h3><p class="fine">Searching the free movies…</p>';
  const hits = c.items.filter(x => x.title.toLowerCase().includes(q)).filter(kidOk).slice(0, 18);
  return hits.length ? `<h3 class="lsub">Free on YouTube</h3><div class="lgrid">${hits.map(x => lposter(x)).join('')}</div>` : '';
}
// SEE ALL: the whole list, a search box, genre chips, 60 at a time
const YT_GENRES = [[0, 'All'], [28, 'Action'], [35, 'Comedy'], [18, 'Drama'], [53, 'Thriller'], [27, 'Horror'], [10749, 'Romance'], [878, 'Sci-Fi'], [16, 'Animation'], [10751, 'Family'], [80, 'Crime'], [99, 'Documentary'], [37, 'Western'], [10752, 'War']];
function ytAllPage() {
  loadYt(true);
  const c = YT_ALL || { busy: true }, g = S.ytG || 0, q = String(S.ytQ || '').trim().toLowerCase();
  const list = (c.items || []).filter(kidOk).filter(x => !g || x.gids.includes(g)).filter(x => !q || x.title.toLowerCase().includes(q));
  const n = S.ytN || 60;
  const body = c.error ? '<p class="fine">Couldn’t load the free movie list right now. Try again in a bit.</p>' : c.busy ? '<p class="fine">Loading every free movie…</p>'
    : list.length ? `<div class="lgrid six">${list.slice(0, n).map(x => lposter(x)).join('')}</div>${list.length > n ? `<button class="btn alt" data-ytmore style="margin:18px auto 0;display:block">Show more (${(list.length - n).toLocaleString()} left)</button>` : ''}`
    : '<p class="fine">No free movie matches that.</p>';
  return `<div class="hh"><button class="more" data-ytback>‹ Movies &amp; Shows</button></div>
    <h1>▶ Free on YouTube</h1><p class="fine" style="margin-top:-4px">${(c.count || 6900).toLocaleString()} movies free to watch on YouTube, most popular first. Free with ads, no sign-up. Pick one, then ▶ to open it on YouTube.</p>
    <form class="search" id="ytfind" style="margin:12px 0"><input id="ytq" aria-label="Search the free YouTube movies" placeholder="Search the free movies" value="${esc(S.ytQ || '')}"><button class="btn">Search</button></form>
    <div class="filters" style="margin-bottom:12px">${YT_GENRES.filter(([id]) => !kidsOn() || [0, 16, 10751].includes(id)).map(([id, name]) => `<button class="chip ${g === id ? 'on' : ''}" data-ytg="${id}">${esc(name)}</button>`).join('')}</div>
    ${body}<p class="fine" style="margin-top:18px">Listings: Watchmode. Posters: <a href="https://www.themoviedb.org/" target="_blank" rel="noopener">TMDB</a>. This product uses the TMDB API but is not endorsed or certified by TMDB.</p>`;
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('button[data-tab]'); if (b) S.ytAll = false; }, true);   // a menu / tab button leaves See all (body carries data-tab too)
document.addEventListener('click', e => {
  const t = e.target.closest('[data-ytall],[data-ytg],[data-ytmore],[data-ytback]'); if (!t) return;
  if (t.hasAttribute('data-ytall')) { S.ytAll = true; S.ytN = 60; S.sel = null; if (S.tab !== 1) { history.pushState({ tab: 1 }, ''); showTab(1); } else { draw(); } window.scrollTo(0, 0); return; }
  if (t.hasAttribute('data-ytback')) { S.ytAll = false; S.sel = null; draw(); window.scrollTo(0, 0); return; }
  if (t.dataset.ytg != null) { S.ytG = Number(t.dataset.ytg); S.ytN = 60; const y = window.scrollY; draw(); window.scrollTo(0, y); return; }
  if (t.hasAttribute('data-ytmore')) { S.ytN = (S.ytN || 60) + 60; const y = window.scrollY; draw(); window.scrollTo(0, y); }
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'ytfind') return;
  e.preventDefault(); S.ytQ = ($('ytq').value || '').trim().slice(0, 80); S.ytN = 60; draw();
});
