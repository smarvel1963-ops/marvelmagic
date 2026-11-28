# push_send.py
# Save to: C:\MarvelApps\marvelmagic\tools\push_send.py
# ALERTS WHEN MARVEL MAGIC IS CLOSED - the sender (Scott 11/27: "yes build 4"). Run by .github/workflows/push.yml every 5 minutes.
#  1. reads the Marvel Magic accounts that turned alerts on (Firestore users/{uid} where pushOn == true) with a Firebase service key;
#  2. finds what is due: a show / game reminder starting within REMIND_AHEAD minutes (or started in the last 10), and a new episode of a show
#     in My Stuff that came out in the last NEW_EP_HOURS hours (TVmaze, free) - never one that came out before alerts were turned on;
#  3. sends each one to every device that turned alerts on (Web Push, signed with the private VAPID key), at most MAX_PER_USER a run;
#  4. remembers what it sent (push_state.json, kept between runs in the GitHub Actions cache) so nothing is sent twice;
#  5. a device whose address is gone (404 / 410) is taken off the account.
# The repo is public, so its logs are public: this prints COUNTS only - never a show, a name, an id or an address.
# Secrets (GitHub): FIREBASE_SA = the service account JSON; VAPID_PRIVATE_KEY = the PEM. Missing secrets = says so and exits 0 (not set up yet).
# Run:  python tools/push_send.py [--dry]        (--dry: works out what is due and prints the counts, sends nothing, saves nothing)
import hashlib, json, os, sys, time
import urllib.request, urllib.error

PROJECT = 'marvel-magic'
REMIND_AHEAD = 22          # minutes: GitHub's timer can run late, so a reminder goes out up to 22 min before
REMIND_LATE = 10           # still send one that started up to 10 min ago (a late run)
NEW_EP_HOURS = 8
MAX_PER_USER = 5
STATE = 'push_state.json'
VAPID_SUB = 'https://smarvel1963-ops.github.io'   # the contact claim push services ask for: a plain https site, no path (py_vapid's rule), no personal email
FS = f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents'


# ---- Firestore values ---------------------------------------------------------------------------------------------------------------
def val(v):
    if v is None: return None
    for k in ('stringValue', 'booleanValue'):
        if k in v: return v[k]
    if 'integerValue' in v: return int(v['integerValue'])
    if 'doubleValue' in v: return float(v['doubleValue'])
    if 'timestampValue' in v: return v['timestampValue']
    if 'nullValue' in v: return None
    if 'mapValue' in v: return {k: val(x) for k, x in (v['mapValue'].get('fields') or {}).items()}
    if 'arrayValue' in v: return [val(x) for x in (v['arrayValue'].get('values') or [])]
    return None


def h(*parts):
    return hashlib.sha1('|'.join(str(p) for p in parts).encode()).hexdigest()[:20]


# ---- what is due (pure: tested by tests/test_push_send.py) -----------------------------------------------------------------------------
def plan(users, now_ms, sent, show_info):
    """users: [{uid, pushSubs: {dev: {sub, at}}, remind: {k: {title, when, net, tab}}, list: [{id, name}]}]
       show_info(id) -> {'ep': {'id', 'airstamp_ms', 'label'}} or None.  Returns [(uid, dev, sub, payload, key)]."""
    out = []
    for u in users:
        subs = {d: s for d, s in (u.get('pushSubs') or {}).items() if isinstance(s, dict) and isinstance(s.get('sub'), dict) and s['sub'].get('endpoint')}
        if not subs: continue
        since = min((s.get('at') or now_ms) for s in subs.values())
        msgs = []
        for k, r in sorted((u.get('remind') or {}).items(), key=lambda kv: (kv[1] or {}).get('when') or 0):
            if not isinstance(r, dict) or not r.get('when'): continue
            left = (int(r['when']) - now_ms) / 60000
            if -REMIND_LATE < left <= REMIND_AHEAD:
                key = h(u['uid'], 'r', k, r['when'])
                if key in sent: continue
                mins = round(left)
                body = (r.get('title') or 'Your show') + (f' starts in {mins} minute' + ('' if mins == 1 else 's') if mins > 0 else ' is starting now') + (f" on {r['net']}" if r.get('net') else '')
                msgs.append(({'title': '🔔 Starting soon', 'body': body + '.', 'tab': r.get('tab') if r.get('tab') is not None else 0, 'tag': 'r' + key[:8]}, key))
        for s in (u.get('list') or []):
            if not isinstance(s, dict) or not s.get('id'): continue
            info = show_info(s['id'])
            ep = info and info.get('ep')
            if not ep or not ep.get('airstamp_ms'): continue
            a = ep['airstamp_ms']
            if not (now_ms - NEW_EP_HOURS * 3600000 <= a <= now_ms) or a < since: continue
            key = h(u['uid'], 'e', s['id'], ep.get('id'))
            if key in sent: continue
            msgs.append(({'title': 'New episode: ' + (s.get('name') or 'your show'), 'body': (ep.get('label') or 'A new episode') + ' is out now.', 'tab': 3, 'tag': 'e' + key[:8]}, key))
        for payload, key in msgs[:MAX_PER_USER]:
            for dev, s in subs.items():
                out.append((u['uid'], dev, s['sub'], payload, key))
    return out


