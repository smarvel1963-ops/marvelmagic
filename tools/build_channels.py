# build_channels.py
# Save to: C:\MarvelApps\marvelmagic\tools\build_channels.py
# Builds channels.json - Marvel Magic's MASTER CHANNEL LIST (Scott 11/15: "yes it needs data we dont pay for").
# Free sources only:
#   1. iptv-org database (public domain / Unlicense): every active US channel - name, network, categories, official website.
#   2. free_guide.json (this repo, rebuilt every 3 h): which free channels are LIVE in Pluto / Samsung TV Plus / Plex / Roku's own
#      lineup today, their official watch links and whether they have schedule rows.
#   3. Marvel Magic's own service map in js/core.js (NETWORK_SERVICE, the Sling Orange / Blue lists, SLING_CH channel links).
# Every channel lands in ONE of three groups (the outside-chat plan Scott pasted 11/15):
#   free     = Verified free: in a free service's live lineup today, with an official link AND schedule rows
#   thin     = Free, limited guide: a free service carries it (or listed today without schedule rows) - opens, schedule may be thin
#   sub      = Subscription: carried by paid services the viewer may have (shows which service they need)
# Channels in none of those (iptv-org lists thousands of local stations / closed / foreign-language feeds) are left out, so the guide
# never shows a channel nobody can open. iptv-org STREAM links and EPG are NOT used (scraped, not licensed) - see the roadmap.
# Run: python tools/build_channels.py [out.json]   (GitHub Actions: .github/workflows/channels.yml, daily)
import json, re, sys, urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IPTV = 'https://iptv-org.github.io/api/channels.json'
FREE_NETWORKS = {   # iptv-org "network" -> the free service in Marvel Magic
    'pluto tv': 'Pluto TV', 'samsung tv plus': 'Samsung TV Plus', 'plex': 'Plex', 'the roku channel': 'The Roku Channel', 'roku': 'The Roku Channel',
    'xumo': 'Xumo Play', 'xumo play': 'Xumo Play', 'tubi': 'Tubi', 'local now': 'Local Now', 'freevee': 'Freevee', 'vizio watchfree+': 'Vizio WatchFree+',
}
OFFICIAL = re.compile(r'^https://([a-z0-9-]+\.)*(pluto\.tv|samsungtvplus\.com|plex\.tv|roku\.com|xumo\.com|xumo\.tv|tubitv\.com|localnow\.com)(/|$)', re.I)


def key_of(name: str) -> str:   # same rule as build_free_guide: "CBS News 24/7" / "CBS NEWS 24/7 " -> one row
    k = re.sub(r'\b(hd|east|west|us|usa|tv channel|channel)\b', ' ', str(name).lower())
    return re.sub(r'[^a-z0-9+]+', '', k)


def page_code() -> str:
    return '\n'.join(f.read_text(encoding='utf-8') for f in [ROOT / 'index.html', *sorted((ROOT / 'js').glob('*.js'))])


def svc_map(code: str) -> dict:
    """channel name -> [paid services that carry it] from js/core.js."""
    out = {}
    m = re.search(r"const NETWORK_SERVICE = \{(.*?)\};", code, re.S)
    if m:
        for k, v in re.findall(r"('[^']*'|\"[^\"]*\"|[\w+&]+)\s*:\s*'([^']*)'", m.group(1)):
            out.setdefault(k.strip("'\""), []).append(v)
    both = re.search(r"const SLING_BOTH = \[(.*?)\];", code, re.S)
    both = re.findall(r"'([^']*)'", both.group(1)) if both else []
    for pkg in ('Sling Orange', 'Sling Blue'):
        pm = re.search(r"'%s': \[\.\.\.SLING_BOTH, (.*?)\]" % pkg, code, re.S)
        for ch in both + (re.findall(r"'([^']*)'", pm.group(1)) if pm else []):
            out.setdefault(ch, []).append(pkg)
    for ch in list(out):   # full live bundles carry every cable channel
        out[ch] += ['YouTube TV', 'Hulu + Live TV', 'DirecTV Stream']
    return {k: sorted(set(v)) for k, v in out.items()}


