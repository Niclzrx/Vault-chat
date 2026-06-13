'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
let db, genId, now;
function lazy() { if (!db) { const d = require('../db'); db = d.db(); genId = d.genId; now = d.now; } }

const { validateRegister, validateLogin } = require('../middleware/validate');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimit');

// Account lockout tracking
const loginAttempts = new Map();
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

function isLockedOut(email) {
  const attempts = loginAttempts.get(email);
  if (!attempts) return false;
  if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) return true;
  if (attempts.lockedUntil && Date.now() >= attempts.lockedUntil) {
    loginAttempts.delete(email);
    return false;
  }
  return false;
}

function recordFailedAttempt(email) {
  const attempts = loginAttempts.get(email) || { count: 0 };
  attempts.count++;
  if (attempts.count >= MAX_ATTEMPTS) {
    attempts.lockedUntil = Date.now() + LOCKOUT_DURATION;
  }
  loginAttempts.set(email, attempts);
}

function clearAttempts(email) {
  loginAttempts.delete(email);
}

router.post('/register', registerLimiter, validateRegister, async (req, res) => {
  lazy();
  const { name, email, password } = req.body;
  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email já cadastrado.' });

  const hash = bcrypt.hashSync(password, 12);
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const colors = ['#00e676','#1de9b6','#69f0ae','#00c853','#b9f6ca','#ff6b6b','#339af0','#20c997'];
  const id = genId('u');
  const created = new Date().toLocaleDateString('pt-BR');

  await db.prepare(`INSERT INTO users (id, name, email, password_hash, role, avatar, color, created, settings)
    VALUES (?, ?, ?, ?, 'user', ?, ?, ?, '{}')`)
    .run(id, name, email, hash, initials, colors[Math.floor(Math.random() * colors.length)], created);

  await db.prepare(`INSERT INTO notifications (id, user_id, icon, message, timestamp, read)
    VALUES (?, ?, '🎉', ?, ?, 0)`)
    .run(genId('n'), id, 'Conta criada! Bem-vindo ao Vault.', now());

  await db.prepare(`INSERT INTO sys_logs (event, user_name, detail, timestamp) VALUES ('REGISTER', ?, ?, ?)`)
    .run(name, email, now());

  req.session.userId = id;
  req.session.role = 'user';

  res.json({ ok: true, user: { id, name, email, avatar: initials, color: colors[Math.floor(Math.random() * colors.length)] } });
});

router.post('/login', loginLimiter, validateLogin, async (req, res) => {
  lazy();
  const { email, password } = req.body;
  
  // Check for account lockout
  if (isLockedOut(email)) {
    const attempts = loginAttempts.get(email);
    const remainingTime = Math.ceil((attempts.lockedUntil - Date.now()) / 60000);
    return res.status(429).json({ error: `Conta bloqueada. Tente novamente em ${remainingTime} minutos.` });
  }
  
  const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    recordFailedAttempt(email);
    await db.prepare(`INSERT INTO sys_logs (event, user_name, detail, timestamp) VALUES ('LOGIN_FAIL', ?, ?, ?)`)
      .run(email, 'usuário não encontrado', now());
    return res.status(401).json({ error: 'Usuário não encontrado.' });
  }

  if (user.banned) {
    if (user.banned_until && Date.now() > user.banned_until) {
      await db.prepare('UPDATE users SET banned = 0, banned_until = NULL, ban_reason = ? WHERE id = ?').run('', user.id);
    } else {
      return res.status(403).json({ error: 'Sua conta foi suspensa.' });
    }
  }

  if (!bcrypt.compareSync(password, user.password_hash)) {
    recordFailedAttempt(email);
    await db.prepare(`INSERT INTO sys_logs (event, user_name, detail, timestamp) VALUES ('LOGIN_FAIL', ?, ?, ?)`)
      .run(user.name, 'senha incorreta', now());
    return res.status(401).json({ error: 'Senha incorreta.' });
  }

  // Clear failed attempts on successful login
  clearAttempts(email);

  await db.prepare('UPDATE users SET online = 1, last_login = ? WHERE id = ?').run(now(), user.id);
  await db.prepare(`INSERT INTO sys_logs (event, user_name, detail, timestamp) VALUES ('LOGIN', ?, ?, ?)`)
    .run(user.name, 'login realizado', now());

  req.session.userId = user.id;
  req.session.role = 'user';

  res.json({
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, color: user.color, role: user.role, admin_granted: !!user.admin_granted }
  });
});

router.post('/admin-login', loginLimiter, async (req, res) => {
  lazy();
  const { id, password } = req.body || {};
  if (!id || !password) return res.status(400).json({ error: 'Preencha ID e senha.' });

  const admin = await db.prepare('SELECT * FROM admins WHERE id = ?').get(id);
  if (!admin) return res.status(401).json({ error: 'Admin não encontrado.' });

  if (!bcrypt.compareSync(password, admin.password_hash)) {
    await db.prepare(`INSERT INTO sys_logs (event, user_name, detail, timestamp) VALUES ('ADMIN_FAIL', ?, ?, ?)`)
      .run(id, 'senha incorreta', now());
    return res.status(401).json({ error: 'Senha incorreta.' });
  }

  await db.prepare(`INSERT INTO sys_logs (event, user_name, detail, timestamp) VALUES ('ADMIN_LOGIN', ?, ?, ?)`)
    .run('root', 'acesso administrativo', now());

  req.session.adminId = admin.id;
  req.session.role = 'admin';

  res.json({ ok: true, admin: { id: admin.id, name: admin.name } });
});

router.post('/logout', async (req, res) => {
  lazy();
  if (req.session.userId) {
    await db.prepare('UPDATE users SET online = 0 WHERE id = ?').run(req.session.userId);
    const user = await db.prepare('SELECT name FROM users WHERE id = ?').get(req.session.userId);
    await db.prepare(`INSERT INTO sys_logs (event, user_name, detail, timestamp) VALUES ('LOGOUT', ?, '', ?)`)
      .run(user?.name || '?', now());
  }
  if (req.session.adminId) {
    await db.prepare(`INSERT INTO sys_logs (event, user_name, detail, timestamp) VALUES ('ADMIN_LOGOUT', 'admin', '', ?)`)
      .run(now());
  }
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Erro ao encerrar sessão.' });
    res.clearCookie('vault.sid');
    res.json({ ok: true });
  });
});

router.get('/me', async (req, res) => {
  lazy();
  if (req.session.adminId) {
    const admin = await db.prepare('SELECT id, name FROM admins WHERE id = ?').get(req.session.adminId);
    return res.json({ ok: true, type: 'admin', admin });
  }
  if (!req.session.userId) return res.status(401).json({ error: 'Não autenticado.' });
  const user = await db.prepare('SELECT id, name, email, avatar, color, role, admin_granted, created, online FROM users WHERE id = ?')
    .get(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Usuário não encontrado.' });
  res.json({ ok: true, type: 'user', user: { ...user, admin_granted: !!user.admin_granted } });
});

router.post('/recovery', async (req, res) => {
  lazy();
  const { name, email, message } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'Preencha nome e email.' });
  const user = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  const id = genId('r');
  const { sanitize } = require('../middleware/validate');
  await db.prepare('INSERT INTO recovery_requests (id, name, email, message, user_id, date, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, sanitize(name), email, message || '', user?.id || null, new Date().toLocaleString('pt-BR'), 'pending');
  await db.prepare(`INSERT INTO sys_logs (event, user_name, detail, timestamp) VALUES ('RECOVERY_REQ', ?, ?, ?)`)
    .run(sanitize(name), email, now());
  res.json({ ok: true });
});

module.exports = router;
