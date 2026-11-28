// sw.js
// Save to: C:\MarvelApps\marvelmagic\sw.js
// Makes the app installable and fast (Scott 11/14 "keep a couple hours of guide in cache so it loads lightning fast").
//  - guide listings (free_guide.json, TVmaze schedules): the saved copy shows at once while a fresh one downloads for next time;
//    a copy older than 2 hours is not trusted - then the network goes first and the saved copy is only the fallback
//  - our own pictures (hero art, banner, icons): saved copy first
//  - the page itself: always the network first, so self-update keeps working; the saved copy only when offline
//  - our code (styles.css, js/*.js - split out of index.html 11/15): saved copy first; each carries ?v=<hash of the file>, so a new
//    version is a new address and never mixes with an old one; old versions expire after 2 days like old listings
// Other sites' pictures and scripts are left to the browser's own cache (saving them here costs a lot of storage).
const CACHE = 'mm-v3', MAX_AGE = 2 * 3600 * 1000;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));

const keyOf = req => { const u = new URL(req.url); if (u.pathname.endsWith('free_guide.json')) u.search = ''; return u.toString(); };
async function save(key, res) {
  if (!res || !res.ok) return res;
  const body = await res.clone().blob(), h = new Headers(res.headers); h.set('x-mm-at', String(Date.now()));
  const c = await caches.open(CACHE);
  await c.put(key, new Response(body, { status: res.status, statusText: res.statusText, headers: h })).catch(() => {});
  for (const k of await c.keys()) { const r = await c.match(k), at = r && Number(r.headers.get('x-mm-at') || 0); if (at && Date.now() - at > 2 * 86400000) await c.delete(k); }   // old days' listings go
  return res;
}
async function listings(e) {
  const key = keyOf(e.request), hit = await caches.match(key);
  const fresh = fetch(e.request).then(r => save(key, r));
  if (hit && Date.now() - Number(hit.headers.get('x-mm-at') || 0) < MAX_AGE) { e.waitUntil(fresh.catch(() => {})); return hit; }
  try { return await fresh; } catch (err) { if (hit) return hit; throw err; }
}
async function ours(e) {
  const key = keyOf(e.request), hit = await caches.match(key);
  if (hit) return hit;
  const r = await fetch(e.request);
  if (r.ok) (await caches.open(CACHE)).put(key, r.clone()).catch(() => {});
  return r;
}
async function code(e) {
  const key = keyOf(e.request), hit = await caches.match(key);
  if (hit) return hit;
  return save(key, await fetch(e.request));
}
async function page(e) {
  try { const r = await fetch(e.request); if (r.ok) (await caches.open(CACHE)).put(keyOf(e.request), r.clone()).catch(() => {}); return r; }
  catch (err) { const hit = await caches.match(keyOf(e.request), { ignoreSearch: true }); if (hit) return hit; throw err; }
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url), mine = u.origin === self.location.origin;
  if ((mine && u.pathname.endsWith('free_guide.json')) || (u.hostname === 'api.tvmaze.com' && u.pathname.startsWith('/schedule'))) return e.respondWith(listings(e));
  if (req.mode === 'navigate') return e.respondWith(page(e));
  if (mine && /\.(jpg|jpeg|png|webp)$/i.test(u.pathname)) return e.respondWith(ours(e));
  if (mine && /\.(css|js)$/i.test(u.pathname) && u.searchParams.has('v')) return e.respondWith(code(e));
  e.respondWith(fetch(req));
});

// 11/27 ALERTS WHEN MARVEL MAGIC IS CLOSED (js/push.js; sent by tools/push_send.py): show what arrives; a tap opens Marvel Magic on that page.
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Marvel Magic', { body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || undefined, data: { tab: d.tab != null ? d.tab : 7 } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const tab = (e.notification.data && e.notification.data.tab != null) ? e.notification.data.tab : 7, url = new URL('./?tab=' + tab, self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => x.url.startsWith(self.registration.scope));
    if (c) { c.postMessage({ mm: 'tab', tab }); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
