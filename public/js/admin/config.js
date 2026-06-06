'use strict';

/* global API, AppAdmin, sanitize, toast, showErr, showOk, clrMsg */

async function renderAdmConfig(el) {
  try {
    const res = await API.adminConfig();
    const config = res.ok ? res.config : {};

    el.innerHTML = `
      <div class="pt">⊡ Configuração</div>
      <div class="ps">Gerenciar configurações do sistema</div>
      <div class="card" style="margin-bottom:1rem">
        <div class="sh"><span class="st">📊 Informações do Sistema</span></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.65rem">
          <div class="stat"><div class="stat-n" style="color:var(--ac2);font-size:1.2rem">${config.users || 0}</div><div class="stat-l">Usuários</div></div>
          <div class="stat"><div class="stat-n" style="color:var(--info);font-size:1.2rem">${config.groups || 0}</div><div class="stat-l">Grupos</div></div>
          <div class="stat"><div class="stat-n" style="color:var(--warn);font-size:1.2rem">${config.logs || 0}</div><div class="stat-l">Logs</div></div>
          <div class="stat"><div class="stat-n" style="color:var(--ac3);font-size:1.2rem">${config.recovery || 0}</div><div class="stat-l">Recuperações</div></div>
        </div>
      </div>
      <div class="card" style="margin-bottom:1rem">
        <div class="sh"><span class="st">🗄 Gerenciamento de Dados</span></div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
          <button class="btn sec sm" onclick="exportAllData()">📥 Exportar Dados</button>
          <button class="btn red sm" onclick="resetAllData()">⚠ Resetar Sistema</button>
        </div>
      </div>
      <div class="card">
        <div class="sh"><span class="st">◉ Conta de Administrador</span></div>
        <div class="field">
          <label>Nova senha mestra</label>
          <div class="toggle-pw">
            <input id="adm-new-pass" type="password" placeholder="Nova senha (mín. 8 caracteres)"/>
            <button class="eye-btn" onclick="togglePw('adm-new-pass',this)">◎</button>
          </div>
        </div>
        <button class="btn pri sm" onclick="changeAdminPass()">⚷ Alterar senha</button>
        <div id="adm-config-msg"></div>
      </div>`;
  } catch (_) {
    el.innerHTML = '<div class="empty">Erro ao carregar configurações.</div>';
  }
}

async function changeAdminPass() {
  const newPass = document.getElementById('adm-new-pass')?.value;
  clrMsg('adm-config-msg');
  if (!newPass || newPass.length < 8) { showErr('adm-config-msg', 'Mínimo 8 caracteres.'); return; }
  await API.adminChangePass(newPass);
  showOk('adm-config-msg', 'Senha alterada!');
  document.getElementById('adm-new-pass').value = '';
}

async function exportAllData() {
  try {
    const res = await API.adminExport();
    if (!res.ok) return toast('Erro ao exportar.', 'err');
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vault-export-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('Dados exportados!', 'ok');
  } catch (_) {
    toast('Erro ao exportar.', 'err');
  }
}

async function resetAllData() {
  if (!confirm('⚠ TEM CERTEZA? Todos os dados serão perdidos!')) return;
  if (!confirm('⚠ Confirmação final: todos os dados serão apagados!')) return;
  await API.adminReset();
  toast('Sistema resetado.', 'warn');
  setTimeout(() => location.reload(), 1500);
}
