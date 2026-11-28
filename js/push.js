// js/push.js
// Save to: C:\MarvelApps\marvelmagic\js\push.js
// ALERTS WHEN MARVEL MAGIC IS CLOSED (Scott 11/27: "yes build 4"). A phone, tablet or computer can ask for real notifications that arrive even
// when the app is closed: your show and game reminders (about 20 minutes before) and "new episode out" for shows in My Stuff.
//  - Turned on in Settings -> Alerts (needs Google sign-in: that is how the sender knows whose alerts are whose).
//  - This device's push address (Web Push, keyed by a random device id) is kept in your account with your reminders (users/{uid}: pushSubs,
//    pushOn, remind). Nothing else is added. Turning it off removes this device's address.
//  - The sender is a GitHub Action (.github/workflows/push.yml -> tools/push_send.py) that runs every 5 minutes. It holds the private half
//    of the key below (GitHub secret VAPID_PRIVATE_KEY) and a Firebase service key (secret FIREBASE_SA). sw.js shows what arrives.
//  - The TV apps don't use this (TVs have no notification tray); Marvel says reminders on screen there (tipster.js tipRemind).
"use strict";
const VAPID_PUBLIC = 'BA_hLpVb05Y6yXAES7itSHhRC9CcJy-dS9YRyxYcOEIAgUSAsMkS3biLS02MdWJC7zot_rKVs0TCs1UhYwIesMU';
S.pushSubs = load('pushSubs', {}) || {};
const pushDev = (() => { let d = load('pushDev', ''); if (!d) { d = 'd' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); save('pushDev', d); } return d; })();
const pushCan = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && location.protocol === 'https:' && !(typeof inTvApp === 'function' && inTvApp());
const pushIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !(navigator.standalone || matchMedia('(display-mode: standalone)').matches);
const pushMine = () => !!S.pushSubs[pushDev];
const pushKey = () => { const s = VAPID_PUBLIC.replace(/-/g, '+').replace(/_/g, '/'), b = atob(s + '='.repeat((4 - s.length % 4) % 4)); return Uint8Array.from(b, c => c.charCodeAt(0)); };
let pushBusy = false, pushMsg = '';
async function pushOn() {
  if (pushBusy) return; pushBusy = true; pushMsg = '';
  try {
    if (!me || me.isAnonymous) { pushMsg = 'Sign in with Google first (top of Settings).'; return; }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { pushMsg = 'Notifications are blocked for Marvel Magic on this device. Allow them in your browser or phone settings, then try again.'; return; }
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushKey() });
    S.pushSubs = { ...S.pushSubs, [pushDev]: { sub: sub.toJSON(), at: Date.now(), kind: /Android|iPhone|iPad/.test(navigator.userAgent) ? 'phone' : 'computer' } };
    save('pushSubs', S.pushSubs);
    pushMsg = '✓ On. Alerts come to this device even when Marvel Magic is closed.';
  } catch (e) { pushMsg = 'This device could not turn on alerts (' + ((e && e.message) || 'unknown') + ').'; }
  finally { pushBusy = false; if (S.tab === 10) draw(); }
}
async function pushOff() {
  try { const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch {}
  const n = { ...S.pushSubs }; delete n[pushDev]; S.pushSubs = n; save('pushSubs', S.pushSubs); pushMsg = 'Off on this device.';
  if (S.tab === 10) draw();
}
async function pushCheck() {   // this device says it's on: make sure the browser still has the address (it can drop it); refresh it if it changed
  if (!pushCan() || !pushMine() || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    if (!sub) { const n = { ...S.pushSubs }; delete n[pushDev]; S.pushSubs = n; save('pushSubs', S.pushSubs); return; }
    if (JSON.stringify(sub.toJSON()) !== JSON.stringify(S.pushSubs[pushDev].sub)) { S.pushSubs = { ...S.pushSubs, [pushDev]: { ...S.pushSubs[pushDev], sub: sub.toJSON(), at: Date.now() } }; save('pushSubs', S.pushSubs); }
  } catch {}
}
function pushBox() {   // Settings -> Alerts
  if (typeof inTvApp === 'function' && inTvApp()) return '<p style="margin:0 0 4px"><b>📺 Alerts on this TV</b></p><p class="fine" style="margin:0">Marvel says your reminders on screen while Marvel Magic is open. Alerts while it is closed come to phones and computers (turn them on there); the TV gets them with TV app 1.8.</p>';
  const head = '<p style="margin:0 0 4px"><b>📱 Alerts when Marvel Magic is closed</b></p><p class="fine" style="margin:0 0 8px">Your show and game reminders, and new episodes of shows in My Stuff - even with the app closed.</p>';
  if (pushIos()) return head + '<p class="fine">On iPhone and iPad: first add Marvel Magic to your Home Screen (Share → Add to Home Screen), open it from there, then turn this on.</p>';
  if (!pushCan()) return head + '<p class="fine">This browser can’t get alerts while closed. Chrome on Android, or Chrome / Edge on a computer, can.</p>';
  if (!me || me.isAnonymous) return head + '<p class="fine" style="margin:0 0 8px">Sign in with Google to turn this on - that is how the alerts know they are yours.</p><button class="btn" data-acct2>Sign in with Google</button>';
  const on = pushMine() && Notification.permission === 'granted';
  return head + `<div class="tipsw"><button class="btn ${on ? '' : 'alt'}" data-pushon aria-pressed="${on}">ON</button><button class="btn ${on ? 'alt' : ''}" data-pushoff aria-pressed="${!on}">OFF</button></div>${pushMsg ? `<p class="fine" style="margin-top:6px">${esc(pushMsg)}</p>` : ''}`;
}
document.addEventListener('click', e => {
  const t = e.target.closest && e.target.closest('[data-pushon],[data-pushoff]'); if (!t) return;
  if (t.hasAttribute('data-pushon')) pushOn(); else pushOff();
});
setTimeout(pushCheck, 5000);
// a tapped alert opens its page: ?tab=N on a fresh start, or a message from sw.js when Marvel Magic is already open
addEventListener('load', () => { const m = /[?&]tab=(\d+)/.exec(location.search); if (m && typeof showTab === 'function') showTab(Number(m[1])); });
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.mm === 'tab' && typeof showTab === 'function') showTab(Number(e.data.tab)); });
