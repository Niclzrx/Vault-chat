'use strict';

/* global API, AppUser, sanitize */

async function renderHistory(u, el) {
  el.innerHTML = `
    <div class="u-history">
      <h2>Histórico da Conta</h2>
      <div class="history-summary">
        <div class="history-stat">
          <span class="h-stat-label">Membro desde</span>
          <span class="h-stat-value">${sanitize(u.created)}</span>
        </div>
        <div class="history-stat">
          <span class="h-stat-label">Status</span>
          <span class="h-stat-value">${u.admin_granted ? '★ Admin' : '◉ Usuário'}</span>
        </div>
      </div>
    </div>
  `;
}
