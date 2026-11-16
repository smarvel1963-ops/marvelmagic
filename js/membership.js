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
  let STEP = 'join', BUYER = '', MSG = '';
  function html() {
    const left = daysLeft();
    return `<div class="mml-card" role="dialog" aria-modal="true" aria-label="Marvel Magic membership">
      <img class="mml-logo" src="logo.png" alt="Marvel Magic">
      <h2>${left ? 'Join Marvel Magic' : 'Your 30 free days are up'}</h2>
      <p class="mml-pitch">Marvel Magic is <b>$4.99 a month</b> for your whole household - every TV and phone. Your guide, your channels and every game on its channel. Cancel any time.</p>
      <div class="mml-row">
        <div class="mml-go"><a class="mml-join" href="${escH(JOIN)}" target="_blank" rel="noopener">Join Marvel Magic - $4.99/month</a>
          <p class="mml-fine">On a TV? Scan the code with your phone to join.</p></div>
        <div class="mml-qr" id="mmlQr" aria-label="QR code for joining Marvel Magic"></div>
      </div>
      ${STEP === 'code' ? `<form class="mml-form" id="mmlCode"><label for="mmlCodeIn">We emailed a 6-digit code to <b>${escH(BUYER)}</b>. Enter it here:</label>
          <div class="mml-in"><input id="mmlCodeIn" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456"><button class="mml-btn">Confirm</button></div></form>`
        : `<form class="mml-form" id="mmlEmail"><label for="mmlEmailIn">Already joined? Enter the email you joined with:</label>
          <div class="mml-in"><input id="mmlEmailIn" type="email" autocomplete="email" placeholder="you@example.com" value="${escH(BUYER)}"><button class="mml-btn">Unlock</button></div></form>`}
      <p class="mml-msg" role="status">${escH(MSG)}</p>
      <p class="mml-fine">Everything you set up is safe on this device and opens again the moment you unlock.</p>
    </div>`;
  }
  function draw() {
    let el = document.getElementById('mmLock');
    if (!locked()) { if (el) el.remove(); document.documentElement.classList.remove('mm-locked'); return; }
    if (!el) { el = document.createElement('div'); el.id = 'mmLock'; document.body.appendChild(el); }
    document.documentElement.classList.add('mm-locked');
    el.innerHTML = html();
    try { if (window.QRCode) new QRCode(document.getElementById('mmlQr'), { text: JOIN, width: 168, height: 168, colorDark: '#0b0b1a', colorLight: '#ffffff' }); } catch (e) { /* no QR library: the button still works */ }
    const first = el.querySelector(STEP === 'code' ? '#mmlCodeIn' : '.mml-join'); if (first) setTimeout(() => first.focus(), 30);
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
      if (r === 'ok') { MSG = ''; STEP = 'join'; draw(); return; }
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
      if (r === 'ok') { MSG = ''; STEP = 'join'; draw(); return; }
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
    else if (e.key === 'Escape' || e.key === 'Backspace' && document.activeElement && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); }
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

  // The look lives here so the whole lock is one file (dark Marvel Magic purple, gold Join button, TV-sized focus rings).
  const CSS = `html.mm-locked, html.mm-locked body { overflow: hidden !important; }
#mmLock { position: fixed; inset: 0; z-index: 2147483000; display: grid; place-items: center; padding: 20px 16px; overflow-y: auto; box-sizing: border-box;
  background: radial-gradient(circle at 30% 18%, #3a1d6e, #0b0b1a 72%); color: #fff; }
#mmLock .mml-card { width: min(640px, 100%); box-sizing: border-box; background: rgba(20, 16, 40, .94); border: 1px solid rgba(255, 215, 120, .35); border-radius: 24px;
  padding: 26px 24px; text-align: center; box-shadow: 0 30px 80px rgba(0, 0, 0, .5); }
#mmLock .mml-logo { height: 84px; width: auto; max-width: 260px; border-radius: 14px; object-fit: contain; }
#mmLock h2 { margin: 12px 0 8px; font-size: 28px; line-height: 1.2; }
#mmLock .mml-pitch { margin: 0 0 18px; line-height: 1.5; color: #e9e4ff; }
#mmLock .mml-row { display: flex; gap: 18px; align-items: center; justify-content: center; flex-wrap: wrap; }
#mmLock .mml-go { flex: 1 1 240px; }
#mmLock .mml-join { display: block; padding: 16px; border-radius: 999px; background: linear-gradient(135deg, #ffd76a, #f5a623); color: #1a1030; font-weight: 900; font-size: 18px; text-decoration: none; }
#mmLock a:focus, #mmLock button:focus, #mmLock input:focus { outline: 3px solid #7fd8ff; outline-offset: 3px; }
#mmLock .mml-qr { background: #fff; padding: 10px; border-radius: 14px; width: 168px; height: 168px; box-sizing: content-box; }
#mmLock .mml-qr img, #mmLock .mml-qr canvas { display: block; }
#mmLock .mml-form { margin: 20px 0 0; text-align: left; }
#mmLock .mml-form label { display: block; font-size: 14px; color: #cfc8f0; margin-bottom: 6px; }
#mmLock .mml-in { display: flex; gap: 8px; }
#mmLock .mml-in input { flex: 1; min-width: 0; padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, .25); background: rgba(255, 255, 255, .08); color: #fff; font-size: 16px; }
#mmLock .mml-btn { padding: 12px 18px; border-radius: 12px; border: 0; background: #7fd8ff; color: #0b0b1a; font-weight: 800; font-size: 16px; cursor: pointer; }
#mmLock .mml-btn:disabled { opacity: .6; }
#mmLock .mml-msg { min-height: 1.2em; margin: 10px 0 0; color: #ffd76a; font-weight: 700; }
#mmLock .mml-fine { margin: 10px 0 0; font-size: 13px; color: #b9b2dc; }
@media (max-width: 560px) { #mmLock .mml-qr { display: none; } #mmLock h2 { font-size: 24px; } }`;
  if (!document.getElementById('mmLockCss')) { const st = document.createElement('style'); st.id = 'mmLockCss'; st.textContent = CSS; document.head.appendChild(st); }

  window.mmMembership = { daysLeft, locked, member: () => member(), draw };
  document.addEventListener('submit', onSubmit, true);
  document.addEventListener('keydown', onKey, true);
  trialStart();
  const start = () => { draw(); recheck(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  setInterval(draw, 60 * 60 * 1000);           // left open past day 30 (a TV that never closes): the lock appears within the hour
})();
