# build_free_guide.py
# Save to: C:\MarvelApps\marvelmagic\tools\build_free_guide.py
# Builds free_guide.json for Marvel Magic's Live TV Guide (Scott 11/14: "we have to find schedules or this is useless").
# Source: the community XMLTV mirror at i.mjh.nz (Pluto TV, Samsung TV Plus, Plex, Roku Channel). NOT licensed by those services -
# test build only; swap for licensed guide data before Marvel Magic is sold (docs\MARVEL_MAGIC_ROADMAP_2026-11-14.md).
# Keeps the next 9 hours, merges the same channel across services into one row (every place to watch it), writes ~small JSON.
# Run: python tools/build_free_guide.py   (GitHub Actions runs it every 3 hours: .github/workflows/free_guide.yml)
import gzip, json, re, sys, time, urllib.request
from datetime import datetime
from xml.etree import ElementTree as ET

SRC = {   # service -> (guide feed, channel details, how to open one channel)
    'Pluto TV':        ('PlutoTV/us.xml.gz',       'PlutoTV/.channels.json.gz',       lambda cid, name: f'https://pluto.tv/us/live-tv/{cid}'),
    'Samsung TV Plus': ('SamsungTVPlus/us.xml.gz', 'SamsungTVPlus/.channels.json.gz', lambda cid, name: 'https://www.samsungtvplus.com/'),
    'Plex':            ('Plex/us.xml.gz',          'Plex/.channels.json.gz',          lambda cid, name: 'https://watch.plex.tv/live-tv/channel/' + re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')),
    'The Roku Channel': ('Roku/all.xml.gz',        'Roku/.channels.json.gz',          lambda cid, name: f'https://therokuchannel.roku.com/watch/{cid}'),
}
BASE = 'https://i.mjh.nz/'
HOURS = 9
# one set of categories across services (the app shows these as chips)
CATS = [('News', r'news|opinion|weather'), ('Sports', r'sport'), ('Kids', r'kid|famil|children|animat'), ('Movies', r'movie|film|cinema'),
        ('Comedy', r'comedy|sitcom'), ('Crime', r'crime|mystery|investigat'), ('Reality', r'reality|competition|game show|daytime'),
        ('Classic TV', r'classic|retro|throwback'), ('Westerns', r'western'), ('Sci-Fi', r'sci-fi|science fic|fantasy'), ('Food & Home', r'food|home|cook|lifestyle|travel'),
        ('Music', r'music'), ('Nature & History', r'nature|history|science|documentar|animal'), ('En Español', r'espa|latino|spanish'), ('Drama', r'drama|tv shows|entertainment')]

def fetch(path):
    with urllib.request.urlopen(urllib.request.Request(BASE + path, headers={'User-Agent': 'MarvelMagicGuide/1.0'}), timeout=120) as r:
        return gzip.decompress(r.read())

def cat_of(*words):
    w = ' '.join(x for x in words if x).lower()
    for name, rx in CATS:
        if re.search(rx, w): return name
    return 'Other'

def key_of(name):   # "CBS News 24/7" / "CBS NEWS 24/7 " -> same row
    return re.sub(r'[^a-z0-9]+', '', re.sub(r'\b(channel|tv|network)\b', '', name.lower()))

def t_of(s):        # "20261114175700 +0000" -> unix seconds
    return int(datetime.strptime(s[:14] + s[14:].strip().replace(' ', ''), '%Y%m%d%H%M%S%z').timestamp()) if len(s) > 14 else int(datetime.strptime(s[:14], '%Y%m%d%H%M%S').timestamp())

def main(out_path):
    now = int(time.time()); lo, hi = now - 3600, now + HOURS * 3600
    rows, by_key = [], {}
    for svc, (feed, details, link) in SRC.items():
        try:
            meta = json.loads(fetch(details)); chans = meta.get('channels') or {}
            if not chans and 'regions' in meta: chans = (meta['regions'].get('us') or {}).get('channels') or {}
            root = ET.fromstring(fetch(feed))
        except Exception as e:
            print(svc, 'FAILED', e, file=sys.stderr); continue
        progs = {}
        for p in root.iter('programme'):
            try: a, b = t_of(p.get('start')), t_of(p.get('stop'))
            except Exception: continue
            if b <= lo or a >= hi: continue
            ep = next((e.text for e in p.findall('episode-num') if e.get('system') == 'onscreen'), '') or ''
            rt = p.find('rating'); rt = rt.findtext('value') if rt is not None and rt.find('value') is not None else (rt.text.strip() if rt is not None and rt.text else '')
            progs.setdefault(p.get('channel'), []).append([a, b, (p.findtext('title') or '').strip()[:80], ep[:12], rt[:6]])
        n_ch = 0
        for c in root.iter('channel'):
            cid = c.get('id'); name = (c.findtext('display-name') or '').strip(); m = chans.get(cid, {})
            if not name or cid not in progs: continue
            grp = m.get('group') or ', '.join(m.get('groups') or [])
            k = key_of(name); place = [svc, link(cid, name), m.get('chno') or 0]
            if k in by_key:
                r = by_key[k]
                if svc not in [x[0] for x in r['p']]: r['p'].append(place)
                if r['g'] == 'Other': r['g'] = cat_of(grp, name)
                continue
            icon = c.find('icon')
            r = {'n': name[:60], 'g': cat_of(grp, name), 'l': icon.get('src') if icon is not None else '', 'p': [place], 's': sorted(progs[cid])[:24]}
            by_key[k] = r; rows.append(r); n_ch += 1
        print(f'{svc}: {n_ch} new channels', file=sys.stderr)
    rows.sort(key=lambda r: (r['g'], r['n'].lower()))
    out = {'at': now, 'src': 'i.mjh.nz community XMLTV (test build, not licensed)', 'ch': rows}
    with open(out_path, 'w', encoding='utf-8') as f: json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(rows)} channels -> {out_path}', file=sys.stderr)

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'free_guide.json')
