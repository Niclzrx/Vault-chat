'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
let db, genId, now;
function lazy() { if (!db) { const d = require('../db'); db = d.db(); genId = d.genId; now = d.now; } }

const { requireAdmin } = require('../middleware/auth');
const { sanitize } = require('../middleware/validate');

router.get('/stats', requireAdmin, async (req, res) => {
  lazy();
  const users = (await db.prepare('SELECT COUNT(*) as c FROM users').get()).c;
  const online = (await db.prepare('SELECT COUNT(*) as c FROM users WHERE online = 1').get()).c;
  const banned = (await db.prepare('SELECT COUNT(*) as c FROM users WHERE banned = 1').get()).c;
  const msgs = (await db.prepare('SELECT COUNT(*) as c FROM messages').get()).c;
  const groups = (await db.prepare('SELECT COUNT(*) as c FROM groups_t').get()).c;
  const logs = (await db.prepare('SELECT COUNT(*) as c FROM sys_logs').get()).c;
  const recovery = (await db.prepare('SELECT COUNT(*) as c FROM recovery_requests WHERE status = ?').get('pending')).c;
  res.json({ ok: true, stats: { users, online, banned, msgs, groups, logs, recovery } });
});

router.get('/users', requireAdmin, async (req, res) => {
  lazy();
  const users = await db.prepare('SELECT id, name, email, avatar, color, online, last_login, created, banned, ban_reason, banned_until, admin_granted FROM users').all();
  res.json({ ok: true, users });
});

router.put('/users/:id/ban', requireAdmin, async (req, res) => {
  lazy();
  const { duration, reason } = req.body || {};
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

  const until = duration === -1 ? null : (duration ? Date.now() + duration : null);
  await db.prepare('UPDATE users SET banned = 1, ban_reason = ?, banned_until = ?, online = 0 WHERE id = ?')
    .run(reason || '', until, req.params.id);

  await db.prepare('INSERT INTO notifications (id, user_id, icon, message, timestamp, read) VALUES (?, ?, ?, ?, ?, 0)')
    .run(genId('n'), req.params.id, '⊘', `Sua conta foi suspensa. Motivo: ${reason || 'Violação dos termos'}`, now());

  await db.prepare(`INSERT INTO sys_logs (event, user_name, detail, timestamp) VALUES ('BAN', ?, ?, ?)`)
    .run(user.name, reason || 'sem motivo', now());

  res.json({ ok: true });
});

router.put('/users/:id/unban', requireAdmin, async (req, res) => {
  lazy();
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

  await db.prepare('UPDATE users SET banned = 0, ban_reason = ?, banned_until = NULL WHERE id = ?').run('', req.params.id);
  await db.prepare('INSERT INTO notifications (id, user_id, icon, message, timestamp, read) VALUES (?, ?, ?, ?, ?, 0)')
    .run(genId('n'), req.params.id, '✓', 'Sua suspensão foi removida.', now());

  await db.prepare(`INSERT INTO sys_logs (event, user_name, detail, timestamp) VALUES ('UNBAN', ?, '', ?)`)
    .run(user.name, now());

  res.json({ ok: true });
});

router.put('/users/:id/kick', requireAdmin, async (req, res) => {
  lazy();
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
  if (req.params.id === req.session.userId) {
    return res.status(400).json({ error: 'Não é possível desconectar a si mesmo.' });
  }

  await db.prepare('UPDATE users SET online = 0 WHERE id = ?').run(req.params.id);
  await db.prepare('INSERT INTO notifications (id, user_id, icon, message, timestamp, read) VALUES (?, ?, ?, ?, ?, 0)')
    .run(genId('n'), req.params.id, '🔌', 'Você foi desconectado pelo administrador.', now());

  await db.prepare(`INSERT INTO sys_logs (event, user_name, detail, timestamp) VALUES ('KICK', ?, 'desconectado pelo admin', ?)`)
    .run(user.name, now());

  const { onlineUsers } = require('../index');
  if (onlineUsers && onlineUsers.has(req.params.id)) {
    const sockId = onlineUsers.get(req.params.id);
    const io = req.app.get('io');
    if (io) io.to(sockId).emit('user:kicked');
  }

  res.json({ ok: true });
});

router.put('/users/:id/grant-admin', requireAdmin, async (req, res) => {
  lazy();
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

  await db.prepare('UPDATE users SET admin_granted = 1 WHERE id = ?').run(req.params.id);
  await db.prepare('INSERT INTO notifications (id, user_id, icon, message, timestamp, read) VALUES (?, ?, ?, ?, ?, 0)')
    .run(genId('n'), req.params.id, '★', 'Privilégios de administrador concedidos!', now());

  await db.prepare(`INSERT INTO sys_logs (event, user_name, detail, timestamp) VALUES ('ADMIN_GRANT', ?, '', ?)`)
    .run(user.name, now());

  res.json({ ok: true });
});

