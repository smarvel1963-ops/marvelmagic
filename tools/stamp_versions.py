# stamp_versions.py
# Save to: C:\MarvelApps\marvelmagic\tools\stamp_versions.py
# Run after ANY edit to styles.css or a js\*.js file, before pushing (sell-readiness split, 2026-11-15).
# Rewrites each  href="styles.css?v=..."  /  src="js/x.js?v=..."  in index.html to a short hash of that file's contents, so:
#   1. phones, PCs and the Fire TV never run a stale cached script beside a new page, and
#   2. index.html itself changes whenever any part changes - the app's SELF-UPDATE watches index.html, so it still
#      reloads every open screen (Scott's dad's TV) after a push.
# Run:  python tools\stamp_versions.py          (prints what changed; exit 0)
#       python tools\stamp_versions.py --check  (exit 1 if a stamp is out of date - the smoke test runs this)
import hashlib, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VER = re.compile(r'(<meta name="mm-version" content=")([0-9.]+)(">)')
PAT = re.compile(r'((?:href|src)=")((?:styles\.css|js/[\w-]+\.js))\?v=([0-9a-f]*)(")')


def stamp(check=False):
    index = ROOT / 'index.html'
    html = index.read_text(encoding='utf-8')
    stale = []

    def repl(m):
        # line endings ignored: git may check the files out with CRLF, GitHub serves LF - same code, same stamp
        h = hashlib.sha1((ROOT / m.group(2)).read_bytes().replace(b'\r\n', b'\n')).hexdigest()[:10]
        if h != m.group(3):
            stale.append(f'{m.group(2)}: {m.group(3) or "(none)"} -> {h}')
        return f'{m.group(1)}{m.group(2)}?v={h}{m.group(4)}'

    new = PAT.sub(repl, html)
    if check:
        return stale
    if stale:   # 11/27: any code change bumps the version under the clock. Scott: "mm is 1.7" -> <app>.<update>, e.g. 1.7.1, 1.7.2 ...
        def bump(m):   # (the app number - 1.7 - changes only by hand here, when Scott names a new one; the update number then restarts at 1)
            cur = m.group(2); head, _, n = cur.rpartition('.')
            new = f'{head}.{int(n) + 1}'
            stale.append(f'version: {cur} -> {new}')
            return f'{m.group(1)}{new}{m.group(3)}'
        new = VER.sub(bump, new, count=1)
    if new != html:
        index.write_text(new, encoding='utf-8', newline='')
    return stale


if __name__ == '__main__':
    chk = '--check' in sys.argv
    s = stamp(check=chk)
    for line in s:
        print(('STALE ' if chk else 'stamped ') + line)
    if not s:
        print('all stamps current')
    sys.exit(1 if (chk and s) else 0)
