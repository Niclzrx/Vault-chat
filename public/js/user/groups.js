'use strict';

/* global API, AppUser, AppSocket, Crypto, sanitize, fmtTime, toast, blurMode, uSec */

let _grpCurrentId = null;
let _grpKey = '';

async function _decryptGrpMsg(m) {
  if (!m.encrypted || blurMode) {
    m.decrypted = blurMode ? '◆ Mensagem criptografada' : null;
    return m;
  }
  try {
    m.decrypted = await Crypto.decrypt(m.encrypted, _grpKey);
  } catch (_) {
    m.decrypted = '⚠ Erro ao descriptografar';
  }
  return m;
}

async function onGroupMessage(data) {
  if (!AppUser || data.group_id !== _grpCurrentId) return;
  const wrap = document.getElementById('grp-chat-msgs');
  if (!wrap) return;
  const wasAtBottom = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight < 40;
  const isMine = data.from_id === AppUser.id;
  let text = blurMode ? '◆ Mensagem criptografada' : data.encrypted;
  if (!blurMode && data.encrypted && _grpKey) {
    try { text = await Crypto.decrypt(data.encrypted, _grpKey); } catch (_) { text = '⚠ Erro'; }
  }
  const html = `<div class="msg ${isMine ? 'out' : 'in'}">
    ${!isMine ? `<div class="av" style="background:${data.from_color || 'var(--bg4)'}">${sanitize(data.from_avatar || '?')}</div>` : ''}
    <div class="msg-bubble">
      ${!isMine ? `<div class="msg-author">${sanitize(data.from_name || '?')}</div>` : ''}
      <div class="bbl">${sanitize(text || '?')}</div>
      <div class="msg-t">${sanitize(data.timestamp || '')}</div>
    </div>
  </div>`;
  wrap.insertAdjacentHTML('beforeend', html);
  if (wasAtBottom) wrap.scrollTop = wrap.scrollHeight;
}

function onGroupTyping(data) {
  if (data.groupId !== _grpCurrentId || data.from === AppUser?.id) return;
  const el = document.getElementById('grp-typing');
  if (el) {
    el.style.display = 'block';
    setTimeout(() => { if (el) el.style.display = 'none'; }, 2000);
  }
}

function stopGrpPool() { _grpCurrentId = null; }

function _grpModal(content) {
  document.querySelectorAll('.grp-modal').forEach(m => m.remove());
  const wrap = document.createElement('div');
  wrap.className = 'modal grp-modal';
  wrap.innerHTML = `<div class="modal-content">${content}</div>`;
  wrap.addEventListener('click', e => { if (e.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
  return wrap;
}

function _chipGrid(users, prefix) {
  if (!users.length) return '<span style="font-size:.72rem;color:var(--t3)">Nenhum usuário disponível.</span>';
  return `<div class="grp-member-grid">${users.map(m => `
    <label class="grp-member-chip" id="${prefix}-${m.id}">
      <input type="checkbox" value="${m.id}" style="display:none"/>
      <span class="grp-chip-av" style="background:${m.color || 'var(--bg4)'}">${sanitize(m.avatar || m.name?.[0] || '?')}</span>
      <span class="grp-chip-name">${sanitize(m.name)}</span>
      <span class="grp-chip-check">✔</span>
    </label>`).join('')}
  </div>`;
}

function _bindChips(container) {
  container.querySelectorAll('.grp-member-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const cb = chip.querySelector('input[type="checkbox"]');
      cb.checked = !cb.checked;
      chip.classList.toggle('selected', cb.checked);
    });
  });
}

function _checkedValues(container) {
  return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value);
}

function renderGroups(u, el) {
  stopGrpPool();
  API.getGroups().then(res => {
    if (!res.ok) return;
    const groups = res.groups;
    el.innerHTML = `
      <div class="u-groups">
        <div class="groups-header">
          <h2>◗ Grupos</h2>
          <button class="btn sec sm" onclick="openCreateGroup()">+ Novo grupo</button>
        </div>
        <div class="grp-create-panel" id="groups-create" style="display:none">
          <div class="grp-create-header">
            <span class="grp-create-title">◈ Criar novo grupo</span>
            <button class="btn ghost sm" onclick="closeCreateGroup()">✕</button>
          </div>
          <div class="field" style="margin-bottom:.65rem">
            <label>Nome do grupo</label>
            <input type="text" id="grp-name" placeholder="Ex: Projeto Alpha, Equipe Dev..."/>
          </div>
          <div class="field" style="margin-bottom:.65rem">
            <label>Membros</label>
            <div id="grp-members-wrap"></div>
          </div>
          <div style="display:flex;gap:.4rem;margin-top:.75rem">
            <button class="btn pri sm" onclick="createGroup()">◈ Criar grupo</button>
            <button class="btn ghost sm" onclick="closeCreateGroup()">Cancelar</button>
          </div>
        </div>
        <div class="groups-list" id="grp-list">
          ${groups.length ? groups.map(g => groupCard(g, u)).join('') : '<div class="groups-empty">Você não está em nenhum grupo ainda.</div>'}
        </div>
      </div>`;

    const wrap = el.querySelector('#grp-members-wrap');
    if (wrap) {
      API.getUsers().then(res2 => {
        if (res2.ok) { wrap.innerHTML = _chipGrid(res2.users, 'new'); _bindChips(wrap); }
      });
    }
  }).catch(() => {});
}