router.put('/users/:id/revoke-admin', requireAdmin, async (req, res) => {
  lazy();
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
  if (req.params.id === req.session.userId) {
    return res.status(400).json({ error: 'Não é possível remover seu próprio acesso de admin.' });
  }

  await db.prepare('UPDATE users SET admin_granted = 0 WHERE id = ?').run(req.params.id);
  await db.prepare(`INSERT INTO sys_logs (event, user_name, detail, timestamp) VALUES ('ADMIN_REVOKE', ?, '', ?)`)
    .run(user.name, now());

  res.json({ ok: true });
});

router.get('/logs', requireAdmin, async (req, res) => {
  lazy();
  const logs = await db.prepare('SELECT * FROM sys_logs ORDER BY id DESC LIMIT 500').all();
  res.json({ ok: true, logs });
});

router.get('/recovery', requireAdmin, async (req, res) => {
  lazy();
  const requests = await db.prepare('SELECT * FROM recovery_requests ORDER BY date DESC').all();
  res.json({ ok: true, requests });
});

router.put('/recovery/:id', requireAdmin, async (req, res) => {
  lazy();
  const { status, new_password } = req.body || {};
  const req_ = await db.prepare('SELECT * FROM recovery_requests WHERE id = ?').get(req.params.id);
  if (!req_) return res.status(404).json({ error: 'Solicitação não encontrada.' });

  await db.prepare('UPDATE recovery_requests SET status = ? WHERE id = ?').run(status || 'resolved', req.params.id);

  if (new_password && req_.user_id) {
    const hash = bcrypt.hashSync(new_password, 12);
    await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req_.user_id);
    await db.prepare('INSERT INTO notifications (id, user_id, icon, message, timestamp, read) VALUES (?, ?, ?, ?, ?, 0)')
      .run(genId('n'), req_.user_id, '✉', 'Sua senha foi redefinida pelo administrador.', now());
  }

  await db.prepare(`INSERT INTO sys_logs (event, user_name, detail, timestamp) VALUES ('RECOVERY_RESOLVE', ?, ?, ?)`)
    .run(req_.name, status || 'resolved', now());

  res.json({ ok: true });
});

router.get('/config', requireAdmin, async (req, res) => {
  lazy();
  const users = (await db.prepare('SELECT COUNT(*) as c FROM users').get()).c;
  const groups = (await db.prepare('SELECT COUNT(*) as c FROM groups_t').get()).c;
  const logs = (await db.prepare('SELECT COUNT(*) as c FROM sys_logs').get()).c;
  const recovery = (await db.prepare('SELECT COUNT(*) as c FROM recovery_requests').get()).c;
  res.json({ ok: true, config: { users, groups, logs, recovery } });
});

router.put('/config/admin-pass', requireAdmin, async (req, res) => {
  lazy();
  const { new_password } = req.body || {};
  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ error: 'Mínimo 8 caracteres.' });
  }
  const hash = bcrypt.hashSync(new_password, 12);
  await db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, req.session.adminId);
  await db.prepare(`INSERT INTO sys_logs (event, user_name, detail, timestamp) VALUES ('ADMIN_PASS_CHANGE', 'admin', '', ?)`)
    .run(now());
  res.json({ ok: true });
});

router.post('/export', requireAdmin, async (req, res) => {
  lazy();
  const data = {
    users: await db.prepare('SELECT id, name, email, role, online, created, last_login, banned, admin_granted FROM users').all(),
    groups: await db.prepare('SELECT * FROM groups_t').all(),
    logs: await db.prepare('SELECT * FROM sys_logs ORDER BY id DESC LIMIT 500').all(),
    recovery: await db.prepare('SELECT * FROM recovery_requests').all()
  };
  res.json({ ok: true, data });
});

router.post('/reset', requireAdmin, async (req, res) => {
  lazy();
  const stmts = [
    'DELETE FROM messages',
    'DELETE FROM group_messages',
    'DELETE FROM group_members',
    'DELETE FROM groups_t',
    'DELETE FROM notifications',
    'DELETE FROM sys_logs',
    'DELETE FROM recovery_requests',
    'DELETE FROM vault_files',
    'DELETE FROM blocked_users'
  ];
  for (const sql of stmts) {
    await db.prepare(sql).run();
  }
  await db.prepare('UPDATE users SET online = 0, banned = 0, ban_reason = ?, banned_until = NULL, admin_granted = 0').run('');
  await db.prepare(`INSERT INTO sys_logs (event, user_name, detail, timestamp) VALUES ('SYSTEM_RESET', 'admin', 'todos os dados resetados', ?)`)
    .run(now());

  const { onlineUsers } = require('../index');
  if (onlineUsers) {
    const io = req.app.get('io');
    for (const [uid, sockId] of onlineUsers) {
      if (io) io.to(sockId).emit('user:kicked');
    }
    onlineUsers.clear();
  }

  res.json({ ok: true });
});

module.exports = router;
