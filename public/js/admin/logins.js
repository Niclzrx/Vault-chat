'use strict';

/* global API, AppAdmin, sanitize */

async function renderAdmLogins(el) {
  try {
    const logsRes = await API.adminLogs();
    const logs = logsRes.ok ? logsRes.logs.filter(l => l.event === 'LOGIN' || l.event === 'LOGIN_FAIL' || l.event === 'LOGOUT') : [];

    el.innerHTML = `
      <div class="pt">⚷ Histórico de Logins</div>
      <div class="ps">${logs.length} registros</div>
      <div class="card">
        ${logs.length === 0 ? '<div style="text-align:center;padding:2rem;color:var(--t3);font-size:.8rem">Nenhum registro.</div>' :
        `<table>
          <thead><tr><th>Evento</th><th>Usuário</th><th>Detalhe</th><th>Horário</th></tr></thead>
          <tbody>
            ${logs.slice(0, 100).map(l => `
              <tr>
                <td><span class="tag">${l.event}</span></td>
                <td style="font-weight:600">${sanitize(l.user_name || '')}</td>
                <td style="color:var(--t2);font-size:.74rem">${sanitize(l.detail || '')}</td>
                <td style="color:var(--t3);font-size:.7rem">${l.timestamp || ''}</td>
              </tr>`).join('')}
          </tbody>
        </table>`}
      </div>`;
  } catch (_) {
    el.innerHTML = '<div class="empty">Erro ao carregar logins.</div>';
  }
}
