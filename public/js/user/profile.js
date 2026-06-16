'use strict';

/* global API, AppUser, sanitize, validateEmail, validatePassword, setEl, showErr, showOk, clrMsg, toast, SEC */

function renderProfile(u, el) {
  const hasImage = u.avatar && u.avatar.startsWith('data:');
  el.innerHTML = `
    <div class="u-profile">
      <h2>Meu Perfil</h2>
      <div class="profile-avatar-section">
        <div class="profile-avatar-wrap" onclick="document.getElementById('avatar-input').click()" title="Clique para mudar a foto">
          ${hasImage
            ? `<img class="profile-avatar-img" src="${u.avatar}" alt="Avatar"/>`
            : `<div class="profile-avatar" style="background:${u.color}">${sanitize(u.avatar || u.name?.[0] || '?')}</div>`
          }
          <div class="profile-avatar-edit">📷</div>
        </div>
        <input type="file" id="avatar-input" accept="image/*" style="display:none" onchange="uploadAvatar(this)">
        <p style="margin-top:.4rem;font-size:.72rem;color:var(--t3)">Clique na foto para alterar</p>
        ${hasImage ? '<p><button class="btn sm" style="margin-top:.3rem;font-size:.65rem;color:var(--danger)" onclick="removeAvatar()">Remover foto</button></p>' : ''}
        <p style="font-weight:600;margin-top:.2rem">${sanitize(u.name)}</p>
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

async function uploadAvatar(input) {
  if (!input.files?.[0] || !AppUser) return;
  const file = input.files[0];
  input.value = '';

  if (file.size > 2 * 1024 * 1024) {
    toast('Imagem muito grande (max 2MB)', 'err');
    return;
  }

  try {
    const dataUrl = await _resizeAvatar(file, 128, 128);
    const res = await API.updateProfile(AppUser.id, { avatar: dataUrl });
    if (res.ok) {
      AppUser.avatar = res.user.avatar;
      toast('Foto de perfil atualizada!', 'ok');
      uSec('profile');
    }
  } catch (err) {
    toast('Erro ao enviar foto.', 'err');
  }
}

function _resizeAvatar(file, maxW, maxH) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > h) { if (w > maxW) { h = h * maxW / w; w = maxW; } }
        else { if (h > maxH) { w = w * maxH / h; h = maxH; } }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function removeAvatar() {
  if (!AppUser) return;
  try {
    const res = await API.updateProfile(AppUser.id, { avatar: '' });
    if (res.ok) {
      AppUser.avatar = res.user.avatar;
      toast('Foto removida.', 'ok');
      uSec('profile');
    }
  } catch (err) {
    toast('Erro ao remover foto.', 'err');
  }
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
