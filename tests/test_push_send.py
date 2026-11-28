# test_push_send.py
# Save to: C:\MarvelApps\marvelmagic\tests\test_push_send.py
# The closed-app alert sender's planning (tools/push_send.py plan(), no network): what is due, to which devices, never twice, never a new
# episode from before alerts were turned on, at most MAX_PER_USER a run; and the sender says "not set up yet" without its secrets.
# Run:  python tests\test_push_send.py     (exit 0 = pass)
import os, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import push_send as P

FAILS = []
def check(name, ok, extra=""):
    print(("  PASS  " if ok else "  FAIL  ") + name + ("" if ok else f"  {extra}"))
    if not ok: FAILS.append(name)

MIN = 60000
NOW = 1_800_000_000_000
SUB = lambda n: {'sub': {'endpoint': f'https://push.example/{n}', 'keys': {'p256dh': 'x', 'auth': 'y'}}, 'at': NOW - 24 * 3600000}
EP = {'101': {'ep': {'id': 9001, 'airstamp_ms': NOW - 2 * 3600000, 'label': 'S2 E5 · Pilot'}},     # out 2 h ago
      '102': {'ep': {'id': 9002, 'airstamp_ms': NOW - 30 * 3600000, 'label': 'S1 E1'}},            # out 30 h ago - too old
      '103': {'ep': {'id': 9003, 'airstamp_ms': NOW + 3600000, 'label': 'S3 E1'}}}                 # not out yet
info = lambda sid: EP.get(str(sid))

users = [{'uid': 'u1', 'pushSubs': {'dA': SUB('a'), 'dB': SUB('b')},
          'remind': {'k1': {'title': 'Law & Order', 'when': NOW + 15 * MIN, 'net': 'NBC', 'tab': 0},
                     'k2': {'title': 'Big Game', 'when': NOW + 60 * MIN, 'net': 'ESPN', 'tab': 2},
                     'k3': {'title': 'Started', 'when': NOW - 5 * MIN, 'net': '', 'tab': 0},
                     'k4': {'title': 'Long gone', 'when': NOW - 40 * MIN}},
          'list': [{'id': 101, 'name': 'Tracker'}, {'id': 102, 'name': 'Old'}, {'id': 103, 'name': 'Soon'}]},
         {'uid': 'u2', 'pushSubs': {}, 'remind': {'k1': {'title': 'X', 'when': NOW + 10 * MIN}}, 'list': []},
         {'uid': 'u3', 'pushSubs': {'dC': {**SUB('c'), 'at': NOW - 3600000}}, 'remind': {}, 'list': [{'id': 101, 'name': 'Tracker'}]}]

todo = P.plan(users, NOW, {}, info)
u1 = [t for t in todo if t[0] == 'u1']
bodies = {t[3]['body'] for t in u1}
check("a reminder 15 min out is sent", any('Law & Order starts in 15 minutes on NBC.' == b for b in bodies), bodies)
check("one an hour out is not sent yet", not any('Big Game' in b for b in bodies))
check("one that started 5 min ago still goes (a late run)", any(b.startswith('Started is starting now') for b in bodies), bodies)
check("one that started 40 min ago does not", not any('Long gone' in b for b in bodies))
check("a new episode out 2 hours ago is sent, opening My Stuff", any(t[3]['title'] == 'New episode: Tracker' and t[3]['tab'] == 3 for t in u1))
check("too-old and not-yet-out episodes are not", not any('Old' in t[3]['title'] or 'Soon' in t[3]['title'] for t in u1))
check("every alert goes to every device that turned alerts on", {t[1] for t in u1} == {'dA', 'dB'} and len(u1) == 2 * len({t[4] for t in u1}))
check("an account with no devices gets nothing", not any(t[0] == 'u2' for t in todo))
check("an episode from before alerts were turned on is not sent", not any(t[0] == 'u3' for t in todo))
sent = {t[4]: NOW for t in todo}
check("nothing is sent twice", P.plan(users, NOW + MIN, sent, info) == [])
many = [{'uid': 'u9', 'pushSubs': {'d': SUB('z')}, 'remind': {f'k{i}': {'title': f'S{i}', 'when': NOW + (i + 1) * MIN} for i in range(9)}, 'list': []}]
check("at most MAX_PER_USER alerts per run (the rest next run)", len(P.plan(many, NOW, {}, info)) == P.MAX_PER_USER)
check("the logs never carry a title or id (counts only)", 'print(' in Path(ROOT / 'tools/push_send.py').read_text() and not any(w in ''.join(l for l in Path(ROOT / 'tools/push_send.py').read_text().splitlines() if 'print(' in l) for w in ("['title']", "uid}", "body", "endpoint")))
env = {k: v for k, v in os.environ.items() if k not in ('FIREBASE_SA', 'VAPID_PRIVATE_KEY')}
r = subprocess.run([sys.executable, str(ROOT / 'tools/push_send.py')], capture_output=True, text=True, env=env)
check("without its secrets the sender says so and exits 0", r.returncode == 0 and 'not set up yet' in r.stdout, r.stdout + r.stderr)
print("ALL PASS" if not FAILS else f"{len(FAILS)} FAILED: " + "; ".join(FAILS))
sys.exit(1 if FAILS else 0)
