'use strict';

/* global API, AppUser, AppSocket, sanitize, fmtTime, toast, setEl, go, setUSideActive */

function uSec(section) {
  if (typeof stopChatPool === 'function') stopChatPool();
  if (typeof stopGrpPool === 'function') stopGrpPool();
  setUSideActive(section);
  const el = document.getElementById('u-main');
  if (!el) return;
  el.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--t3)">▸ carregando...</div>';
  if (!AppUser) return;
  switch (section) {
    case 'home': renderHome(AppUser, el); break;
    case 'chat': renderChat(AppUser, el); break;
    case 'groups': renderGroups(AppUser, el); break;
    case 'files': renderFiles(AppUser, el); break;
    case 'notif': renderNotif(AppUser, el); break;
    case 'profile': renderProfile(AppUser, el); break;
    case 'settings': renderSettings(AppUser, el); break;
    case 'crypto': renderCryptoPage(el); break;
    case 'history': renderHistory(AppUser, el); break;
  }
}

function setUSideActive(s) {
  ['home', 'chat', 'groups', 'files', 'notif', 'profile', 'settings', 'history', 'crypto'].forEach(x => {
    document.getElementById('si-' + x)?.classList.toggle('on', x === s);
  });
}

function openUserDash() {
  if (!AppUser) return;
  const badge = document.getElementById('u-badge');
  if (badge) {
    if (AppUser.admin_granted) {
      badge.textContent = '★ ' + AppUser.name.split(' ')[0];
      badge.classList.add('admin-granted');
    } else {
      badge.textContent = '◉ ' + AppUser.name.split(' ')[0];
    }
  }
  
  // Update sidebar user info
  const sideUser = document.querySelector('.side-user');
  if (!sideUser) {
    const side = document.querySelector('#p-user .side');
    if (side) {
      const userDiv = document.createElement('div');
      userDiv.className = 'side-user';
      userDiv.innerHTML = `
        <div class="side-user-av" style="background:${AppUser.color}">${sanitize(AppUser.avatar || AppUser.name?.[0] || '?')}</div>
        <div class="side-user-info">
          <div class="side-user-name">${sanitize(AppUser.name)}</div>
          <div class="side-user-status">Online</div>
        </div>
      `;
      side.appendChild(userDiv);
    }
  }
  
  go('p-user');
  uSec('home');
}

function updateNotifDot() {
  if (!AppUser) return;
  API.getNotifications().then(res => {
    if (res.ok) {
      const dot = document.getElementById('notif-dot');
      if (dot) {
        dot.textContent = res.unread || '';
        dot.style.display = res.unread > 0 ? 'flex' : 'none';
      }
    }
  }).catch(() => {});
}

function renderHome(u, el) {
  el.innerHTML = `
    <div class="u-home">
      <div class="home-header">
        <div class="home-avatar" style="background:${u.color}">${sanitize(u.avatar || u.name?.[0] || '?')}</div>
        <div class="home-info">
          <h2>${sanitize(u.name)}</h2>
          <span class="home-email">${sanitize(u.email)}</span>
          <span class="home-joined">Membro desde ${sanitize(u.created)}</span>
        </div>
      </div>
      <div class="home-stats">
        <div class="stat-card">
          <span class="stat-icon">💬</span>
          <span class="stat-label">Status</span>
          <span class="stat-value">${u.online ? '● Online' : '○ Offline'}</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">👤</span>
          <span class="stat-label">Funcao</span>
          <span class="stat-value">${u.admin_granted ? '★ Admin' : '◉ User'}</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">📅</span>
          <span class="stat-label">Membro</span>
          <span class="stat-value">${u.created}</span>
        </div>
      </div>
    </div>
  `;
}
