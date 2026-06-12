'use strict';

/* global API, AppAdmin, sanitize, toast */

function setASideActive(s) {
  ['panel','live','users','logins','chats','groups','logs','recovery','config','ai'].forEach(x => {
    document.getElementById('si-adm-' + x)?.classList.toggle('on', x === s);
  });
}

function aSec(s) {
  setASideActive(s);
  const el = document.getElementById('adm-content');
  if (!el) return;
  el.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--t3)">▸ carregando...</div>';
  if      (s === 'panel')    renderAdmPanel(el);
  else if (s === 'live')     renderAdmLive(el);
  else if (s === 'users')    renderAdmUsers(el);
  else if (s === 'logins')   renderAdmLogins(el);
  else if (s === 'chats')    renderAdmChats(el);
  else if (s === 'groups')   renderAdmGroups(el);
  else if (s === 'logs')     renderAdmLogs(el);
  else if (s === 'recovery') renderAdmRecovery(el);
  else if (s === 'config')   renderAdmConfig(el);
}

async function renderAdmPanel(el) {
  try {
    const [statsRes, usersRes] = await Promise.all([API.adminStats(), API.adminUsers()]);
    const stats = statsRes.ok ? statsRes.stats : {};
    const users = usersRes.ok ? usersRes.users : [];

    el.innerHTML = `
      <div class="pt">Painel de Controle</div>
      <div class="ps">Visão geral do sistema · <span class="live-pulse"></span> ao vivo</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:.65rem;margin-bottom:1.3rem">
        <div class="stat"><div class="stat-n" style="color:var(--ac2)">${stats.users || 0}</div><div class="stat-l">Usuários</div></div>
        <div class="stat"><div class="stat-n" style="color:var(--ok)">${stats.online || 0}</div><div class="stat-l">Online</div></div>
        <div class="stat"><div class="stat-n" style="color:var(--danger)">${stats.banned || 0}</div><div class="stat-l">Banidos</div></div>
        <div class="stat"><div class="stat-n" style="color:var(--warn)">${stats.msgs || 0}</div><div class="stat-l">Msgs</div></div>
        <div class="stat"><div class="stat-n" style="color:var(--ac3)">${stats.groups || 0}</div><div class="stat-l">Grupos</div></div>
        <div class="stat"><div class="stat-n" style="color:var(--info)">${stats.recovery || 0}</div><div class="stat-l">Recuperações</div></div>
      </div>
      <div class="card" style="margin-bottom:1rem">
        <div class="sh"><span class="st">Status ao vivo</span><span class="badge b-green pulse">● LIVE</span></div>
        ${users.map(u => `
          <div style="display:flex;align-items:center;gap:.65rem;padding:.6rem .75rem;background:${u.banned ? 'rgba(255,82,82,.05)' : 'var(--bg3)'};border-radius:var(--radius-sm);border:1px solid ${u.banned ? 'rgba(255,82,82,.15)' : 'var(--border)'};margin-bottom:.3rem">
            <div class="dot ${u.online ? 'dot-g' : 'dot-r'}"></div>
            <div style="width:28px;height:28px;border-radius:50%;background:${u.color}22;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:800;color:${u.color}">${u.avatar}</div>
            <div style="flex:1">
              <div style="font-size:.8rem;font-weight:700">${sanitize(u.name)}</div>
              <div style="font-size:.68rem;color:var(--t2)">${sanitize(u.email)}</div>
            </div>
            <span class="badge ${u.online ? 'b-green' : u.banned ? 'b-red' : 'b-gray'}">${u.online ? '● Online' : u.banned ? '⊘ Banido' : 'Offline'}</span>
          </div>`).join('')}
      </div>`;
  } catch (_) {
    el.innerHTML = '<div class="empty">Erro ao carregar painel.</div>';
  }
}

function renderAdminPanel() { aSec('panel'); }
function renderAdminUsers() { aSec('users'); }
function renderAdminLive() { aSec('live'); }
function renderAdminLogins() { aSec('logins'); }
function renderAdminChats() { aSec('chats'); }
function renderAdminGroups() { aSec('groups'); }
function renderAdminLogs() { aSec('logs'); }
function renderAdminRecovery() { aSec('recovery'); }
function renderAdminConfig() { aSec('config'); }
