# build_catalogs.py - Save to: C:\MarvelApps\marvelmagic\tools\build_catalogs.py
# Builds the full movie list of each streaming service for Marvel Magic (Scott 11/16: "what about all movie listings?" ->
# "Yes, every 2 weeks"). YouTube's free movies have their own weekly builder (build_youtube_free.py); this does the other 13:
#   paid: Netflix, Prime Video, HBO Max, Hulu, Paramount+, Disney+, Peacock, Apple TV
#   free: Tubi, The Roku Channel, Pluto TV, Freevee, Plex
# Watchmode list-titles (movies, US, most popular first, 250 a page) = ~335 Watchmode credits a run; the robot runs on the 1st and
# 15th (.github/workflows/catalogs.yml), ~670 a month of the account's 2,500. TMDB gives posters, genres and running time; it is
# cached in catalogs/tmdb_cache.json so a refresh only asks TMDB about movies it hasn't seen (summaries only for each top list).
# Writes, per service:  catalogs/<slug>.json      every movie [wm, title, year, poster, genres, minutes]
#                       catalogs/<slug>_top.json  the 300 most popular with posters, plus a short summary (the shelves)
#                       catalogs/index.json       counts per service (Free TV's buttons)
# Keys: WATCHMODE_KEY / TMDB_KEY env (GitHub secrets) or, on the PC, marvelmagic_pc\watchmode.key + the TMDB line of Code.gs.
# A service that comes back with under half its old count keeps its old files (never ships a half-empty list).
# Run:  python tools\build_catalogs.py            (all)      python tools\build_catalogs.py netflix tubi   (some)
import concurrent.futures, datetime, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "catalogs"
PC = Path(r"C:\MarvelApps\marvelmagic_pc")
UA = {"User-Agent": "marvel-magic-catalogs/1.0"}
# Marvel Magic service name, Watchmode source id, file name, free?
SERVICES = [
    ("Netflix", 203, "netflix", False), ("Prime Video", 26, "prime", False), ("HBO Max", 387, "hbomax", False),
    ("Hulu", 157, "hulu", False), ("Paramount+", 444, "paramount", False), ("Disney+", 372, "disney", False),
    ("Peacock", 389, "peacock", False), ("Apple TV", 371, "appletv", False),
    ("Tubi", 296, "tubi", True), ("The Roku Channel", 452, "roku", True), ("Pluto TV", 391, "pluto", True),
    ("Freevee", 365, "freevee", True), ("Plex", 439, "plex", True),
]
TOP_N, TOP_PICK = 300, 400      # shelf size; how many of the most popular get a summary looked up


def env_key(name, fallback):
    v = os.environ.get(name, "").strip()
    if v:
        return v
    try:
        return fallback()
    except Exception:
        return ""


def get(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=45) as r:
                return json.load(r), r.headers
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None, None
            if e.code == 429:
                time.sleep(4 + 4 * i)
                continue
            if i == tries - 1:
                raise
        except Exception:
            if i == tries - 1:
                raise
        time.sleep(1 + i)
    return None, None


def watchmode_list(key, sid):
    rows, page, pages, quota, seen = [], 1, 1, None, set()
    while page <= pages and page <= 400:
        q = {"apiKey": key, "source_ids": sid, "types": "movie", "regions": "US", "limit": 250, "page": page, "sort_by": "popularity_desc"}
        d, h = get("https://api.watchmode.com/v1/list-titles/?" + urllib.parse.urlencode(q))
        if not d:
            break
        pages = int(d.get("total_pages") or 1)
        for t in d.get("titles") or []:
            if t.get("type") == "movie" and t.get("id") and t["id"] not in seen:
                seen.add(t["id"])
                rows.append(t)
        if h is not None:
            quota = h.get("X-Account-Quota-Used")
        page += 1
    return rows, quota


def tmdb_fetch(key, tid):
    d, _ = get(f"https://api.themoviedb.org/3/movie/{tid}?" + urllib.parse.urlencode({"api_key": key, "language": "en-US"}))
    return d


def short(o):
    o = re.sub(r"\s+", " ", o or "").strip()
    return o if len(o) <= 170 else o[:170].rsplit(" ", 1)[0] + "..."


