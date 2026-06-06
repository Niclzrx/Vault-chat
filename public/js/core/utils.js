'use strict';

/* global API, AppUser, AppAdmin */

const SEC = {
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_MS: 15 * 60 * 1000,
  SESSION_TIMEOUT_MS: 30 * 60 * 1000,
  MIN_PASSWORD_LEN: 8,
  ADMIN_CLICK_REQUIRED: 20,
  ADMIN_CLICK_TIMEOUT_MS: 8000,
};

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>"'&]/g, c => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' }[c]));
}
function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function validatePassword(pass) {
  if (pass.length < SEC.MIN_PASSWORD_LEN) return 'Mínimo ' + SEC.MIN_PASSWORD_LEN + ' caracteres.';
  if (!/[A-Z]/.test(pass) && !/[0-9]/.test(pass)) return 'Use letras maiúsculas ou números.';
  return null;
}
function pad(n) { return String(n).padStart(2, '0'); }
function fmtTime() { const n = new Date(); return pad(n.getHours()) + ':' + pad(n.getMinutes()) + ':' + pad(n.getSeconds()); }
function fmtDate() { return new Date().toLocaleDateString('pt-BR'); }
function fmtSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}
function fmtFileIcon(type, name) {
  if (type.startsWith('image/')) return '🖼';
  if (type.startsWith('video/')) return '🎬';
  if (type.startsWith('audio/')) return '🎵';
  if (type === 'application/pdf') return '📄';
  if (name.endsWith('.txt') || name.endsWith('.md')) return '📝';
  if (name.endsWith('.zip') || name.endsWith('.rar')) return '📦';
  if (name.endsWith('.json') || name.endsWith('.js') || name.endsWith('.ts')) return '⊡';
  return '▣';
}
function fmtBanTime(bannedUntil) {
  if (!bannedUntil) return 'Permanente';
  const diff = bannedUntil - Date.now();
  if (diff <= 0) return 'Expirado';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 24) return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
  return h + 'h ' + m + 'm';
}
function showErr(id, msg) { const el = document.getElementById(id); if (el) el.innerHTML = '<div class="err">⚠ ' + sanitize(msg) + '</div>'; }
function showOk(id, msg) { const el = document.getElementById(id); if (el) el.innerHTML = '<div class="ok">✔ ' + sanitize(msg) + '</div>'; }
function showInfo(id, msg) { const el = document.getElementById(id); if (el) el.innerHTML = '<div class="info">ℹ ' + sanitize(msg) + '</div>'; }
function clrMsg(id) { const el = document.getElementById(id); if (el) el.innerHTML = ''; }

let _toastTimer;
function toast(msg, type = 'info') {
  document.querySelectorAll('.notif-toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = 'notif-toast';
  const icon = type === 'err' ? '✖' : type === 'ok' ? '✔' : type === 'warn' ? '⚠' : 'ℹ';
  const color = type === 'err' ? 'var(--danger)' : type === 'ok' ? 'var(--ok)' : type === 'warn' ? 'var(--warn)' : 'var(--info)';
  t.style.borderLeft = '3px solid ' + color;
  t.innerHTML = '<span style="color:' + color + ';font-size:.88rem;flex-shrink:0">' + icon + '</span><span>' + sanitize(msg) + '</span>';
  document.body.appendChild(t);
  _toastTimer = setTimeout(() => { t.className = 'notif-toast hide'; setTimeout(() => t.remove(), 280); }, 3500);
}

function togglePw(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  el.type = el.type === 'password' ? 'text' : 'password';
  btn.textContent = el.type === 'password' ? '◎' : '🙈';
}

function go(id) {
  document.querySelectorAll('.page').forEach(p => { p.classList.remove('active'); p.style.display = ''; });
  const page = document.getElementById(id);
  if (page) page.classList.add('active');
  updateTicker();
  window.scrollTo(0, 0);
}

let _tickerInterval = null;
function updateTicker() {
  if (_tickerInterval) return;
  _tickerInterval = setInterval(async () => {
    try {
      if (AppUser || AppAdmin) {
        const res = await API.get('/api/users');
        if (res.ok) {
          const on = res.users.filter(u => u.online).length + (AppUser?.online ? 1 : 0);
          const total = res.users.length + 1;
          setEl('tk-total', total);
          setEl('tk-online', on);
          setEl('tk-on', '● ' + on + ' online');
        }
      }
      const msgRes = await API.get('/api/auth/me');
      if (msgRes.ok && msgRes.type === 'user') {
        const msgCount = await API.get('/api/users/unread');
        if (msgCount.ok) {
          const total = Object.values(msgCount.counts).reduce((a, b) => a + b, 0);
          setEl('tk-msgs', total);
        }
      }
    } catch (_) {}
  }, 10000);
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
