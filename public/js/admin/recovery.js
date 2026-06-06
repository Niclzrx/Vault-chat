'use strict';

/* global API, AppAdmin, sanitize, toast */

async function renderAdmRecovery(el) {
  try {
    const res = await API.adminRecovery();
    const requests = res.ok ? res.requests : [];
    const pending = requests.filter(r => r.status === 'pending').length;

    el.innerHTML = `
      <div class="pt">🔁 Solicitações de Recuperação</div>
      <div class="ps">${pending} pendentes · ${requests.length} total</div>
      <div class="card">
        ${requests.length === 0 ? '<div style="text-align:center;padding:2rem;color:var(--t3);font-size:.8rem">Nenhuma solicitação.</div>' :
        `<table>
          <thead><tr><th>Nome</th><th>Email</th><th>Data</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            ${requests.map(r => `
              <tr>
                <td style="font-weight:600">${sanitize(r.name)}</td>
                <td style="font-size:.76rem;color:var(--t2)">${sanitize(r.email)}</td>
                <td style="font-size:.7rem;color:var(--t3)">${r.date || '-'}</td>
                <td>
                  ${r.status === 'pending' ? '<span class="badge b-yellow">⏳ Pendente</span>' :
                    r.status === 'approved' ? '<span class="badge b-green">✔ Resolvido</span>' :
                    '<span class="badge b-red">✖ Negado</span>'}
                </td>
                <td>
                  ${r.status === 'pending' ? `
                    <button class="btn sm sec" onclick="resolveRecovery('${r.id}','resolved')">✔ Resolver</button>
                    <button class="btn sm red" onclick="resolveRecovery('${r.id}','denied')">✖ Negar</button>
                  ` : '-'}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>`}
      </div>`;
  } catch (_) {
    el.innerHTML = '<div class="empty">Erro ao carregar recuperações.</div>';
  }
}

async function resolveRecovery(id, status) {
  await API.adminResolveRecovery(id, status);
  toast(`Solicitação ${status === 'resolved' ? 'resolvida' : 'negada'}.`, status === 'resolved' ? 'ok' : 'warn');
  const el = document.getElementById('adm-content');
  if (el) renderAdmRecovery(el);
}
