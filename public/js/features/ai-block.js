'use strict';

/* global API, AppAdmin, sanitize, toast */

async function renderAdminAIBlock(el) {
  try {
    const [usersRes, blockedRes] = await Promise.all([API.adminUsers(), API.adminAIBlocked()]);
    const users = usersRes.ok ? usersRes.users : [];
    const blocked = blockedRes.ok ? blockedRes.blocked : [];

    el.innerHTML = `
      <div class="pt">◈ Controle de Acesso à IA</div>
      <div class="ps">Gerencie quais usuários podem utilizar o assistente inteligente.</div>
      <div class="card">
        <table>
          <thead><tr><th>Usuário</th><th>Email</th><th>Acesso IA</th><th>Ação</th></tr></thead>
          <tbody>
            ${users.map(u => {
              const isBlocked = blocked.includes(u.id);
              return `<tr>
                <td>
                  <div style="display:flex;align-items:center;gap:.45rem">
                    <div style="width:26px;height:26px;border-radius:50%;background:${u.color}22;display:flex;align-items:center;justify-content:center;font-size:.62rem;font-weight:800;color:${u.color}">${u.avatar}</div>
                    <span style="font-weight:600">${sanitize(u.name)}</span>
                  </div>
                </td>
                <td style="font-size:.76rem;color:var(--t2)">${sanitize(u.email)}</td>
                <td><span class="badge ${isBlocked ? 'b-red' : 'b-green'}">${isBlocked ? '⊘ Bloqueado' : '✔ Liberado'}</span></td>
                <td>
                  <button class="btn sm ${isBlocked ? 'sec' : 'red'}" onclick="toggleAIBlock('${u.id}')">
                    ${isBlocked ? '◇ Liberar' : '⊘ Bloquear'}
                  </button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (_) {
    el.innerHTML = '<div class="empty">Erro ao carregar.</div>';
  }
}

async function toggleAIBlock(userId) {
  const res = await API.adminAIBlock(userId);
  toast(res.blocked ? 'Usuário bloqueado da IA.' : 'Usuário liberado para IA.', res.blocked ? 'warn' : 'ok');
  const el = document.getElementById('adm-content');
  if (el) renderAdminAIBlock(el);
}
