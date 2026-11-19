# tools/build_leaving_soon.py
# Save to: C:\MarvelApps\marvelmagic\tools\build_leaving_soon.py
# Builds leaving_soon.json (titles leaving a streaming service in the next 30 days) for Marvel Magic's Home "Leaving Soon" strip.
# Source: Streaming Availability API (Movie of the Night) via RapidAPI, GET /changes?change_type=expiring. ONLY this script calls it, from
# the GitHub Action; the browser app just reads the JSON. The key comes from the RAPIDAPI_KEY environment variable (a GitHub Actions
# secret) and is never printed, written or put in a URL. Missing key or any API trouble = keep the last good file, exit 0.
import json, os, sys, time, urllib.request, urllib.error, urllib.parse
from datetime import datetime, timezone
from pathlib import Path
try:
    from zoneinfo import ZoneInfo
    CT = ZoneInfo('America/Chicago')
except Exception:
    CT = timezone.utc

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else 'leaving_soon.json')
HOST = 'streaming-availability.p.rapidapi.com'
MAX_PAGES = 4          # 25 changes per page -> at most 100 changes (and 4 calls) a run
DAYS = 30
# Streaming Availability service id -> Marvel Magic's service key (js/core.js SERVICE_URL)
SVC = {'netflix': 'Netflix', 'prime': 'Prime Video', 'disney': 'Disney+', 'hbo': 'HBO Max', 'hulu': 'Hulu', 'peacock': 'Peacock',
       'paramount': 'Paramount+', 'apple': 'Apple TV', 'starz': 'Starz', 'mgmplus': 'MGM+', 'britbox': 'BritBox', 'acorn': 'Acorn TV',
       'shudder': 'Shudder', 'crunchyroll': 'Crunchyroll'}
CORE = ['netflix', 'prime', 'disney', 'hbo', 'hulu', 'peacock', 'paramount', 'apple', 'starz']   # the ids we are sure of: the fallback if an extra id is refused


def log(msg):
    print(msg, flush=True)


def call(key, catalogs, frm, to, cursor=None):
    q = {'country': 'us', 'change_type': 'expiring', 'item_type': 'show', 'catalogs': ','.join(c + '.subscription' for c in catalogs),
         'from': frm, 'to': to, 'order_direction': 'asc'}
    if cursor:
        q['cursor'] = cursor
    req = urllib.request.Request(f'https://{HOST}/changes?' + urllib.parse.urlencode(q),
                                 headers={'X-RapidAPI-Key': key, 'X-RapidAPI-Host': HOST, 'User-Agent': 'marvel-magic-leaving-soon'})
    with urllib.request.urlopen(req, timeout=30) as r:
        for h, v in r.headers.items():   # quota headers only (never the key): shows what is left of the free plan
            if 'ratelimit' in h.lower():
                log(f'  {h}: {v}')
        return json.load(r)


def pick(d, *path):
    for p in path:
        if not isinstance(d, dict):
            return None
        d = d.get(p)
    return d


def image(show):
    s = show.get('imageSet') or {}
    for k, w in (('horizontalPoster', 'w720'), ('horizontalBackdrop', 'w720'), ('verticalPoster', 'w480'), ('verticalBackdrop', 'w480')):
        u = pick(s, k, w) or next(iter((s.get(k) or {}).values()), None)
        if u:
            return u
    return None


def build(changes, shows, now, end):
    out, seen = [], set()
    for c in changes:
        sid = pick(c, 'service', 'id'); svc = SVC.get(sid)
        ts = c.get('timestamp'); show = shows.get(c.get('showId')) or {}
        if not svc or not ts or not show.get('title') or not (now <= ts <= end):
            continue
        img = image(show)
        if not img:
            continue   # no picture, no card
        day = datetime.fromtimestamp(ts, CT).strftime('%Y-%m-%d')
        k = (c.get('showId'), svc)
        if k in seen:
            continue
        seen.add(k)
        link = c.get('link')
        if not link:
            for o in (pick(show, 'streamingOptions', 'us') or []):
                if pick(o, 'service', 'id') == sid and o.get('link'):
                    link = o['link']
                    break
        out.append({'id': str(c.get('showId')), 'title': show['title'], 'type': 'movie' if show.get('showType') == 'movie' else 'show', 'svc': svc,
                    'leave': day, 'img': img, 'link': link if isinstance(link, str) and link.startswith('https://') else None,
                    'year': show.get('releaseYear') or show.get('firstAirYear'),
                    'genres': [g.get('name') for g in (show.get('genres') or []) if isinstance(g, dict) and g.get('name')][:4]})
    out.sort(key=lambda x: (x['leave'], x['title']))
    return out


def main():
    key = os.environ.get('RAPIDAPI_KEY', '').strip()
    if not key:
        log('RAPIDAPI_KEY is not set: leaving_soon.json left as it is.')
        return
    now = int(time.time())
    end = now + DAYS * 86400
    cats, changes, shows, cursor, calls = list(SVC), [], {}, None, 0
    try:
        while calls < MAX_PAGES + 1:
            try:
                j = call(key, cats, now, end, cursor)
                calls += 1
            except urllib.error.HTTPError as e:
                if e.code == 400 and cats != CORE and not changes:
                    log('API refused a service id (HTTP 400): retrying with the core services.')
                    cats = CORE
                    calls += 1
                    continue
                raise
            changes += j.get('changes') or []
            shows.update(j.get('shows') or {})
            cursor = j.get('nextCursor')
            if not j.get('hasMore') or not cursor or calls >= MAX_PAGES:
                break
    except Exception as e:   # never print the request (it carries the key header); the class and HTTP code are enough
        log(f"::warning::Leaving Soon: API call failed ({type(e).__name__} {getattr(e, 'code', '')}). Last good file kept.")
        return
    items = build(changes, shows, now, end)
    log(f'{calls} API call(s), {len(changes)} changes, {len(items)} cards.')
    OUT.write_text(json.dumps({'updated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%MZ'), 'source': 'Streaming Availability', 'items': items},
                              indent=1, ensure_ascii=False) + '\n', encoding='utf-8')


main()
