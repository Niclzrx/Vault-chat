'use strict';

/* global API, AppAdmin, sanitize, toast */

async function renderAdmLive(el) {
  try {
    const [usersRes, statsRes] = await Promise.all([API.adminUsers(), API.adminStats()]);
    const users = usersRes.ok ? usersRes.users : [];
    const stats = statsRes.ok ? statsRes.stats : {};
    const online = users.filter(u => u.online);

    el.innerHTML = `
      <div class="pt">🔴 Monitor ao Vivo</div>
      <div class="ps">${online.length} usuários online</div>
      <div class="card">
        <div class="sh"><span class="st">Usuários Online</span><span class="badge b-green">${online.length} ativos</span></div>
        ${online.length === 0 ? '<div style="text-align:center;padding:1.5rem;color:var(--t3);font-size:.8rem">Nenhum usuário online.</div>' :
        online.map(u => `
          <div style="display:flex;align-items:center;gap:.5rem;padding:.45rem 0;border-bottom:1px solid var(--border);font-size:.78rem">
            <div class="dot dot-g"></div>
            <div style="width:24px;height:24px;border-radius:50%;background:${u.color}22;display:flex;align-items:center;justify-content:center;font-size:.6rem;font-weight:800;color:${u.color}">${u.avatar}</div>
            <span style="flex:1;font-weight:600">${sanitize(u.name)}</span>
            <button class="btn sm red" onclick="kickUser('${u.id}')" title="Desconectar">🔌</button>
          </div>`).join('')}
      </div>`;
  } catch (_) {
    el.innerHTML = '<div class="empty">Erro ao carregar monitor.</div>';
  }
}