def main():
    want = set(a.lower() for a in sys.argv[1:])
    services = [s for s in SERVICES if not want or s[2] in want]
    wk = env_key("WATCHMODE_KEY", lambda: (PC / "watchmode.key").read_text(encoding="utf-8").strip())
    tk = env_key("TMDB_KEY", lambda: re.search(r"var TMDB = '([0-9a-f]{32})'", (PC / "Code.gs").read_text(encoding="utf-8")).group(1))
    if not wk or not tk:
        sys.exit("WATCHMODE_KEY and TMDB_KEY are needed (GitHub: Settings > Secrets and variables > Actions)")
    OUT.mkdir(exist_ok=True)
    cpath = OUT / "tmdb_cache.json"
    cache = json.loads(cpath.read_text(encoding="utf-8")) if cpath.exists() else {}
    ipath = OUT / "index.json"
    index = json.loads(ipath.read_text(encoding="utf-8")) if ipath.exists() else {"services": {}}

    lists = {}
    for name, sid, slug, free in services:
        rows, quota = watchmode_list(wk, sid)
        old = (index["services"].get(name) or {}).get("count", 0)
        print(f"{name}: {len(rows)} movies (Watchmode used {quota})", flush=True)
        if not rows or len(rows) < old * 0.5:
            print(f"  only {len(rows)} vs {old} last time - keeping the old {slug} files", flush=True)
            continue
        lists[name] = (slug, free, rows)

    # TMDB: every movie not in the cache; the most popular of each list also need a summary
    top_ids = set()
    for slug, free, rows in lists.values():
        top_ids.update(str(t["tmdb_id"]) for t in rows[:TOP_PICK] if t.get("tmdb_id"))
    need = sorted({str(t["tmdb_id"]) for _, _, rows in lists.values() for t in rows if t.get("tmdb_id")
                   and (str(t["tmdb_id"]) not in cache or (str(t["tmdb_id"]) in top_ids and cache[str(t["tmdb_id"])] and cache[str(t["tmdb_id"])][3] is None))})
    print(f"TMDB: {len(need)} movies to look up ({len(cache)} cached)", flush=True)
    done = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as ex:
        for tid, d in zip(need, ex.map(lambda i: tmdb_fetch(tk, i), need)):
            if not d or d.get("adult"):
                cache[tid] = 0
            else:
                cache[tid] = [d.get("poster_path") or "", [g["id"] for g in d.get("genres") or [] if "id" in g][:3], d.get("runtime") or 0,
                              short(d.get("overview")) if tid in top_ids else None]
            done += 1
            if done % 3000 == 0:
                cpath.write_text(json.dumps(cache, separators=(",", ":")), encoding="utf-8")
                print(f"  {done}/{len(need)}", flush=True)
    cpath.write_text(json.dumps(cache, separators=(",", ":")), encoding="utf-8")

    made = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()
    for name, (slug, free, rows) in lists.items():
        full, top = [], []
        for t in rows:
            c = cache.get(str(t.get("tmdb_id"))) if t.get("tmdb_id") else None
            if c == 0:
                continue                                     # adult title or gone from TMDB
            poster, genres, mins, ov = (c or ["", [], 0, None])
            full.append([t["id"], t.get("title") or "", t.get("year") or 0, poster, genres, mins])
            if poster and len(top) < TOP_N:
                top.append([t["id"], t.get("title") or "", t.get("year") or 0, poster, genres, mins, ov or ""])
        head = {"made": made, "service": name, "free": free, "count": len(full),
                "credit": "Listings: Watchmode. Posters: TMDB.", "fields": ["wm", "title", "year", "poster", "genres", "minutes"]}
        (OUT / f"{slug}.json").write_text(json.dumps(dict(head, m=full), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        (OUT / f"{slug}_top.json").write_text(json.dumps(dict(head, fields=head["fields"] + ["summary"], m=top), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        index["services"][name] = {"slug": slug, "free": free, "count": len(full), "made": made}
        print(f"wrote {slug}: {len(full)} movies, {(OUT / f'{slug}.json').stat().st_size // 1024} KB; top {len(top)}", flush=True)
    index["made"] = made
    index["about"] = "Marvel Magic - full movie lists per service (tools/build_catalogs.py, 1st + 15th of each month)"
    ipath.write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    print("index:", {k: v["count"] for k, v in index["services"].items()})


if __name__ == "__main__":
    main()
