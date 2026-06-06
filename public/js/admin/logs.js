'use strict';

/* global API, AppAdmin, sanitize, toast */

let _admLogsData = [];

async function renderAdmLogs(el) {
  try {
    const res = await API.adminLogs();
    _admLogsData = res.ok ? res.logs : [];
    el.innerHTML = `
      <div class="pt">▤ Logs do Sistema</div>
      <div class="ps">${_admLogsData.length} eventos</div>
      <div class="card">
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.85rem">
          <button class="btn sm sec" onclick="filterAdmLogs('all')">Todos</button>
          <button class="btn sm" onclick="filterAdmLogs('LOGIN')">Login</button>
          <button class="btn sm" onclick="filterAdmLogs('BAN')">Ban</button>
          <button class="btn sm" onclick="filterAdmLogs('KICK')">Kick</button>
          <button class="btn sm" onclick="filterAdmLogs('GROUP')">Grupo</button>
        </div>
        <div id="adm-logs-table">${renderLogsTable(_admLogsData)}</div>
      </div>`;
  } catch (_) {
    el.innerHTML = '<div class="empty">Erro ao carregar logs.</div>';
  }
}

function renderLogsTable(logs) {
  if (!logs.length) return '<div style="text-align:center;padding:1.5rem;color:var(--t3);font-size:.8rem">Nenhum log.</div>';
  return `<table>
    <thead><tr><th>Evento</th><th>Usuário</th><th>Detalhe</th><th>Horário</th></tr></thead>
    <tbody>${logs.slice(0, 200).map(l => `
      <tr>
        <td><span class="tag">${l.event || '-'}</span></td>
        <td style="font-weight:600">${sanitize(l.user_name || '')}</td>
        <td style="color:var(--t2);font-size:.74rem">${sanitize(l.detail || '')}</td>
        <td style="color:var(--t3);font-size:.7rem">${l.timestamp || ''}</td>
      </tr>`).join('')}
    </tbody></table>`;
}

function filterAdmLogs(filter) {
  const el = document.getElementById('adm-logs-table');
  if (!el) return;
  const filtered = filter === 'all' ? _admLogsData : _admLogsData.filter(l => l.event?.startsWith(filter));
  el.innerHTML = renderLogsTable(filtered);
}
