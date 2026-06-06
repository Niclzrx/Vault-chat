'use strict';

/* global API, AppUser, AppSocket, Crypto, sanitize, fmtTime, toast, go, updateTicker, updateNotifDot */

let blurMode = false;
let currentChatTarget = null;
let _chatMsgs = [];
let _convKey = '';
let _blockedByMe = false;
let _blockedMe = false;

function stopChatPool() { currentChatTarget = null; _convKey = ''; _blockedByMe = false; _blockedMe = false; }

async function decryptMsg(m) {
  if (blurMode) {
    m.decrypted = '\u25C6 Mensagem criptografada';
    return m;
  }
  if (m.msg_type === 'image' && m.encrypted_image) {
    try {
      const buf = await Crypto.decryptBinary(m.encrypted_image, _convKey);
      if (buf) {
        const blob = new Blob([buf]);
        m._imgUrl = URL.createObjectURL(blob);
        m.decrypted = null;
      } else {
        m.decrypted = 'Erro ao descriptografar imagem';
      }
    } catch (_) {
      m.decrypted = 'Erro ao descriptografar imagem';
    }
    return m;
  }
  if (m.encrypted) {
    try {
      m.decrypted = await Crypto.decrypt(m.encrypted, _convKey);
    } catch (_) {
      m.decrypted = 'Erro ao descriptografar';
    }
  }
  return m;
}

async function onSocketMessage(data) {
  if (!AppUser || !currentChatTarget) return;
  if ((data.from === AppUser.id && data.to === currentChatTarget) ||
      (data.from === currentChatTarget && data.to === AppUser.id)) {
    const msg = {
      id: data.id,
      from_id: data.from,
      to_id: data.to,
      encrypted: data.encrypted || '',
      encrypted_image: data.encrypted_image || '',
      msg_type: data.msg_type || 'text',
      timestamp: data.timestamp,
      from_name: '',
      from_avatar: '',
      from_color: ''
    };
    try {
      const fromUser = await API.getUser(data.from);
      if (fromUser?.ok) {
        msg.from_name = fromUser.user.name;
        msg.from_avatar = fromUser.user.avatar;
        msg.from_color = fromUser.user.color;
      }
    } catch (_) {}
    await decryptMsg(msg);
    _chatMsgs.push(msg);
    renderChatMessages();
  }
}

function onSocketTyping(data) {
  const el = document.getElementById('chat-typing');
  if (el && data.from === currentChatTarget) {
    el.style.display = 'block';
    setTimeout(() => { if (el) el.style.display = 'none'; }, 2000);
  }
}

function onSocketNotify(data) {
  toast('Nova mensagem de ' + (data.fromName || '?'), 'info');
  updateNotifDot();
  refreshContactBadges();
}

async function refreshContactBadges() {
  try {
    const res = await API.getContacts();
    if (!res.ok) return;
    const container = document.getElementById('chat-contacts');
    if (!container) return;
    const contacts = res.contacts;
    container.innerHTML = contacts.map(c => contactItem(c)).join('');
  } catch (_) {}
}

