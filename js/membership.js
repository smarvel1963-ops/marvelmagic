// membership.js
// Save to: C:\MarvelApps\marvelmagic\js\membership.js
// THE LOCK (Scott 11/15: "do we have programing on all apps to shut off and just show clickable link or payment windiow?" -> "All paid apps").
// Marvel Magic is 30 days free, then $4.99 a month for the household (Whop "Marvel Magic", prod_jXXGU9TnSIgHR). Until 11/15 nothing
// checked, so it never locked. Now:
//  - the 30 days start the first time this device opens Marvel Magic (a device that had it before this build starts its 30 days now);
//  - after them, the whole app is covered by one screen: the price, a Join button (Whop), a QR code of the same link for a TV, and
//    "Already joined? Enter your email" - checked by the Hub relay (task verify, app marvelmagic; the relay emails a 6-digit code the
//    first time an email is used on a device). A yes keeps this device unlocked; it is re-checked about once a week, and if the check
//    can't be reached the device stays unlocked for 2 more weeks (a relay problem never locks out a paying household).
//  - one membership covers up to 6 TVs and phones (the relay's own household list, separate from the Hub apps).
// Nothing in the app is deleted while it is locked; joining opens everything again.
// v11/21 (Scott "yes" to finishing the paywall): the same screen can be opened before day 30 (Settings 'Unlock with my email',
//  and Whop's ?welcome=1 return after checkout) with a 'Not now' button; a notice shows the last 7 free days, once a day.
(function () {
  const RELAY = 'https://script.google.com/macros/s/AKfycbyVbxOCPR7v8UNTVufOWKOKBpI19-NcWEXMVzjP86iKraxenseHpWL95W9sB_Rr6DXo/exec';
  const JOIN = typeof WHOP_MM === 'string' ? WHOP_MM : 'https://whop.com/commander-marvel-por-picks/marvel-magic';
  const DAY = 86400000, TRIAL_DAYS = 30, RECHECK_DAYS = 7, GRACE_DAYS = 14;
  const K_TRIAL = 'mm.trialStart', K_MEMBER = 'mm.member', K_DEV = 'mm.device';
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode: the lock still works for this visit */ } };
  const escH = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function device() {
    let d = get(K_DEV, '');
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(d)) {
      const a = new Uint8Array(16); (window.crypto || window.msCrypto).getRandomValues(a);
      d = 'mm_' + Array.from(a, x => x.toString(16).padStart(2, '0')).join(''); put(K_DEV, d);
    }
    return d;
  }
  function trialStart() { let t = get(K_TRIAL, 0); if (!(t > 0)) { t = Date.now(); put(K_TRIAL, t); } return t; }
  const daysLeft = () => Math.max(0, TRIAL_DAYS - Math.floor((Date.now() - trialStart()) / DAY));
  const member = () => get(K_MEMBER, null);
  const memberGood = m => !!(m && m.ok && m.buyer && Date.now() < (m.checked || 0) + (RECHECK_DAYS + GRACE_DAYS) * DAY);
  const locked = () => !memberGood(member()) && daysLeft() === 0;

  async function relay(body) {
    const r = await fetch(RELAY, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) });
    return r.json();
  }
  async function verify(buyer) {               // -> 'ok' | 'code' | message to show
    let j; try { j = await relay({ task: 'verify', buyer, device: device(), app: 'marvelmagic' }); } catch (e) { return "Couldn't reach the check - try again in a minute."; }
    if (j.error) return j.error;
    if (j.valid) { put(K_MEMBER, { buyer, ok: true, checked: Date.now(), status: j.status || '', until: j.until || null }); return 'ok'; }
    if (j.status === 'needs code') return 'code';
    const m = member(); if (m && m.buyer === buyer) put(K_MEMBER, Object.assign({}, m, { ok: false, checked: Date.now(), status: j.status || '' }));
    return j.status === 'not found' ? "We couldn't find a Marvel Magic membership for that email. Use the email you joined with." : (j.status || "That email isn't unlocked yet.");
  }

  // ---------------------------------------------------------------- the lock screen
  // v11/18 the pay-to-stay page in the Job / Cooking / Family Hub style (Scott: "build both now same style"): the theater over a
  // positive headline, what this household has actually done in Marvel Magic (real counts from this device, nothing made up),
  // what stays together, the one household price, Keep the Magic, the QR for a TV. Same ids and keys as before, so the TV remote
  // and the unlock steps work exactly as they did. On a wide screen (a TV) the pitch sits left and joining sits right.
  let STEP = 'join', BUYER = '', MSG = '', FORCE = false, HEAD = '';
  const n = k => { try { const v = JSON.parse(localStorage.getItem('mm_' + k)); return Array.isArray(v) ? v.length : 0; } catch (e) { return 0; } };
  function stats() {
    const pl = (c, w, ws) => c === 1 ? w : ws;
    return [[n('history'), '🍿', 'watched', 'watched'], [n('list'), '⭐', 'on My List', 'on My List'], [n('teams'), '🏟️', 'team followed', 'teams followed']]
      .filter(x => x[0] > 0).map(([c, i, w, ws]) => `<span><i aria-hidden="true">${i}</i><b>${c}</b><small>${pl(c, w, ws)}</small></span>`).join('');
  }
  function html() {
    const left = daysLeft(), st = stats(), feat = (i, l) => `<span class="mml-f"><i aria-hidden="true">${i}</i><b>${l}</b></span>`;
    return `<div class="mml-card" role="dialog" aria-modal="true" aria-label="Marvel Magic membership">
      <div class="mml-l"><div class="mml-hero"><img class="mml-heroimg" src="hero_theater.jpg" alt=""><img class="mml-logo" src="logo.png" alt="Marvel Magic"></div>
        <div class="mml-pitchbox"><div class="mml-badge" aria-hidden="true">✨</div>
          <h2>${HEAD || (left ? 'Join Marvel Magic' : 'Keep the magic playing.')}</h2><p class="mml-sub">${memberGood(member()) ? 'This device is unlocked.' : left ? `${left} free day${left === 1 ? '' : 's'} left` : 'Your 30 free days are up.'}</p>
          ${st ? `<div class="mml-stats" aria-label="What your household has done">${st}</div><p class="mml-me">You've made Marvel Magic your own. Keep your guide, your channels and your games together.</p>` : ''}
          <div class="mml-feats">${feat('📺', 'Your TV guide')}${feat('⭐', 'Your channels')}${feat('🏟️', 'Every game on its channel')}${feat('🎬', 'Free movies & shows')}</div></div></div>
      <div class="mml-r">
        <div class="mml-row"><div class="mml-price"><em>ONE PRICE · WHOLE HOUSEHOLD</em><b>$4.99</b><small>a month · cancel any time</small><p>Every TV and phone in your home, up to 6.</p></div>
          <div class="mml-qrbox"><div class="mml-qr" id="mmlQr" aria-label="QR code for joining Marvel Magic"></div><small>On a TV? Scan with your phone to join.</small></div></div>
        <a class="mml-join" href="${escH(JOIN)}" target="_blank" rel="noopener">Keep the Magic - $4.99/month</a>
      ${STEP === 'code' ? `<form class="mml-form" id="mmlCode"><label for="mmlCodeIn">We emailed a 6-digit code to <b>${escH(BUYER)}</b>. Enter it here:</label>
          <div class="mml-in"><input id="mmlCodeIn" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456"><button class="mml-btn">Confirm</button></div></form>`
        : `<form class="mml-form" id="mmlEmail"><label for="mmlEmailIn">Already joined? Enter the email you joined with:</label>
          <div class="mml-in"><input id="mmlEmailIn" type="email" autocomplete="email" placeholder="you@example.com" value="${escH(BUYER)}"><button class="mml-btn">Unlock</button></div></form>`}
      <p class="mml-msg" role="status">${escH(MSG)}</p>
      <p class="mml-safe"><span aria-hidden="true">🔒</span>Everything you set up stays safe on this device. It all opens again the moment you unlock.</p>
      ${FORCE && !locked() ? '<button type="button" class="mml-later" data-mmlclose>Not now</button>' : ''}
    </div></div>`;
  }
  function draw() {
    let el = document.getElementById('mmLock');
    if (!locked() && !FORCE) { if (el) el.remove(); document.documentElement.classList.remove('mm-locked'); return; }
    if (!el) { el = document.createElement('div'); el.id = 'mmLock'; document.body.appendChild(el); }
    document.documentElement.classList.add('mm-locked');
    el.innerHTML = html();
    try { if (window.QRCode) new QRCode(document.getElementById('mmlQr'), { text: JOIN, width: 132, height: 132, colorDark: '#0b0b1a', colorLight: '#ffffff' }); } catch (e) { /* no QR library: the button still works */ }
    const first = el.querySelector(STEP === 'code' ? '#mmlCodeIn' : FORCE && !locked() ? '#mmlEmailIn' : '.mml-join'); if (first) setTimeout(() => first.focus(), 30);
  }
  async function onSubmit(e) {
    const f = e.target; if (!f || !document.getElementById('mmLock') || !document.getElementById('mmLock').contains(f)) return;
    e.preventDefault(); e.stopPropagation();
    const btn = f.querySelector('button'); if (btn) btn.disabled = true;
    if (f.id === 'mmlEmail') {
      BUYER = (document.getElementById('mmlEmailIn').value || '').trim().toLowerCase().slice(0, 190);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(BUYER)) { MSG = 'Enter the email you joined with.'; draw(); return; }
      MSG = 'Checking...'; draw();
      const r = await verify(BUYER);
      if (r === 'ok') { MSG = ''; STEP = 'join'; FORCE = false; HEAD = ''; draw(); notice(); refresh(); return; }
      if (r === 'code') {
        let j; try { j = await relay({ task: 'code', buyer: BUYER, device: device() }); } catch (err) { j = { error: "Couldn't reach the check - try again in a minute." }; }
        if (j && j.sent) { STEP = 'code'; MSG = ''; } else MSG = (j && j.error) || "Couldn't send the code - try again in a minute.";
        draw(); return;
      }
      MSG = r; draw(); return;
    }
    if (f.id === 'mmlCode') {
      const code = (document.getElementById('mmlCodeIn').value || '').replace(/\D/g, '').slice(0, 6);
      if (code.length !== 6) { MSG = 'The code is 6 digits.'; draw(); return; }
      MSG = 'Checking...'; draw();
      let j; try { j = await relay({ task: 'confirm', buyer: BUYER, device: device(), code }); } catch (err) { j = { error: "Couldn't reach the check - try again in a minute." }; }
      if (!j || !j.ok) { MSG = (j && j.error) || "That code didn't work. Check the email, or go back and send a new one."; draw(); return; }
      const r = await verify(BUYER);
      if (r === 'ok') { MSG = ''; STEP = 'join'; FORCE = false; HEAD = ''; draw(); notice(); refresh(); return; }
      MSG = r === 'code' ? 'Please try the code again.' : r; draw();
    }
  }
  // While locked, keys stay inside the lock screen (a TV remote's arrows would otherwise move around the app behind it).
  function onKey(e) {
    const el = document.getElementById('mmLock'); if (!el) return;
    const items = Array.from(el.querySelectorAll('a, button, input')).filter(x => !x.disabled);
    if (!items.length) return;
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) { if (!(document.activeElement && document.activeElement.tagName === 'INPUT' && (e.key === 'ArrowRight'))) { e.preventDefault(); items[(i + 1) % items.length].focus(); } }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) { if (!(document.activeElement && document.activeElement.tagName === 'INPUT' && e.key === 'ArrowLeft')) { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); } }
    else if (e.key === 'Escape' || e.key === 'Backspace' && document.activeElement && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); if (FORCE && !locked()) close(); }
    e.stopPropagation();
  }
  // A member's device re-checks about once a week (quietly; a check that can't be reached changes nothing).
  async function recheck() {
    const m = member(); if (!m || !m.ok || !m.buyer) return;
    if (Date.now() < (m.checked || 0) + RECHECK_DAYS * DAY) return;
    try { const j = await relay({ task: 'verify', buyer: m.buyer, device: device(), app: 'marvelmagic' });
      if (j && !j.error && typeof j.valid === 'boolean') put(K_MEMBER, Object.assign({}, m, { ok: j.valid || j.status === 'needs code', checked: Date.now(), status: j.status || '', until: j.until || null }));
    } catch (e) { /* offline or the relay is down: keep the grace period */ }
    draw();
  }

  // The look lives here so the whole lock is one file: Marvel Magic purple and gold, the theater up top, TV-sized focus rings.
  const CSS = `html.mm-locked, html.mm-locked body { overflow: hidden !important; }
#mmLock { position: fixed; inset: 0; z-index: 2147483000; display: grid; place-items: start center; padding: 16px 12px 24px; overflow-y: auto; box-sizing: border-box;
  background: radial-gradient(circle at 30% 12%, #4a2287, #150a33 55%, #07061a); color: #fff; font-family: "Inter", system-ui, sans-serif; }
#mmLock .mml-card { width: min(560px, 100%); box-sizing: border-box; border-radius: 28px; overflow: hidden; text-align: center;
  background: linear-gradient(180deg, #24124d, #160b36 60%, #0f0828); border: 2px solid rgba(255, 205, 100, .55); box-shadow: 0 30px 80px rgba(0, 0, 0, .55), 0 0 40px rgba(255, 190, 70, .18); }
#mmLock .mml-hero { position: relative; height: 210px; overflow: hidden; }
#mmLock .mml-heroimg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 62%; display: block; }
#mmLock .mml-hero::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(10, 6, 30, .55), rgba(10, 6, 30, 0) 42%, rgba(22, 11, 54, .2) 70%, #24124d); }
#mmLock .mml-logo { position: absolute; z-index: 1; left: 50%; top: 12px; transform: translateX(-50%); height: 64px; width: auto; max-width: 70%; object-fit: contain; filter: drop-shadow(0 4px 12px rgba(0, 0, 0, .6)); }
#mmLock .mml-pitchbox { position: relative; margin: -34px 12px 0; padding: 30px 14px 6px; }
#mmLock .mml-badge { position: absolute; left: 50%; top: -30px; transform: translateX(-50%); width: 60px; height: 60px; border-radius: 50%; display: grid; place-items: center; font-size: 30px;
  background: radial-gradient(circle at 35% 30%, #5b33a8, #24124d); box-shadow: 0 0 0 3px #ffcf5c, 0 6px 18px rgba(255, 190, 70, .4); }
#mmLock h2 { margin: 6px 0 4px; font: 900 30px/1.12 "Inter", system-ui, sans-serif; background: linear-gradient(180deg, #fff1c4, #ffcf5c 60%, #f5a623); -webkit-background-clip: text; background-clip: text; color: transparent; }
#mmLock .mml-sub { margin: 0 0 12px; font-size: 17px; font-weight: 700; color: #ddd3ff; }
#mmLock .mml-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 8px; margin: 0 0 10px; }
#mmLock .mml-stats span { display: grid; justify-items: center; gap: 1px; padding: 10px 6px; border-radius: 18px; background: rgba(255, 255, 255, .07); border: 1px solid rgba(255, 207, 92, .3); }
#mmLock .mml-stats i { font-style: normal; font-size: 22px; } #mmLock .mml-stats b { font-size: 26px; font-weight: 900; line-height: 1; color: #ffe08a; } #mmLock .mml-stats small { font-size: 12px; font-weight: 700; color: #cfc6f5; }
#mmLock .mml-me { margin: 0 4px 12px; font-size: 15px; line-height: 1.45; font-weight: 600; color: #e9e4ff; }
#mmLock .mml-feats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
#mmLock .mml-f { display: flex; align-items: center; gap: 8px; padding: 12px 10px; border-radius: 18px; text-align: left; background: linear-gradient(135deg, rgba(91, 51, 168, .55), rgba(36, 18, 77, .8)); border: 1px solid rgba(255, 255, 255, .12); }
#mmLock .mml-f i { font-style: normal; font-size: 28px; line-height: 1; flex: none; } #mmLock .mml-f b { font-size: 15px; font-weight: 800; line-height: 1.2; color: #fff; }
#mmLock .mml-r { padding: 16px 14px 18px; }
#mmLock .mml-row { display: flex; gap: 12px; align-items: stretch; }
#mmLock .mml-price { position: relative; flex: 1; display: grid; justify-items: center; align-content: center; padding: 18px 10px 12px; border-radius: 20px; border: 2px solid #ffcf5c;
  background: linear-gradient(135deg, rgba(255, 207, 92, .16), rgba(255, 207, 92, .05)); box-shadow: 0 0 22px rgba(255, 190, 70, .2); }
#mmLock .mml-price em { position: absolute; top: -11px; padding: 3px 10px; border-radius: 999px; background: linear-gradient(90deg, #f5a623, #ffcf5c); color: #1a1030; font: 900 10.5px "Inter", sans-serif; letter-spacing: 1px; font-style: normal; white-space: nowrap; }
#mmLock .mml-price b { font-size: 44px; font-weight: 900; line-height: 1; color: #fff; } #mmLock .mml-price small { font-size: 14px; font-weight: 800; color: #ffcf5c; }
#mmLock .mml-price p { margin: 6px 0 0; font-size: 13.5px; line-height: 1.35; font-weight: 600; color: #ddd3ff; }
#mmLock .mml-qrbox { flex: none; display: grid; justify-items: center; align-content: center; gap: 6px; width: 150px; }
#mmLock .mml-qrbox small { font-size: 11.5px; line-height: 1.3; color: #cfc6f5; }
#mmLock .mml-qr { background: #fff; padding: 8px; border-radius: 14px; width: 132px; height: 132px; box-sizing: content-box; border: 2px solid #ffcf5c; }
#mmLock .mml-qr img, #mmLock .mml-qr canvas { display: block; }
#mmLock .mml-join { display: block; margin-top: 16px; padding: 16px; border-radius: 999px; text-decoration: none; font-weight: 900; font-size: 20px; color: #1a1030;
  background: linear-gradient(180deg, #ffe08a, #ffc53d 55%, #f0a020); box-shadow: 0 8px 22px rgba(240, 160, 32, .4), inset 0 1px 0 rgba(255, 255, 255, .5); }
#mmLock a:focus, #mmLock button:focus, #mmLock input:focus { outline: 3px solid #7fd8ff; outline-offset: 3px; }
#mmLock .mml-form { margin: 18px 0 0; text-align: left; }
#mmLock .mml-form label { display: block; font-size: 14px; color: #cfc8f0; margin-bottom: 6px; }
#mmLock .mml-in { display: flex; gap: 8px; }
#mmLock .mml-in input { flex: 1; min-width: 0; padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, .25); background: rgba(255, 255, 255, .08); color: #fff; font-size: 16px; }
#mmLock .mml-btn { padding: 12px 18px; border-radius: 12px; border: 0; background: #7fd8ff; color: #0b0b1a; font-weight: 800; font-size: 16px; cursor: pointer; }
#mmLock .mml-btn:disabled { opacity: .6; }
#mmLock .mml-msg { min-height: 1.2em; margin: 10px 0 0; color: #ffd76a; font-weight: 700; }
#mmLock .mml-safe { display: flex; align-items: center; justify-content: center; gap: 10px; margin: 8px 0 0; padding: 12px; border-radius: 16px; background: rgba(255, 255, 255, .06);
  font-size: 13px; line-height: 1.4; color: #cfc6f5; text-align: left; }
#mmLock .mml-safe span { font-size: 20px; }
#mmLock .mml-later { display: block; margin: 12px auto 0; padding: 10px 22px; border-radius: 999px; border: 1px solid rgba(255, 255, 255, .3); background: transparent; color: #ddd3ff; font-weight: 800; font-size: 15px; cursor: pointer; }
#mmTrialNote { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 2147482000; width: min(720px, calc(100% - 24px)); box-sizing: border-box;
  display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 18px; background: linear-gradient(135deg, #2b1560, #1a0d3d); color: #fff;
  border: 2px solid rgba(255, 205, 100, .6); box-shadow: 0 12px 34px rgba(0, 0, 0, .5); font: 600 15px/1.35 "Inter", system-ui, sans-serif; }
#mmTrialNote span { flex: 1; } #mmTrialNote b { color: #ffe08a; }
#mmTrialNote a { flex: none; padding: 9px 14px; border-radius: 999px; text-decoration: none; font-weight: 900; color: #1a1030; background: linear-gradient(180deg, #ffe08a, #f0a020); }
#mmTrialNote button { flex: none; width: 34px; height: 34px; border-radius: 50%; border: 0; background: rgba(255, 255, 255, .12); color: #fff; font-size: 16px; cursor: pointer; }
#mmTrialNote a:focus, #mmTrialNote button:focus { outline: 3px solid #7fd8ff; outline-offset: 2px; }
@media (max-width: 560px) { #mmTrialNote { flex-wrap: wrap; bottom: 76px; } #mmTrialNote span { flex-basis: calc(100% - 46px); } }
@media (max-width: 380px) { #mmLock .mml-row { flex-direction: column; align-items: center; } #mmLock .mml-qrbox { width: auto; } #mmLock h2 { font-size: 26px; } }
@media (min-width: 900px) and (orientation: landscape) {
  #mmLock { place-items: center; }
  #mmLock .mml-card { width: min(1080px, 96vw); display: grid; grid-template-columns: 1.05fr 1fr; text-align: center; }
  #mmLock .mml-l { display: flex; flex-direction: column; border-right: 1px solid rgba(255, 207, 92, .25); }
  #mmLock .mml-r { display: flex; flex-direction: column; justify-content: center; padding: 24px 24px; }
}
@media (max-width: 560px) { #mmLock .mml-qrbox { display: none; } }   /* a phone can't scan its own screen */`;
  if (!document.getElementById('mmLockCss')) { const st = document.createElement('style'); st.id = 'mmLockCss'; st.textContent = CSS; document.head.appendChild(st); }

  // Open the join / unlock screen before the lock (Settings, or back from Whop checkout). 'Not now' or Escape closes it.
  function open(head, msg) { FORCE = true; HEAD = head || ''; MSG = msg || ''; STEP = 'join'; draw(); }
  function close() { FORCE = false; HEAD = ''; MSG = ''; STEP = 'join'; draw(); }
  function refresh() { try { if (typeof window.draw === 'function' && typeof S === 'object' && S.tab === 10) { const y = window.scrollY; window.draw(); window.scrollTo(0, y); } } catch (e) { /* Settings redraws next time it opens */ } }
  document.addEventListener('click', e => { const b = e.target && e.target.closest && e.target.closest('[data-mmlclose]'); if (b) { e.preventDefault(); close(); } }, true);
  // The last 7 free days: a small notice once a day (not on a member's device, not while the lock is up). Tap Join or the X.
  const K_NOTE = 'mm.trialNote';
  function notice() {
    let el = document.getElementById('mmTrialNote');
    const left = daysLeft(), today = new Date().toDateString();
    if (memberGood(member()) || locked() || left > 7 || get(K_NOTE, '') === today) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'mmTrialNote'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.innerHTML = `<span>✨ <b>${left} free day${left === 1 ? '' : 's'} left</b> in Marvel Magic. Keep it for $4.99 a month for the whole home.</span>
      <a href="${escH(JOIN)}" target="_blank" rel="noopener">Keep the Magic</a><button type="button" aria-label="Close">✕</button>`;
    el.querySelector('button').onclick = () => { put(K_NOTE, today); el.remove(); };
    el.querySelector('a').onclick = () => put(K_NOTE, today);
  }
  // Whop sends buyers back with ?welcome=1: ask for the joined email once, then take the flag out of the address bar.
  function welcome() {
    if (!/[?&]welcome=1\b/.test(location.search)) return;
    try { const u = new URL(location.href); u.searchParams.delete('welcome'); history.replaceState(null, '', u.pathname + (u.search || '') + u.hash); } catch (e) { /* old browser: the flag just stays */ }
    if (memberGood(member())) return;
    open('Welcome to Marvel Magic!', '');
    MSG = 'Enter the email you joined with to unlock this device.'; draw();
  }

  window.mmMembership = { daysLeft, locked, member: () => member(), memberGood: () => memberGood(member()), draw, open, close };
  document.addEventListener('submit', onSubmit, true);
  document.addEventListener('keydown', onKey, true);
  // While the screen is up, focus never sits behind it (the app's own TV focus moves to a poster after a redraw): pull it back.
  document.addEventListener('focusin', e => {
    const el = document.getElementById('mmLock'); if (!el || el.contains(e.target)) return;
    const first = el.querySelector(STEP === 'code' ? '#mmlCodeIn' : FORCE && !locked() ? '#mmlEmailIn' : '.mml-join'); if (first) first.focus();
  }, true);
  trialStart();
  const start = () => { welcome(); draw(); notice(); recheck(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  setInterval(draw, 60 * 60 * 1000);           // left open past day 30 (a TV that never closes): the lock appears within the hour
})();
