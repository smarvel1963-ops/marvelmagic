# build_free_guide.py
# Save to: C:\MarvelApps\marvelmagic\tools\build_free_guide.py
# Builds free_guide.json for Marvel Magic's Live TV Guide (Scott 11/14: "we have to find schedules or this is useless").
# Source: the community XMLTV mirror at i.mjh.nz (Pluto TV, Samsung TV Plus, Plex, Roku Channel). NOT licensed by those services -
# test build only; swap for licensed guide data before Marvel Magic is sold (docs\MARVEL_MAGIC_ROADMAP_2026-11-14.md).
# Keeps the next 9 hours, merges the same channel across services into one row (every place to watch it), writes ~small JSON.
# Run: python tools/build_free_guide.py   (GitHub Actions runs it every 3 hours: .github/workflows/free_guide.yml)
import gzip, io, json, re, sys, time, urllib.request
from datetime import datetime
from xml.etree import ElementTree as ET

SRC = {   # service -> (guide feed, channel details, how to open one channel)
    'Pluto TV':        ('PlutoTV/us.xml.gz',       'PlutoTV/.channels.json.gz',       lambda cid, name: f'https://pluto.tv/us/live-tv/{cid}'),
    'Samsung TV Plus': ('SamsungTVPlus/us.xml.gz', 'SamsungTVPlus/.channels.json.gz', lambda cid, name: 'https://www.samsungtvplus.com/'),
    'Plex':            ('Plex/us.xml.gz',          'Plex/.channels.json.gz',          lambda cid, name: 'https://watch.plex.tv/live-tv/channel/' + re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')),
    'The Roku Channel': ('Roku/all.xml.gz',        'Roku/.channels.json.gz',          lambda cid, name: f'https://therokuchannel.roku.com/watch/{cid}'),
}
# CABLE: channels in the paid packages (Sling etc.) whose real listings are in a community feed - fills their "No listing" rows
# (Scott 11/14 "the guide needs to load up with more channels"). Same test-build-only note as above.
CABLE = ['hgtv_go/epg.xml.gz']   # HGTV, Food Network, TLC, Discovery, ID, Animal Planet, Travel Channel, OWN, Magnolia...
# the epgshare01 US cable feed (~790 channels, refreshed daily): guide channel name -> that feed's channel id
US2_URL = 'https://epgshare01.online/epgshare01/epg_ripper_US2.xml.gz'
US2 = {
    'TNT': 'TNT.HD.us2', 'TBS': 'TBS.HD.us2', 'truTV': 'truTV.HD.us2', 'CNN': 'CNN.HD.us2', 'HLN': 'HLN.HD.us2', 'AMC': 'AMC.HD.us2',
    'A&E': 'A.and.E.HD.East.us2', 'History': 'History.HD.us2', 'Lifetime': 'Lifetime.HD.us2', 'Food Network': 'Food.Network.HD.us2',
    'Investigation Discovery': 'Investigation.Discovery.HD.us2', 'Comedy Central': 'Comedy.Central.HD.us2', 'Cartoon Network': 'Cartoon.Network.HD.us2',
    'IFC': 'IFC.HD.us2', 'BBC America': 'BBC.America.HD.us2', 'Motor Trend': 'MOTORTREND.HD.us2', 'Vice': 'Vice.HD.us2',
    'Bloomberg Television': 'Bloomberg.HD.us2', 'ESPN': 'ESPN.HD.us2', 'ESPN2': 'ESPN2.HD.us2', 'ACC Network': 'ACC.Network.us2',
    'Disney Channel': 'Disney.Channel.HD.us2', 'Freeform': 'Freeform.HD.us2', 'NBC': 'NBC.East.Stream.us2', 'CBS': 'CBS.Streaming.SD.East.feed.us2',
    'ABC': 'ABC.National.Feed.us2', 'FS1': 'FS1.HD.us2', 'FS2': 'FS2.HD.us2', 'FX': 'FX.HD.us2', 'FXX': 'FXX.HD.us2', 'USA': 'USA.Network.HD.us2',
    'Bravo': 'Bravo.HD.us2', 'Syfy': 'Syfy.HD.us2', 'E!': 'E!.Entertainment.Television.HD.us2', 'Oxygen True Crime': 'Oxygen.True.Crime.HD.us2',
    'MS NOW': 'MS.NOW.HD.us2', 'CNBC': 'CNBC.HD.us2', 'Fox News': 'Fox.News.Channel.HD.us2', 'Fox Business': 'Fox.Business.HD.us2',
    'Discovery': 'Discovery.Channel.HD.us2', 'TLC': 'TLC.HD.(US).us2', 'Animal Planet': 'Animal.Planet.HD.us2', 'National Geographic': 'National.Geographic.HD.us2',
    'Nat Geo Wild': 'National.Geographic.Wild.HD.us2', 'NFL Network': 'NFL.Network.HD.us2', 'CBS Sports Network': 'CBS.Sports.Network.HD.us2',
    'HBO': 'HBO.East.us2', 'ESPNU': 'ESPNU.HD.us2', 'SEC Network': 'SEC.Network.HD.us2', 'Big Ten Network': 'Big.Ten.Network.HD.us2',
    'Hallmark Channel': 'Hallmark.Channel.HD.us2', 'Hallmark Mystery': 'Hallmark.Mystery.HD.us2', 'Paramount Network': 'Paramount.Network.HD.us2',
    'Nickelodeon': 'Nickelodeon.HD.us2', 'Nick Jr.': 'Nick.Jr.HD.us2', 'MTV': 'MTV.-.Music.Television.HD.us2', 'BET': 'BET.HD.us2',
    'TCM': 'Turner.Classic.Movies.HD.us2', 'Golf Channel': 'Golf.Channel.HD.us2', 'NBA TV': 'NBA.TV.HD.us2', 'MLB Network': 'MLB.Network.HD.us2',
    'NHL Network': 'NHL.Network.HD.us2', 'Tennis Channel': 'Tennis.Channel.HD.us2', 'The Weather Channel': 'The.Weather.Channel.HD.us2', 'CMT': 'CMT.HD.us2',
    'Disney Junior': 'Disney.Junior.HD.us2', 'Disney XD': 'Disney.XD.HD.us2', 'Newsmax': 'Newsmax.TV.HD.us2', 'NewsNation': 'NewsNation.us2',
    'OWN': 'Oprah.Winfrey.Network.HD.us2', 'Smithsonian Channel': 'Smithsonian.HD.Network.us2', 'WE tv': 'WE.tv.HD.us2', 'Game Show Network': 'Game.Show.Network.HD.us2',
    'TV Land': 'TV.Land.HD.us2', 'Science': 'Science.Channel.HD.us2', 'Magnolia Network': 'Magnolia.Network.HD.us2', 'Cooking Channel': 'Cooking.Channel.HD.us2',
    'Sundance TV': 'SundanceTV.HD.us2', 'Univision': 'Univision.Network.HD.us2', 'Telemundo': 'Telemundo.Satellite.Feed.us2', 'PBS': 'PBS.Stream.us2',
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
        raw = r.read()
    return gzip.decompress(raw) if raw[:2] == bytes([31, 139]) else raw   # some feeds come back already unpacked

def cable(lo, hi, now):   # {channel name: [[start, end, title, episode name, S/E, picture (now/next only)]]}
    out, us2_names = {}, set()
    for feed in CABLE:
        try: root = ET.fromstring(fetch(feed))
        except Exception as e: print(feed, 'FAILED', e, file=sys.stderr); continue
        names = {c.get('id'): (c.findtext('display-name') or '').strip() for c in root.iter('channel')}
        for p in root.iter('programme'):
            try: a, b = t_of(p.get('start')), t_of(p.get('stop'))
            except Exception: continue
            n = names.get(p.get('channel'))
            if not n or b <= lo or a >= hi: continue
            ep = next((e.text for e in p.findall('episode-num') if e.get('system') == 'onscreen'), '') or ''
            ic = p.find('icon')
            out.setdefault(n, []).append([a, b, (p.findtext('title') or '').strip()[:80], (p.findtext('sub-title') or '').strip()[:80], ep[:12], ic.get('src') if ic is not None else ''])
    # the US cable feed, under the guide's own channel names (it replaces a smaller feed's listings for the same channel)
    want = {v: k for k, v in US2.items()}
    try:
        with urllib.request.urlopen(urllib.request.Request(US2_URL, headers={'User-Agent': 'MarvelMagicGuide/1.0'}), timeout=180) as r: raw = r.read()
        for ev, p in ET.iterparse(io.BytesIO(gzip.decompress(raw))):
            if p.tag != 'programme': continue
            n = want.get(p.get('channel'))
            if n:
                if n not in us2_names: out[n] = []; us2_names.add(n)   # the big feed runs later into the night: it replaces the smaller one
                try: a, b = t_of(p.get('start')), t_of(p.get('stop'))
                except Exception: a = b = 0
                if b > lo and a < hi:
                    ep = next((e.text for e in p.findall('episode-num') if e.get('system') == 'onscreen'), '') or ''
                    ic = p.find('icon')
                    out.setdefault(n, []).append([a, b, (p.findtext('title') or '').strip()[:80], (p.findtext('sub-title') or '').strip()[:80], ep[:12], ic.get('src') if ic is not None else ''])
                    us2_names.add(n)
            p.clear()
    except Exception as e: print('US2 FAILED', e, file=sys.stderr)
    for n, l in out.items():
        l.sort()
        for i, q in enumerate(l):
            if q[1] < now or i > 2: q[5] = ''
        out[n] = l[:24]
    print(f'cable: {len(out)} channels', file=sys.stderr)
    return out

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
            ic = p.find('icon'); ic = ic.get('src') if ic is not None else ''
            progs.setdefault(p.get('channel'), []).append([a, b, (p.findtext('title') or '').strip()[:80], ep[:12], rt[:6], ic or ''])
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
            sched = sorted(progs[cid])[:24]
            for i, q in enumerate(sched):   # keep show pictures only for what's on now / next (keeps the file small)
                if q[1] < now or i > 2: q[5] = ''
            r = {'n': name[:60], 'g': cat_of(grp, name), 'l': icon.get('src') if icon is not None else '', 'p': [place], 's': sched}
            by_key[k] = r; rows.append(r); n_ch += 1
        print(f'{svc}: {n_ch} new channels', file=sys.stderr)
    rows.sort(key=lambda r: (r['g'], r['n'].lower()))
    out = {'at': now, 'src': 'i.mjh.nz community XMLTV (test build, not licensed)', 'ch': rows, 'cab': cable(lo, hi, now)}
    with open(out_path, 'w', encoding='utf-8') as f: json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(rows)} channels -> {out_path}', file=sys.stderr)

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'free_guide.json')
