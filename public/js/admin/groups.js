'use strict';

/* global API, AppAdmin, sanitize, toast */

async function renderAdmGroups(el) {
  try {
    const res = await API.getGroups();
    const groups = res.ok ? res.groups : [];

    el.innerHTML = `
      <div class="pt">🏷 Grupos</div>
      <div class="ps">${groups.length} grupos</div>
      <div class="card">
        ${groups.length === 0 ? '<div style="text-align:center;padding:2rem;color:var(--t3);font-size:.8rem">Nenhum grupo criado.</div>' :
        `<table>
          <thead><tr><th>Grupo</th><th>Membros</th><th>Mensagens</th><th>Criado</th><th>Ações</th></tr></thead>
          <tbody>
            ${groups.map(g => `
              <tr>
                <td style="font-weight:600">${g.icon || '◗'} ${sanitize(g.name)}</td>
                <td><span class="badge b-blue">${g.memberCount || 0}</span></td>
                <td><span class="badge b-gray">${g.msgCount || 0}</span></td>
                <td style="font-size:.7rem;color:var(--t3)">${g.created || '-'}</td>
                <td>
                  <button class="btn sm red" onclick="deleteGroupAdmin('${g.id}')">⊠ Excluir</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>`}
      </div>`;
  } catch (_) {
    el.innerHTML = '<div class="empty">Erro ao carregar grupos.</div>';
  }
}

async function deleteGroupAdmin(gid) {
  if (!confirm('Excluir este grupo permanentemente?')) return;
  await API.deleteGroup(gid);
  toast('Grupo excluído.', 'warn');
  const el = document.getElementById('adm-content');
  if (el) renderAdmGroups(el);
}
