'use strict';

/* global API, AppUser, sanitize, updateNotifDot */

async function renderNotif(u, el) {
  try {
    const res = await API.getNotifications();
    if (!res.ok) { el.innerHTML = '<div class="empty">Erro ao carregar notificações.</div>'; return; }
    const notifs = res.notifications || [];
    el.innerHTML = `
      <div class="u-notif">
        <div class="notif-header">
          <h2>Notificações</h2>
          <button onclick="markAllRead()">Marcar todas como lidas</button>
        </div>
        <div class="notif-list">
          ${notifs.length ? notifs.map(n => `
            <div class="notif-item ${n.read ? 'read' : 'unread'}" onclick="markRead('${n.id}')">
              <span class="notif-icon">${n.icon}</span>
              <div class="notif-body">
                <span class="notif-msg">${sanitize(n.message)}</span>
                <span class="notif-time">${sanitize(n.timestamp)}</span>
              </div>
            </div>
          `).join('') : '<div class="empty">Nenhuma notificação.</div>'}
        </div>
      </div>
    `;
    updateNotifDot();
  } catch (_) {
    el.innerHTML = '<div class="empty">Erro ao carregar notificações.</div>';
  }
}

async function markRead(id) {
  await API.markNotificationRead(id).catch(() => {});
  updateNotifDot();
}

async function markAllRead() {
  await API.markAllNotificationsRead().catch(() => {});
  updateNotifDot();
  const el = document.getElementById('u-main');
  if (el && AppUser) renderNotif(AppUser, el);
}
