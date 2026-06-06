'use strict';

/* global API, AppAdmin, sanitize, fmtTime, fmtBanTime, toast, showErr, clrMsg */

async function renderAdmUsers(el) {
  try {
    const res = await API.adminUsers();
    if (!res.ok) { el.innerHTML = '<div class="empty">Erro ao carregar usuários.</div>'; return; }
    const users = res.users;
    el.innerHTML = `
      <div class="pt">◗ Gerenciar Usuários</div>
      <div class="ps">${users.length} usuários cadastrados</div>
      <div class="card">
        <table>
          <thead><tr><th>Usuário</th><th>Email</th><th>Status</th><th>Admin</th><th>Ações</th></tr></thead>
          <tbody>
            ${users.map(u => `
              <tr style="${u.banned ? 'opacity:.6' : ''}">
                <td>
                  <div style="display:flex;align-items:center;gap:.45rem">
                    <div style="width:28px;height:28px;border-radius:50%;background:${u.color}22;display:flex;align-items:center;justify-content:center;font-size:.62rem;font-weight:800;color:${u.color}">${u.avatar}</div>
                    <span style="font-weight:600">${sanitize(u.name)}</span>
                  </div>
                </td>
                <td style="font-size:.76rem;color:var(--t2)">${sanitize(u.email)}</td>
                <td>
                  ${u.banned ? `<span class="badge b-red">⊘ Banido${u.ban_reason ? ': ' + sanitize(u.ban_reason) : ''}</span>` :
                    `<span class="badge ${u.online ? 'b-green' : 'b-gray'}">${u.online ? '◆ Online' : '⚫ Offline'}</span>`}
                </td>
                <td>${u.admin_granted ? '<span class="badge b-yellow">★ Admin</span>' : '<span class="badge b-gray">Usuário</span>'}</td>
                <td>
                  <div style="display:flex;gap:.3rem;flex-wrap:wrap">
                    ${u.banned ? `<button class="btn sm sec" onclick="unbanUser('${u.id}')">◇ Desbanir</button>` :
                      `<button class="btn sm red" onclick="openBanModal('${u.id}')">⊘ Banir</button>`}
                    ${u.admin_granted ?
                      `<button class="btn sm" onclick="revokeAdminUser('${u.id}')">★ Remover Admin</button>` :
                      `<button class="btn sm sec" onclick="grantAdminUser('${u.id}')">★ Tornar Admin</button>`}
                    <button class="btn sm red" onclick="kickUser('${u.id}')">🔌 Kick</button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (_) {
    el.innerHTML = '<div class="empty">Erro ao carregar usuários.</div>';
  }
}

function openBanModal(userId) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.onclick = e => { if (e.target === bg) bg.remove(); };
  bg.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <button class="modal-close" onclick="this.closest('.modal-bg').remove()">✕</button>
      <h3>⊘ Banir Usuário</h3>
      <div class="field">
        <label>Duração</label>
        <select id="ban-duration">
          <option value="3600000">1 hora</option>
          <option value="86400000">24 horas</option>
          <option value="604800000">7 dias</option>
          <option value="2592000000">30 dias</option>
          <option value="-1">Permanente</option>
        </select>
      </div>
      <div class="field">
        <label>Motivo</label>
        <textarea id="ban-reason" rows="3" placeholder="Motivo do banimento..."></textarea>
      </div>
      <button class="btn red full" onclick="confirmBan('${userId}')">⊘ Confirmar Banimento</button>
    </div>`;
  document.body.appendChild(bg);
}

async function confirmBan(userId) {
  const duration = parseInt(document.getElementById('ban-duration')?.value);
  const reason = document.getElementById('ban-reason')?.value.trim();
  await API.adminBan(userId, duration, reason);
  toast('Usuário banido.', 'warn');
  document.querySelectorAll('.modal-bg').forEach(m => m.remove());
  const el = document.getElementById('adm-content');
  if (el) renderAdmUsers(el);
}

async function unbanUser(userId) {
  await API.adminUnban(userId);
  toast('Usuário desbanido.', 'ok');
  const el = document.getElementById('adm-content');
  if (el) renderAdmUsers(el);
}

async function grantAdminUser(userId) {
  await API.adminGrantAdmin(userId);
  toast('Admin concedido.', 'ok');
  const el = document.getElementById('adm-content');
  if (el) renderAdmUsers(el);
}

async function revokeAdminUser(userId) {
  await API.adminRevokeAdmin(userId);
  toast('Admin removido.', 'info');
  const el = document.getElementById('adm-content');
  if (el) renderAdmUsers(el);
}

async function kickUser(userId) {
  if (!confirm('Desconectar este usuário?')) return;
  await API.adminKick(userId);
  toast('Usuário desconectado.', 'warn');
  const el = document.getElementById('adm-content');
  if (el) renderAdmUsers(el);
}