# ---- live run ----------------------------------------------------------------------------------------------------------------------
def token(sa_json):
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request
    cred = service_account.Credentials.from_service_account_info(json.loads(sa_json), scopes=['https://www.googleapis.com/auth/datastore'])
    cred.refresh(Request()); return cred.token


def http(method, url, tok=None, body=None):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Content-Type': 'application/json', **({'Authorization': 'Bearer ' + tok} if tok else {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read() or b'null')


def users_on(tok):
    q = {'structuredQuery': {'from': [{'collectionId': 'users'}], 'where': {'fieldFilter': {'field': {'fieldPath': 'pushOn'}, 'op': 'EQUAL', 'value': {'booleanValue': True}}}}}
    rows = http('POST', FS + ':runQuery', tok, q) or []
    out = []
    for r in rows:
        d = r.get('document')
        if not d: continue
        f = {k: val(v) for k, v in (d.get('fields') or {}).items()}
        out.append({'uid': d['name'].rsplit('/', 1)[1], 'pushSubs': f.get('pushSubs') or {}, 'remind': f.get('remind') or {}, 'list': f.get('list') or []})
    return out


SHOWS = {}
def show_info(sid):
    if sid in SHOWS: return SHOWS[sid]
    info = None
    try:
        time.sleep(0.6)   # TVmaze: 20 calls / 10 s
        j = json.loads(urllib.request.urlopen(f'https://api.tvmaze.com/shows/{int(sid)}?embed=previousepisode', timeout=20).read())
        p = (j.get('_embedded') or {}).get('previousepisode')
        if p and p.get('airstamp'):
            from datetime import datetime
            a = int(datetime.fromisoformat(p['airstamp'].replace('Z', '+00:00')).timestamp() * 1000)
            info = {'ep': {'id': p.get('id'), 'airstamp_ms': a, 'label': f"S{p.get('season')} E{p.get('number')}" + (f" · {p['name']}" if p.get('name') else '')}}
    except Exception:
        info = None
    SHOWS[sid] = info
    return info


def drop_device(tok, uid, dev, left):
    mask = f'updateMask.fieldPaths=pushSubs.{dev}' + ('' if left else '&updateMask.fieldPaths=pushOn')
    body = {'fields': {} if left else {'pushOn': {'booleanValue': False}}}
    http('PATCH', f'{FS}/users/{uid}?{mask}', tok, body)


def main():
    dry = '--dry' in sys.argv
    sa, vapid = os.environ.get('FIREBASE_SA', '').strip(), os.environ.get('VAPID_PRIVATE_KEY', '').strip()
    if not sa or not vapid:
        print('push: not set up yet (FIREBASE_SA / VAPID_PRIVATE_KEY secrets missing) - nothing sent'); return 0
    state = {'sent': {}}
    try: state = json.load(open(STATE))
    except Exception: pass
    now = int(time.time() * 1000)
    state['sent'] = {k: t for k, t in (state.get('sent') or {}).items() if now - t < 3 * 86400000}
    tok = token(sa)
    users = users_on(tok)
    todo = plan(users, now, state['sent'], show_info)
    print(f'push: {len(users)} account(s) with alerts on, {len({k for *_, k in todo})} alert(s) due, {len(todo)} send(s)')
    if dry: return 0
    from pywebpush import webpush, WebPushException
    from py_vapid import Vapid
    vapid = Vapid.from_pem(vapid.encode()) if 'BEGIN' in vapid else Vapid.from_string(vapid)   # the secret is the PEM file as saved; the library wants a key object
    ok = gone = bad = 0
    dead = {}
    for uid, dev, sub, payload, key in todo:
        try:
            webpush(subscription_info=sub, data=json.dumps(payload), vapid_private_key=vapid, vapid_claims={'sub': VAPID_SUB}, ttl=3600)
            ok += 1; state['sent'][key] = now
        except WebPushException as e:
            code = getattr(getattr(e, 'response', None), 'status_code', 0)
            if code in (404, 410): gone += 1; dead.setdefault(uid, set()).add(dev); state['sent'][key] = now
            else: bad += 1
        except Exception:
            bad += 1
    for u in users:
        for dev in dead.get(u['uid'], ()):
            left = len([d for d in (u.get('pushSubs') or {}) if d not in dead[u['uid']]])
            try: drop_device(tok, u['uid'], dev, left)
            except Exception: bad += 1
    json.dump(state, open(STATE, 'w'))
    print(f'push: sent {ok}, devices gone {gone}, failed {bad}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
