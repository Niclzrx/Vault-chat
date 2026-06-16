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
  if (!/[A-Z]/.test(pass)) return 'Precisa de pelo menos 1 letra maiúscula.';
  if (!/[0-9]/.test(pass)) return 'Precisa de pelo menos 1 número.';
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(pass)) return 'Precisa de pelo menos 1 símbolo (!@#$%^&*).';
  return null;
}
function pad(n) { return String(n).padStart(2, '0'); }
function fmtTime() { const n = new Date(); return pad(n.getHours()) + ':' + pad(n.getMinutes()) + ':' + pad(n.getSeconds()); }
function fmtDate() { return new Date().toLocaleDateString('pt-BR'); }
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
  // Clear previous timer
  if (_toastTimer) {
    clearTimeout(_toastTimer);
    _toastTimer = null;
  }
  // Remove previous toast
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
      if (AppUser) {
        const msgCount = await API.get('/api/users/unread');
        if (msgCount.ok) {
          const total = Object.values(msgCount.counts).reduce((a, b) => a + b, 0);
          setEl('tk-msgs', total);
        }
      }
    } catch (_) {}
  }, 30000);
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function avatarHTML(avatar, color, name, size) {
  const sz = size || 34;
  const fontSize = Math.max(9, Math.round(sz * 0.32));
  const initials = sanitize((name || '?')[0] || '?');
  if (avatar && avatar.startsWith('data:')) {
    return `<div class="contact-avatar" style="background:${color || 'var(--bg4)'};width:${sz}px;height:${sz}px;min-width:${sz}px"><img class="avatar-img" src="${avatar}" alt="${initials}"/></div>`;
  }
  return `<div class="contact-avatar" style="background:${color || 'var(--bg4)'};width:${sz}px;height:${sz}px;min-width:${sz}px;font-size:${fontSize}px">${initials}</div>`;
}

/* ── Mobile Virtual Keyboard Handler ── */
(function() {
  if (!window.visualViewport) return;
  const isMobile = () => window.innerWidth <= 768;

  function adjustLayout() {
    if (!isMobile()) {
      document.querySelectorAll('.chat-main, .group-chat').forEach(el => {
        el.style.height = '';
        el.style.maxHeight = '';
      });
      document.querySelectorAll('.chat-msgs').forEach(el => {
        el.style.maxHeight = '';
      });
      return;
    }

    const vv = window.visualViewport;
    const activePage = document.querySelector('.page.active');
    if (!activePage) return;

    const nav = activePage.querySelector('nav');
    const navH = nav ? nav.offsetHeight : 52;
    const avail = vv.height - navH;

    activePage.style.height = avail + 'px';

    const dash = activePage.querySelector('.dash');
    if (dash) {
      dash.style.height = '100%';
      dash.style.overflow = 'hidden';
    }

    const chatMain = activePage.querySelector('.chat-main');
    if (chatMain) {
      chatMain.style.height = '100%';
      chatMain.style.overflow = 'hidden';
      const chatMsgs = chatMain.querySelector('.chat-msgs');
      const chatInput = chatMain.querySelector('.chat-input-area');
      const chatHeader = chatMain.querySelector('.chat-header');
      const chatFooter = chatMain.querySelector('.chat-footer-note');
      if (chatMsgs && chatInput) {
        const headerH = chatHeader ? chatHeader.offsetHeight : 0;
        const inputH = chatInput.offsetHeight;
        const footerH = chatFooter ? chatFooter.offsetHeight : 0;
        chatMsgs.style.maxHeight = Math.max(avail - headerH - inputH - footerH - 20, 100) + 'px';
        chatMsgs.scrollTop = chatMsgs.scrollHeight;
      }
    }
  }

  window.visualViewport.addEventListener('resize', adjustLayout);
  window.visualViewport.addEventListener('scroll', adjustLayout);
  window.addEventListener('resize', adjustLayout);

  document.addEventListener('focusin', function(e) {
    if (e.target && (e.target.id === 'chat-input' || e.target.tagName === 'TEXTAREA')) {
      setTimeout(adjustLayout, 100);
      setTimeout(adjustLayout, 350);
    }
  });
  document.addEventListener('focusout', function(e) {
    if (e.target && (e.target.id === 'ai-input' || e.target.id === 'chat-input' || e.target.tagName === 'TEXTAREA')) {
      setTimeout(adjustLayout, 100);
    }
  });
})();