function groupCard(g, u) {
  const isAdmin = g.is_admin;
  return `
    <div class="group-card" onclick="openGroupChat('${g.id}')">
      <span class="group-icon">${g.icon || '◗'}</span>
      <div class="group-info">
        <span class="group-name">${sanitize(g.name)}</span>
        <span class="group-members">${g.memberCount || 0} membro${g.memberCount !== 1 ? 's' : ''}${isAdmin ? ' · admin' : ''}</span>
      </div>
      ${g.msgCount > 0 ? `<span class="group-badge">${g.msgCount}</span>` : ''}
    </div>`;
}

function openCreateGroup() {
  const el = document.getElementById('groups-create');
  if (!el) return;
  el.style.display = 'block';
  document.getElementById('grp-name')?.focus();
}

function closeCreateGroup() {
  const el = document.getElementById('groups-create');
  if (el) el.style.display = 'none';
}

async function createGroup() {
  const name = document.getElementById('grp-name')?.value.trim();
  if (!name) { toast('Informe um nome para o grupo.', 'err'); return; }
  const wrap = document.getElementById('grp-members-wrap');
  const members = wrap ? _checkedValues(wrap) : [];
  try {
    await API.createGroup(name, members);
    toast(`Grupo "${name}" criado!`, 'ok');
    uSec('groups');
  } catch (err) {
    toast(err.message, 'err');
  }
}

async function openGroupChat(gid) {
  _grpCurrentId = gid;
  _grpKey = 'group_' + gid;
  if (AppSocket) AppSocket.emit('group:join', { groupId: gid });

  const main = document.getElementById('u-main');
  if (!main) return;

  try {
    const [grpRes, msgsRes] = await Promise.all([API.getGroup(gid), API.getGroupMessages(gid)]);
    if (!grpRes.ok || !msgsRes.ok) return;

    const g = grpRes.group;
    const members = grpRes.members || [];
    const msgs = msgsRes.messages || [];
    const isAdmin = members.find(m => m.id === AppUser?.id)?.is_admin;

    await Promise.all(msgs.map(m => _decryptGrpMsg(m)));

    main.innerHTML = `
      <div class="group-chat">
        <div class="chat-header">
          <span style="font-weight:700">${g.icon || '◗'} ${sanitize(g.name)}</span>
          <span class="badge b-gray" style="margin-left:.25rem">${members.length} membros</span>
          <div style="margin-left:auto;display:flex;gap:.3rem;flex-wrap:wrap">
            <button class="btn ghost sm" onclick="uSec('groups')">← Voltar</button>
            ${isAdmin ? `
            <button class="btn sec sm" onclick="openRenameGroup('${gid}')">✎ Renomear</button>
            <button class="btn sec sm" onclick="openAddMember('${gid}')">+ Membro</button>
            <button class="btn red sm" onclick="confirmDeleteGroup('${gid}')">✕ Excluir</button>
            ` : `<button class="btn red sm" onclick="confirmLeaveGroup('${gid}')">→ Sair</button>`}
          </div>
        </div>
        <div class="chat-msgs" id="grp-chat-msgs">
          ${msgs.length ? msgs.map(m => _grpMsgHtml(m)).join('') : '<div class="empty">Sem mensagens ainda. Seja o primeiro!</div>'}
        </div>
        <div id="grp-typing" style="display:none;padding:0 .75rem;font-size:.68rem;color:var(--t3)">Alguém está digitando...</div>
        <div class="chat-input-area">
          <input type="text" id="grp-msg-input" placeholder="Digite sua mensagem..."
                 onkeydown="if(event.key==='Enter') sendGroupMsg('${gid}')"/>
          <button class="btn pri sm" onclick="sendGroupMsg('${gid}')">Enviar</button>
        </div>
      </div>`;

    const container = document.getElementById('grp-chat-msgs');
    if (container) container.scrollTop = container.scrollHeight;
  } catch (err) {
    main.innerHTML = '<div class="chat-placeholder">Erro ao carregar grupo</div>';
  }
}