def sling_links(code: str) -> dict:
    m = re.search(r"const SLING_CH = \{(.*?)\};", code, re.S)
    return {k.strip("'\""): f'https://watch.sling.com/1/channel/{v}/watch' for k, v in re.findall(r"('[^']*'|[\w+&!]+)\s*:\s*'([0-9a-f]{32})'", m.group(1))} if m else {}


def main(out_path: Path):
    with urllib.request.urlopen(urllib.request.Request(IPTV, headers={'User-Agent': 'MarvelMagic-channels/1.0'}), timeout=120) as r:
        iptv = [c for c in json.load(r) if c.get('country') == 'US' and not c.get('closed') and not c.get('is_nsfw')]
    guide = json.loads((ROOT / 'free_guide.json').read_text(encoding='utf-8'))
    code = page_code()
    paid, sling = svc_map(code), sling_links(code)
    rows = {}

    def row(name):
        k = key_of(name)
        if not k:
            return None
        return rows.setdefault(k, {'n': name, 'cat': [], 'grp': None, 'where': [], 'sched': False, 'iptv': None, 'web': None, 'listed': False})

    # 1) free channels live today in a free service's own lineup (free_guide.json "ch")
    for ch in guide.get('ch', []):
        r = row(ch['n'])
        if not r:
            continue
        r['listed'] = True
        r['sched'] = r['sched'] or bool(ch.get('s'))
        if ch.get('g') and ch['g'] not in r['cat']:
            r['cat'].append(ch['g'])
        for p in ch.get('p', []):
            if p[0] and p[1] and [p[0], p[1]] not in r['where']:
                r['where'].append([p[0], p[1]])
    # 2) iptv-org: categories, official site, free networks not in today's feed
    for c in iptv:
        names = [c['name'], *c.get('alt_names', [])]
        r = next((rows[key_of(n)] for n in names if key_of(n) in rows), None)
        net = FREE_NETWORKS.get(str(c.get('network') or '').lower())
        if r is None and (net or any(n in paid for n in names)):
            r = row(c['name'])
        if r is None:
            continue
        r['iptv'] = r['iptv'] or c['id']
        r['web'] = r['web'] or c.get('website')
        for cat in c.get('categories', []):
            cat = cat.replace('_', ' ').title()
            if cat not in r['cat']:
                r['cat'].append(cat)
        if net and not any(w[0] == net for w in r['where']) and c.get('website') and OFFICIAL.match(c['website']):
            r['where'].append([net, c['website']])
    # 3) paid services (subscription channels)
    for name, svcs in paid.items():
        r = row(name)
        if not r:
            continue
        for s in svcs:
            if not any(w[0] == s for w in r['where']):
                r['where'].append([s, sling.get(name, '') if s.startswith('Sling') else ''])
    # cable channels with listings in free_guide.json "cab" (community feeds, test build) have schedule rows too
    for name in (guide.get('cab') or {}):
        k = key_of(name)
        if k in rows:
            rows[k]['sched'] = True
    # groups
    free_svcs = set(FREE_NETWORKS.values())
    out = []
    for r in rows.values():
        has_free = any(w[0] in free_svcs and w[1] for w in r['where'])
        has_paid = any(w[0] not in free_svcs for w in r['where'])
        r['grp'] = 'free' if has_free and r['listed'] and r['sched'] else 'thin' if has_free else 'sub' if has_paid else None
        if r['grp']:
            r['cat'] = r['cat'][:3]
            out.append({k: v for k, v in r.items() if v not in (None, [], False) or k in ('sched',)})
    out.sort(key=lambda x: ({'free': 0, 'thin': 1, 'sub': 2}[x['grp']], x['n'].lower()))
    n = {g: sum(1 for x in out if x['grp'] == g) for g in ('free', 'thin', 'sub')}
    doc = {'at': datetime.now(timezone.utc).isoformat(timespec='seconds'), 'counts': n,
           'sources': ['iptv-org database (public domain)', 'free_guide.json (free services live lineups)', 'Marvel Magic service map'],
           'channels': out}
    out_path.write_text(json.dumps(doc, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f"channels.json: {len(out)} channels - verified free {n['free']}, free limited guide {n['thin']}, subscription {n['sub']}")


if __name__ == '__main__':
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'channels.json')
