# build_new_on_tv.py
# Save to: C:\MarvelApps\marvelmagic\tools\build_new_on_tv.py
# Builds new_on_tv.json: Marvel Magic's "Coming Soon - HOT" list (premieres + new seasons, next 3 weeks) as a file the other Marvel
# Corp apps read (Scott 11/14: "any of our app the an plug about new shows ... should be coming from this app to those").
# The Hubs (Day, Family, Money) show a "New on TV - from Marvel Magic" card from this file and every tap opens Marvel Magic.
# Same source and the same rules as Marvel Magic's own page (index.html loadPool): TVmaze's US day schedules (TV + streaming),
# one entry per show, kept if it has a premiere coming or TVmaze weight >= 60. The service for each network, the free services
# and the kids rule are READ FROM the page code, index.html + js/*.js (NETWORK_SERVICE, FREE_SVC, KIDS_NETS, KID_G), so there is one copy of each.
# TVmaze listings are CC BY-SA: every place that shows them says "Listings: TVmaze".
# Run: python tools/build_new_on_tv.py [out.json]     (GitHub Actions runs it twice a day: .github/workflows/new_on_tv.yml)
import json, re, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DAYS = 21
KEEP = 160                                   # the Hubs show a handful; enough here for any service or the kids-only cut


def js_consts(html):
    """Marvel Magic's own lists, straight out of index.html."""
    def obj(name):
        m = re.search(r"const %s = \{(.*?)\};" % name, html, re.S)
        if not m:
            raise SystemExit(f"STOP: {name} not found in index.html")
        return {k.strip("'\""): v for k, v in re.findall(r"('[^']*'|\"[^\"]*\"|[\w+]+)\s*:\s*'([^']*)'", m.group(1))}

    def lst(pattern, name):
        m = re.search(pattern, html, re.S)
        if not m:
            raise SystemExit(f"STOP: {name} not found in index.html")
        return re.findall(r"'([^']*)'", m.group(1))
    return (obj("NETWORK_SERVICE"),
            set(lst(r"const FREE_SVC = new Set\(\[(.*?)\]\)", "FREE_SVC")),
            set(lst(r"const KIDS_NETS = new Set\(\[(.*?)\]\)", "KIDS_NETS")),
            lst(r"const KID_G = \[(.*?)\]", "KID_G"))


def strip(h):
    return re.sub(r"<[^>]+>", "", h or "").replace("&amp;", "&").replace("&#39;", "'").replace("&quot;", '"').strip()


try:                                         # Windows' built-in Python certificates can be out of date (11/14: TVmaze "certificate has expired")
    import certifi, ssl
    CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    CTX = None


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "MarvelMagic-new-on-tv/1"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30, context=CTX) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:                # 429 = too fast: wait and try again
            if attempt == 2:
                print(f"  skip {url}: {e}")
                return []
            time.sleep(6)


def build():
    net_svc, free_svc, kids_nets, kid_g = js_consts(chr(10).join(f.read_text(encoding="utf-8") for f in [ROOT / "index.html", *sorted((ROOT / "js").glob("*.js"))]))   # the page code moved to js/*.js 11/15
    now = datetime.now(timezone.utc)
    days = [(now + timedelta(days=n)).strftime("%Y-%m-%d") for n in range(DAYS)]
    urls = [u for d in days for u in (f"https://api.tvmaze.com/schedule?country=US&date={d}", f"https://api.tvmaze.com/schedule/web?date={d}")]
    raw = []
    with ThreadPoolExecutor(8) as pool:       # 8 at once, then a pause: TVmaze allows about 20 calls per 10 seconds (same pace as the page)
        for i in range(0, len(urls), 8):
            for part in pool.map(get, urls[i:i + 8]):
                raw.extend(part or [])
            if i + 8 < len(urls):
                time.sleep(4.2)
    by, cut = {}, (now - timedelta(days=1)).timestamp() * 1000
    for e in raw:
        s = e.get("show") or (e.get("_embedded") or {}).get("show")
        if not s or not e.get("airstamp"):
            continue
        ch = s.get("network") or s.get("webChannel") or {}
        cc = (ch.get("country") or {}).get("code")
        if cc and cc != "US":
            continue
        t = datetime.fromisoformat(e["airstamp"].replace("Z", "+00:00")).timestamp() * 1000
        if t < cut:
            continue
        x = by.get(s["id"])
        if not x:
            img = s.get("image") or {}
            net = ch.get("name") or ""
            genres = s.get("genres") or []
            svc = net_svc.get(net) or (net if net in free_svc else None)
            x = by[s["id"]] = {"id": s["id"], "name": s.get("name") or "", "net": net, "svc": svc, "free": bool(svc and svc in free_svc),
                               "genres": genres[:3], "w": s.get("weight") or 0, "img": img.get("medium") or img.get("original"),
                               "sum": strip(s.get("summary"))[:170], "url": s.get("officialSite") or s.get("url"),
                               "kids": net in kids_nets or any(g in kid_g for g in genres), "lang": s.get("language") or "", "next": t, "prem": None}
        x["next"] = min(x["next"], t)
        if e.get("number") == 1 and (not x["prem"] or t < x["prem"]["at"]):
            x["prem"] = {"at": t, "season": e.get("season")}
    shows = [x for x in by.values() if x["prem"] or x["w"] >= 60]
    shows.sort(key=lambda x: (0 if x["prem"] else 1, x["prem"]["at"] if x["prem"] else -x["w"]))
    for x in shows:
        x["next"] = int(x["next"])
        if x["prem"]:
            x["prem"]["at"] = int(x["prem"]["at"])
    keep = shows[:KEEP] + [x for x in shows[KEEP:] if x["kids"]][:60]   # every kid-safe show too: Family Hub shows only those
    return {"made": now.isoformat(timespec="seconds"), "days": DAYS, "credit": "Listings: TVmaze", "credit_url": "https://www.tvmaze.com/",
            "about": "Marvel Magic's Coming Soon - HOT list for the other Marvel Corp apps (tools/build_new_on_tv.py)", "shows": keep}


if __name__ == "__main__":
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "new_on_tv.json"
    feed = build()
    if len(feed["shows"]) < 10:               # TVmaze down or blocked: keep yesterday's file rather than publish an empty one
        raise SystemExit(f"STOP: only {len(feed['shows'])} shows - not writing {out}")
    out.write_text(json.dumps(feed, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    prem = sum(1 for x in feed["shows"] if x["prem"])
    print(f"{out.name}: {len(feed['shows'])} shows ({prem} premieres), {sum(1 for x in feed['shows'] if x['kids'])} kid-safe, {out.stat().st_size:,} bytes")
