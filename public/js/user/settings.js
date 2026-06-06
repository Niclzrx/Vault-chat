'use strict';

/* global API, AppUser, sanitize, toast, doLogout */

function renderSettings(u, el) {
  el.innerHTML = `
    <div class="u-settings">
      <h2>Configurações</h2>
      <div class="settings-group">
        <h3>Conta</h3>
        <div class="setting-item">
          <span>Email</span>
          <span style="color:var(--t2);font-size:.78rem">${sanitize(u.email)}</span>
        </div>
        <div class="setting-item">
          <span>Membro desde</span>
          <span style="color:var(--t2);font-size:.78rem">${sanitize(u.created)}</span>
        </div>
      </div>
      <div class="settings-actions">
        <button onclick="doLogout()" class="btn red">→ Sair da conta</button>
      </div>
    </div>
  `;
}