async function renderChat(u, el) {
  stopChatPool();
  currentChatTarget = null;
  _chatMsgs = [];

  try {
    const res = await API.getContacts();
    if (!res.ok) return;
    const contacts = res.contacts;
    el.innerHTML = `
      <div class="u-chat">
        <div class="chat-sidebar">
          <div class="chat-search">
            <input type="text" id="chat-search" placeholder="Buscar contatos..." oninput="filterContacts(this.value)">
          </div>
          <div class="chat-filters">
            <button class="chat-filter-btn on" onclick="filterChatContacts('all', this)">Todos</button>
            <button class="chat-filter-btn" onclick="filterChatContacts('online', this)">Online</button>
          </div>
          <div class="chat-contacts" id="chat-contacts">
            ${contacts.map(c => contactItem(c)).join('')}
          </div>
        </div>
        <div class="chat-main" id="chat-main">
          <div class="chat-placeholder">
            <div style="text-align:center">
              <div style="font-size:2rem;margin-bottom:.5rem">💬</div>
              <div>Selecione um contato para iniciar uma conversa</div>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (_) {}
}

function contactItem(c) {
  const unreadBadge = c.unread > 0
    ? `<span class="contact-badge">${c.unread}</span>`
    : '';
  const blockedTag = c.blockedByMe
    ? '<span class="contact-status" style="color:var(--danger)">Bloqueado</span>'
    : (c.online ? '<span class="online-dot"></span> Online' : 'Offline');

  let lastMsgPreview = '';
  if (c.lastMsg) {
    if (c.lastMsg.msg_type === 'image') {
      lastMsgPreview = 'Imagem';
    } else {
      lastMsgPreview = c.lastMsg.timestamp || '';
    }
  }

  return `
    <div class="contact-item${c.unread > 0 ? ' unread' : ''}" data-uid="${c.id}" data-online="${c.online ? '1' : '0'}" onclick="openChat('${c.id}')">
      <div class="contact-avatar" style="background:${c.color}">${sanitize(c.avatar || c.name?.[0] || '?')}</div>
      <div class="contact-info">
        <span class="contact-name">${sanitize(c.name)}</span>
        <span class="contact-status">${blockedTag}</span>
      </div>
      <div class="contact-right">
        ${unreadBadge}
      </div>
    </div>
  `;
}

function filterContacts(q) {
  const items = document.querySelectorAll('.contact-item');
  const lower = q.toLowerCase();
  items.forEach(item => {
    const name = item.querySelector('.contact-name')?.textContent?.toLowerCase() || '';
    item.style.display = name.includes(lower) ? '' : 'none';
  });
}

function filterChatContacts(filter, btn) {
  document.querySelectorAll('.chat-filter-btn').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  
  const items = document.querySelectorAll('.contact-item');
  items.forEach(item => {
    if (filter === 'all') {
      item.style.display = '';
    } else if (filter === 'online') {
      item.style.display = item.dataset.online === '1' ? '' : 'none';
    }
  });
}

async function openChat(uid) {
  currentChatTarget = uid;
  _convKey = [AppUser.id, uid].sort().join('_');
  _blockedByMe = false;
  _blockedMe = false;

  document.querySelectorAll('.contact-item').forEach(c => {
    c.classList.toggle('active', c.dataset.uid === uid);
    if (c.dataset.uid === uid) c.classList.remove('unread');
    const badge = c.querySelector('.contact-badge');
    if (badge && c.dataset.uid === uid) badge.remove();
  });

  if (AppSocket) {
    AppSocket.emit('chat:join', { from: AppUser.id, to: uid });
  }

  const main = document.getElementById('chat-main');
  if (!main) return;

  try {
    const [res, otherRes, blockRes] = await Promise.all([
      API.getMessages(uid),
      API.getUser(uid),
      API.isBlocked(uid)
    ]);
    if (!res.ok) return;

    const other = otherRes.ok ? otherRes.user : { name: '?', avatar: '?', color: '#666', online: false };
    if (blockRes.ok) {
      _blockedByMe = blockRes.byMe;
      _blockedMe = blockRes.byThem;
    }

    _chatMsgs = res.messages || [];
    await Promise.all(_chatMsgs.map(m => decryptMsg(m)));

    const blockBtnLabel = _blockedByMe ? 'Desbloquear' : 'Bloquear';
    const blockBtnAction = _blockedByMe ? `unblockUser('${uid}')` : `blockUser('${uid}')`;
    const blockBtnIcon = _blockedByMe ? '🟢' : '🔴';

    main.innerHTML = `
      <div class="chat-header">
        <div class="contact-avatar" style="background:${other.color}">${sanitize(other.avatar || other.name?.[0] || '?')}</div>
        <div>
          <div class="chat-header-name">${sanitize(other.name)}</div>
          <div class="chat-header-status">${_blockedMe ? 'Este usuario te bloqueou' : (other.online ? '<span class="online-dot"></span> Online' : 'Offline')}</div>
        </div>
        <div class="chat-header-actions">
          <button onclick="toggleBlurMode()" title="Alternar ofuscação">${blurMode ? '🙈' : '🔒'}</button>
          <button class="chat-block-btn" onclick="${blockBtnAction}" title="${blockBtnLabel}">${blockBtnIcon}</button>
        </div>
      </div>
      <div class="chat-msgs" id="chat-msgs"></div>
      <div id="chat-typing" class="typing-indicator" style="display:none">Digitando...</div>
      ${_blockedMe ? `
        <div class="chat-blocked-bar">Voce foi bloqueado por este usuario. Nao e possivel enviar mensagens.</div>
      ` : _blockedByMe ? `
        <div class="chat-input-area blocked">
          <div class="chat-blocked-notice">Voce bloqueou este contato. <button onclick="unblockUser('${uid}')">Desbloquear</button></div>
        </div>
      ` : `
        <div class="chat-input-area">
          <input type="file" id="chat-img-input" accept="image/*" style="display:none" onchange="sendImage(this)">
          <button class="attach-btn" title="Enviar imagem" onclick="document.getElementById('chat-img-input').click()">🖼️</button>
          <input type="text" id="chat-input" placeholder="Digite sua mensagem..." onkeydown="if(event.key==='Enter') sendMsg()">
          <button class="send-btn" onclick="sendMsg()">➤</button>
        </div>
      `}
      <div class="chat-footer-note">
        <span class="lock-icon">🔒</span> Mensagens protegidas com criptografia de ponta a ponta (AES-256-GCM)
      </div>
    `;

    renderChatMessages();
    updateNotifDot();
  } catch (err) {
    main.innerHTML = '<div class="chat-placeholder">Erro ao carregar conversa</div>';
  }
}

function renderChatMessages() {
  const wrap = document.getElementById('chat-msgs');
  if (!wrap) return;
  const wasAtBottom = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight < 40;

  wrap.innerHTML = _chatMsgs.map(m => {
    const isMine = (m.from_id === AppUser?.id) || (m.from === AppUser?.id);
    const fromName = m.from_name || '';
    const fromAvatar = m.from_avatar || '';
    const fromColor = m.from_color || '';
    const time = m.timestamp || m.t || '';

    let content = '';
    if (m.msg_type === 'image' && m._imgUrl) {
      content = `<img class="msg-img" src="${m._imgUrl}" onclick="window.open('${m._imgUrl}','_blank')" alt="Imagem criptografada">`;
    } else if (m.msg_type === 'image' && blurMode) {
      content = `<div class="msg-img-placeholder">🔒 Imagem criptografada</div>`;
    } else if (m.msg_type === 'image') {
      content = `<div class="msg-img-placeholder">Erro ao descriptografar imagem</div>`;
    } else {
      const text = blurMode ? '\u25C6 Mensagem criptografada' : (m.decrypted || 'Erro ao descriptografar');
      content = `<div class="bbl">${sanitize(text)}</div>`;
    }

    return `<div class="msg ${isMine ? 'out' : 'in'}">
      ${!isMine ? `<div class="av" style="background:${fromColor || 'var(--bg4)'}">${sanitize(fromAvatar || fromName[0] || '?')}</div>` : ''}
      <div class="msg-bubble">
        ${!isMine && fromName ? `<div class="msg-author">${sanitize(fromName)}</div>` : ''}
        ${content}
        <div class="msg-t">${sanitize(time)}${isMine ? ' ✓✓' : ''}</div>
      </div>
    </div>`;
  }).join('');

  if (wasAtBottom) wrap.scrollTop = wrap.scrollHeight;
}

async function sendMsg() {
  const input = document.getElementById('chat-input');
  if (!input || !input.value.trim() || !currentChatTarget || !AppUser) return;
  const text = input.value.trim();
  const enc = await Crypto.encrypt(text, _convKey);
  input.value = '';

  if (AppSocket) {
    AppSocket.emit('chat:send', { to: currentChatTarget, encrypted: enc });
    AppSocket.emit('chat:typing', { to: currentChatTarget });
  } else {
    await API.sendMessage(currentChatTarget, enc);
    openChat(currentChatTarget);
  }
}

async function sendImage(fileInput) {
  if (!fileInput.files?.[0] || !currentChatTarget || !AppUser) return;
  const file = fileInput.files[0];
  fileInput.value = '';

  if (file.size > 5 * 1024 * 1024) {
    toast('Imagem muito grande (max 5MB)', 'error');
    return;
  }

  try {
    const arrayBuf = await file.arrayBuffer();
    const encImg = await Crypto.encryptBinary(arrayBuf, _convKey);

    if (AppSocket) {
      AppSocket.emit('chat:send', { to: currentChatTarget, encrypted_image: encImg, msg_type: 'image' });
    } else {
      await API.sendMessage(currentChatTarget, '', encImg, 'image');
      openChat(currentChatTarget);
    }
  } catch (_) {
    toast('Erro ao criptografar imagem', 'error');
  }
}

function toggleBlurMode() {
  blurMode = !blurMode;
  if (currentChatTarget) openChat(currentChatTarget);
}

async function blockUser(uid) {
  if (!confirm('Bloquear este contato?')) return;
  try {
    const res = await API.blockUser(uid);
    if (res.ok) {
      toast('Contato bloqueado', 'info');
      if (currentChatTarget === uid) openChat(uid);
    }
  } catch (_) {
    toast('Erro ao bloquear', 'error');
  }
}

async function unblockUser(uid) {
  try {
    const res = await API.unblockUser(uid);
    if (res.ok) {
      toast('Contato desbloqueado', 'info');
      if (currentChatTarget === uid) openChat(uid);
    }
  } catch (_) {
    toast('Erro ao desbloquear', 'error');
  }
}

function onUserOnline(data) {
  const item = document.querySelector(`.contact-item[data-uid="${data.userId}"]`);
  if (item) {
    item.dataset.online = data.online ? '1' : '0';
    const status = item.querySelector('.contact-status');
    if (status && !status.textContent.includes('Bloqueado')) {
      status.innerHTML = data.online ? '<span class="online-dot"></span> Online' : 'Offline';
    }
  }
}
