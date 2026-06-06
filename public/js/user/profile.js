'use strict';

/* global API, AppUser, sanitize, validateEmail, validatePassword, setEl, showErr, showOk, clrMsg, toast, SEC */

function renderProfile(u, el) {
  el.innerHTML = `
    <div class="u-profile">
      <h2>Meu Perfil</h2>
      <div class="profile-avatar-section">
        <div class="profile-avatar" style="background:${u.color}">${sanitize(u.avatar || u.name?.[0] || '?')}</div>
        <p>${sanitize(u.name)}</p>
      </div>
      <div class="profile-form">
        <label>Nome</label>
        <input type="text" id="prof-name" value="${sanitize(u.name)}">
        <label>Cor do avatar</label>
        <input type="color" id="prof-color" value="${u.color || '#6c5ce7'}">
        <div id="profile-msg"></div>
        <button onclick="saveProfile()">Salvar Alterações</button>
      </div>
    </div>
  `;
}

async function saveProfile() {
  if (!AppUser) return;
  const name = document.getElementById('prof-name')?.value.trim();
  const color = document.getElementById('prof-color')?.value;
  clrMsg('profile-msg');
  if (!name) { showErr('profile-msg', 'Preencha o nome.'); return; }

  try {
    const res = await API.updateProfile(AppUser.id, { name, color });
    if (res.ok) {
      AppUser.name = res.user.name;
      AppUser.color = res.user.color;
      showOk('profile-msg', 'Perfil atualizado!');
      const badge = document.getElementById('u-badge');
      if (badge) badge.textContent = '◉ ' + name.split(' ')[0];
    }
  } catch (err) {
    showErr('profile-msg', err.message);
  }
}