function _grpMsgHtml(m) {
  const from = { name: m.from_name, avatar: m.from_avatar, color: m.from_color };
  const text = blurMode ? '◆ Mensagem criptografada' : (m.decrypted || '⚠ Erro');
  const out = m.from_id === AppUser?.id;
  return `<div class="msg ${out ? 'out' : 'in'}">
    ${!out ? `<div class="av" style="background:${from.color || 'var(--bg4)'}">${sanitize(from.avatar || '?')}</div>` : ''}
    <div class="msg-bubble">
      ${!out ? `<div class="msg-author">${sanitize(from.name || '?')}</div>` : ''}
      <div class="bbl">${sanitize(text)}</div>
      <div class="msg-t">${sanitize(m.timestamp || '')}</div>
    </div>
  </div>`;
}

async function sendGroupMsg(gid) {
  const input = document.getElementById('grp-msg-input');
  if (!input?.value.trim()) return;
  const text = input.value.trim();
  const enc = await Crypto.encrypt(text, 'group_' + gid);
  input.value = '';

  if (AppSocket) {
    AppSocket.emit('group:send', { groupId: gid, encrypted: enc });
  } else {
    await API.sendGroupMessage(gid, enc);
    openGroupChat(gid);
  }
}

function openRenameGroup(gid) {
  const wrap = _grpModal(`
    <h3 style="margin-bottom:.75rem">✎ Renomear grupo</h3>
    <div class="field">
      <label>Novo nome</label>
      <input id="grp-rename-input" type="text" placeholder="Nome do grupo"/>
    </div>
    <div style="display:flex;gap:.4rem;margin-top:.85rem">
      <button class="btn pri sm" id="grp-rename-confirm">Salvar</button>
      <button class="btn ghost sm" onclick="this.closest('.grp-modal').remove()">Cancelar</button>
    </div>`);
  const input = wrap.querySelector('#grp-rename-input');
  input?.focus();
  wrap.querySelector('#grp-rename-confirm').addEventListener('click', async () => {
    const newName = input?.value.trim();
    if (!newName) { toast('Informe um nome.', 'err'); return; }
    await API.renameGroup(gid, newName);
    wrap.remove();
    toast('Grupo renomeado!', 'ok');
    openGroupChat(gid);
  });
}

function openAddMember(gid) {
  API.getUsers().then(res => {
    if (!res.ok) return;
    const wrap = _grpModal(`
      <h3 style="margin-bottom:.75rem">+ Adicionar membros</h3>
      <div id="grp-add-grid">${_chipGrid(res.users, 'add')}</div>
      <div style="display:flex;gap:.4rem;margin-top:.85rem">
        <button class="btn pri sm" id="grp-add-confirm">Adicionar</button>
        <button class="btn ghost sm" onclick="this.closest('.grp-modal').remove()">Cancelar</button>
      </div>`);
    _bindChips(wrap.querySelector('#grp-add-grid'));
    wrap.querySelector('#grp-add-confirm').addEventListener('click', async () => {
      const ids = _checkedValues(wrap.querySelector('#grp-add-grid'));
      if (!ids.length) { toast('Selecione ao menos um membro.', 'err'); return; }
      for (const uid of ids) {
        await API.addGroupMember(gid, uid).catch(() => {});
      }
      wrap.remove();
      toast('Membros adicionados!', 'ok');
      openGroupChat(gid);
    });
  });
}

function confirmDeleteGroup(gid) {
  const wrap = _grpModal(`
    <h3 style="margin-bottom:.5rem;color:var(--danger)">✕ Excluir grupo</h3>
    <p style="font-size:.78rem;color:var(--t2);margin-bottom:1rem">Tem certeza que deseja excluir este grupo?</p>
    <div style="display:flex;gap:.4rem">
      <button class="btn red sm" id="grp-del-confirm">Excluir</button>
      <button class="btn ghost sm" onclick="this.closest('.grp-modal').remove()">Cancelar</button>
    </div>`);
  wrap.querySelector('#grp-del-confirm').addEventListener('click', async () => {
    await API.deleteGroup(gid);
    wrap.remove();
    toast('Grupo excluído.', 'ok');
    stopGrpPool();
    uSec('groups');
  });
}

function confirmLeaveGroup(gid) {
  const wrap = _grpModal(`
    <h3 style="margin-bottom:.5rem">→ Sair do grupo</h3>
    <p style="font-size:.78rem;color:var(--t2);margin-bottom:1rem">Sair deste grupo? Você precisará ser adicionado novamente.</p>
    <div style="display:flex;gap:.4rem">
      <button class="btn red sm" id="grp-leave-confirm">Sair</button>
      <button class="btn ghost sm" onclick="this.closest('.grp-modal').remove()">Cancelar</button>
    </div>`);
  wrap.querySelector('#grp-leave-confirm').addEventListener('click', async () => {
    await API.removeGroupMember(gid, AppUser.id);
    wrap.remove();
    toast('Você saiu do grupo.', 'ok');
    stopGrpPool();
    uSec('groups');
  });
}
