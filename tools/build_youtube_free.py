# build_youtube_free.py - Save to: C:\MarvelApps\marvelmagic\tools\build_youtube_free.py
# Builds youtube_free.json - every movie free to watch on YouTube in the US (Scott 11/15: "we also get all free movie you tube";
# 11/16 "Yes, build it"). Marvel Magic's "Free on YouTube" shelf (Movies & Shows + Free TV) reads it.
#   1. Watchmode list-titles, source 345 = YouTube (free), movies, US, most popular first: 250 a page, ~28 pages = ~28 Watchmode
#      credits per run (the account allows 2,500 a month). Each movie keeps its Watchmode id, so a tap asks the relay ('where')
#      for that movie's own YouTube page.
#   2. TMDB movie details for the poster, genres, a short summary and the running time (free; no daily limit).
# Keys: WATCHMODE_KEY and TMDB_KEY environment variables (GitHub secrets on the weekly robot, .github/workflows/youtube_free.yml).
# On the PC, if they're not set, it reads C:\MarvelApps\marvelmagic_pc\watchmode.key and the TMDB line in marvelmagic_pc\Code.gs.
# Neither key is ever written into the repo. A run that gets fewer than 1,000 movies keeps the old file (never ships an empty shelf).
# Run:  python tools\build_youtube_free.py youtube_free.json
import concurrent.futures
import datetime
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

PC = Path(r"C:\MarvelApps\marvelmagic_pc")
UA = {"User-Agent": "marvel-magic-youtube-free/1.0"}


def key(name, fallback):
    v = os.environ.get(name, "").strip()
    if v:
        return v
    try:
        return fallback()
    except Exception:
        return ""


def wm_key():
    return (PC / "watchmode.key").read_text(encoding="utf-8").strip()


def tmdb_key():
    m = re.search(r"var TMDB = '([0-9a-f]{32})'", (PC / "Code.gs").read_text(encoding="utf-8"))
    return m.group(1) if m else ""


def get(url, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                return json.load(r), r.headers
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None, None
            if e.code == 429:
                time.sleep(3 + 3 * i)
                continue
            if i == tries - 1:
                raise
        except Exception:
            if i == tries - 1:
                raise
        time.sleep(1 + i)
    return None, None


def watchmode_titles(k):
    out, page, pages, quota = [], 1, 1, None
    while page <= pages and page <= 60:
        q = {"apiKey": k, "source_ids": "345", "types": "movie", "regions": "US", "limit": 250, "page": page, "sort_by": "popularity_desc"}
        d, h = get("https://api.watchmode.com/v1/list-titles/?" + urllib.parse.urlencode(q))
        if not d:
            break
        pages = int(d.get("total_pages") or 1)
        out += d.get("titles") or []
        if h is not None:
            quota = (h.get("X-Account-Quota"), h.get("X-Account-Quota-Used"))
        page += 1
    return out, quota


def tmdb_movie(k, tid):
    d, _ = get(f"https://api.themoviedb.org/3/movie/{tid}?" + urllib.parse.urlencode({"api_key": k, "language": "en-US"}))
    return d


def main():
    out_path = Path(sys.argv[1] if len(sys.argv) > 1 else "youtube_free.json")
    wk, tk = key("WATCHMODE_KEY", wm_key), key("TMDB_KEY", tmdb_key)
    if not wk or not tk:   # 11/17: a run without TMDB_KEY once shipped a list with no posters (empty shelf) - both keys or stop
        sys.exit("WATCHMODE_KEY and TMDB_KEY are both needed (GitHub: Settings > Secrets and variables > Actions) - keeping the old files")
    titles, quota = watchmode_titles(wk)
    seen, rows = set(), []
    for t in titles:
        if t.get("type") != "movie" or not t.get("id") or t["id"] in seen:
            continue
        seen.add(t["id"])
        rows.append(t)
    print(f"Watchmode: {len(rows)} free YouTube movies; quota used {quota}")
    if len(rows) < 1000:
        sys.exit(f"only {len(rows)} movies came back - keeping the old {out_path.name}")
    det = {}
    ids = sorted({t["tmdb_id"] for t in rows if t.get("tmdb_id") and t.get("tmdb_type") in (None, "movie")})
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        for tid, d in zip(ids, ex.map(lambda i: tmdb_movie(tk, i), ids)):
            if d:
                det[tid] = d
    print(f"TMDB: details for {len(det)} of {len(ids)}")
    if len(det) < len(ids) * 0.8:   # a bad TMDB key or a TMDB outage: never ship a list without posters
        sys.exit(f"TMDB answered for only {len(det)} of {len(ids)} movies - keeping the old {out_path.name}")
    m = []
    for t in rows:
        d = det.get(t.get("tmdb_id")) or {}
        if d.get("adult"):
            continue
        o = re.sub(r"\s+", " ", d.get("overview") or "").strip()
        if len(o) > 170:
            o = o[:170].rsplit(" ", 1)[0] + "..."
        m.append([t["id"], t.get("title") or "", t.get("year") or 0, t.get("tmdb_id") or 0, d.get("poster_path") or "",
                  [g["id"] for g in d.get("genres") or [] if "id" in g][:3], o, d.get("runtime") or 0])
    doc = {
        "made": datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat(),
        "about": "Marvel Magic - movies free on YouTube in the US, most popular first (tools/build_youtube_free.py, weekly)",
        "credit": "Listings: Watchmode. Posters and summaries: TMDB.",
        "fields": ["wm", "title", "year", "tmdb", "poster", "genres", "summary", "minutes"],
        "count": len(m),
        "m": m,
    }
    out_path.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {out_path} - {len(m)} movies, {out_path.stat().st_size // 1024} KB, {sum(1 for r in m if r[4])} with posters")
    # the shelves only need the most popular few hundred: a small file loads fast on a TV; the full list loads for See all / search
    top_path = out_path.with_name(out_path.stem + "_top.json")
    top = dict(doc, m=[r for r in m if r[4]][:300], count=len(m))
    top_path.write_text(json.dumps(top, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {top_path} - {len(top['m'])} movies, {top_path.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
