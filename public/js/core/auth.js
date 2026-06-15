'use strict';

/* global API, AppUser, AppAdmin, connectSocket, sanitize, fmtTime, toast, go, updateTicker, setEl, openUserDash, aSec */

async function doLogin() {
  const email = document.getElementById('login-user').value.trim().toLowerCase();
  const pass = document.getElementById('login-pass').value;
  clrMsg('login-err');
  if (!email || !pass) { showErr('login-err', 'Preencha todos os campos.'); return; }

  try {
    const res = await API.login(email, pass);
    AppUser = res.user;
    connectSocket();
    Session.start();
    updateTicker();
    openUserDash();
    toast('Login realizado!', 'ok');
  } catch (err) {
    showErr('login-err', err.message);
  }
}

async function doRegister() {
  const name = document.getElementById('reg-user').value.trim();
  const email = document.getElementById('reg-email').value.trim().toLowerCase();
  const pass = document.getElementById('reg-pass').value;
  const pass2 = document.getElementById('reg-pass2').value;
  clrMsg('reg-err');
  if (!name || !email || !pass || !pass2) { showErr('reg-err', 'Preencha todos os campos.'); return; }

  try {
    const res = await API.register(name, email, pass, pass2);
    AppUser = res.user;
    connectSocket();
    Session.start();
    updateTicker();
    openUserDash();
    toast('Conta criada! Bem-vindo(a)!', 'ok');
  } catch (err) {
    showErr('reg-err', err.message);
  }
}

async function doAdminLogin() {
  const id = document.getElementById('adm-code').value.trim();
  const pass = document.getElementById('adm-pass').value;
  clrMsg('adm-err');
  if (!id || !pass) { showErr('adm-err', 'Preencha ID e senha.'); return; }

  try {
    const res = await API.adminLogin(id, pass);
    AppAdmin = res.admin;
    go('p-adm');
    aSec('panel');
    toast('Acesso administrativo concedido', 'ok');
  } catch (err) {
    showErr('adm-err', err.message);
  }
}

function doLogout() {
  API.logout().catch(() => {});
  AppUser = null;
  AppAdmin = null;
  if (AppSocket) { AppSocket.disconnect(); AppSocket = null; }
  Session.stop();
  updateTicker();
  go('p-land');
  toast('Sessão encerrada.', 'info');
}

async function submitRecovery() {
  const name = document.getElementById('rec-name')?.value.trim();
  const email = document.getElementById('rec-email')?.value.trim();
  const message = document.getElementById('rec-msg-text')?.value.trim();
  clrMsg('rec-msg');
  if (!name || !email) { showErr('rec-msg', 'Preencha nome e email.'); return; }

  try {
    await API.post('/api/auth/recovery', { name, email, message });
    showOk('rec-msg', 'Solicitação enviada! O administrador responderá em até 24h.');
    document.getElementById('rec-name').value = '';
    document.getElementById('rec-email').value = '';
    document.getElementById('rec-msg-text').value = '';
  } catch (err) {
    showErr('rec-msg', err.message || 'Erro ao enviar solicitação. Tente novamente.');
  }
}

function switchTab(tab) {
  const tabs = document.querySelectorAll('#auth-tabs .tab');
  tabs.forEach(t => t.classList.remove('on'));
  const idx = tab === 'login' ? 0 : 1;
  if (tabs[idx]) tabs[idx].classList.add('on');
  const loginDiv = document.getElementById('auth-login');
  const regDiv = document.getElementById('auth-register');
  clrMsg('login-err'); clrMsg('reg-err');
  if (!loginDiv || !regDiv) return;
  const toRegister = tab === 'register';
  const outEl = toRegister ? loginDiv : regDiv;
  const inEl = toRegister ? regDiv : loginDiv;
  outEl.style.animation = toRegister ? 'tabSlideOutLeft .2s ease forwards' : 'tabSlideOutRight .2s ease forwards';
  setTimeout(() => {
    outEl.style.display = 'none';
    outEl.style.animation = '';
    inEl.style.display = '';
    void inEl.offsetWidth;
    inEl.style.animation = toRegister ? 'tabSlideInRight .22s cubic-bezier(.22,1,.36,1) forwards' : 'tabSlideInLeft .22s cubic-bezier(.22,1,.36,1) forwards';
    setTimeout(() => { inEl.style.animation = ''; }, 240);
  }, 160);
}
