'use strict';

const express = require('express');
const router = express.Router();
let db, genId, now;
function lazy() { if (!db) { const d = require('../db'); db = d.db(); genId = d.genId; now = d.now; } }

const { requireAuth } = require('../middleware/auth');
const { sanitize } = require('../middleware/validate');
const { apiLimiter } = require('../middleware/rateLimit');

// Apply rate limiter to all user routes
router.use(apiLimiter);

router.get('/', requireAuth, async (req, res) => {
  lazy();
  const myId = req.session.userId;
  const allUsers = await db.prepare('SELECT id, name, email, avatar, color, online, last_login, admin_granted FROM users')
    .all();
  const users = allUsers.filter(u => u.id !== myId);
  res.json({ ok: true, users });
});

router.get('/contacts', requireAuth, async (req, res) => {
  lazy();
  const myId = req.session.userId;
  const users = await db.prepare('SELECT id, name, email, avatar, color, online, last_login, admin_granted FROM users WHERE id != ?')
    .all(myId);

  const contacts = await Promise.all(users.map(async (u) => {
    const unread = await db.prepare(
      'SELECT COUNT(*) as c FROM messages WHERE from_id = ? AND to_id = ? AND read = 0'
    ).get(u.id, myId);

    const lastMsg = await db.prepare(`
      SELECT encrypted, msg_type, timestamp FROM messages
      WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)
      ORDER BY timestamp DESC LIMIT 1
    `).get(myId, u.id, u.id, myId);

    const blocked = await db.prepare(
      'SELECT 1 FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?'
    ).get(myId, u.id);

    const blockedBy = await db.prepare(
      'SELECT 1 FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?'
    ).get(u.id, myId);

    return {
      ...u,
      unread: unread.c || 0,
      lastMsg: lastMsg ? { msg_type: lastMsg.msg_type, timestamp: lastMsg.timestamp } : null,
      blockedByMe: !!blocked,
      blockedMe: !!blockedBy
    };
  }));

  contacts.sort((a, b) => {
    if (a.unread > 0 && b.unread === 0) return -1;
    if (a.unread === 0 && b.unread > 0) return 1;
    const ta = a.lastMsg?.timestamp || '';
    const tb = b.lastMsg?.timestamp || '';
    return tb.localeCompare(ta);
  });

  res.json({ ok: true, contacts });
});

router.get('/unread', requireAuth, async (req, res) => {
  lazy();
  const myId = req.session.userId;
  const rows = await db.prepare(
    'SELECT from_id, COUNT(*) as count FROM messages WHERE to_id = ? AND read = 0 GROUP BY from_id'
  ).all(myId);
  const counts = {};
  rows.forEach(r => { counts[r.from_id] = r.count; });
  res.json({ ok: true, counts });
});

router.post('/block/:id', requireAuth, async (req, res) => {
  lazy();
  const myId = req.session.userId;
  const targetId = req.params.id;
  if (myId === targetId) return res.status(400).json({ error: 'Não pode bloquear a si mesmo.' });

  const target = await db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
  if (!target) return res.status(404).json({ error: 'Usuário não encontrado.' });

  const exists = await db.prepare('SELECT 1 FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?').get(myId, targetId);
  if (exists) return res.json({ ok: true, already: true });

  await db.prepare('INSERT INTO blocked_users (blocker_id, blocked_id, created) VALUES (?, ?, ?)')
    .run(myId, targetId, now());
  res.json({ ok: true });
});

router.delete('/block/:id', requireAuth, async (req, res) => {
  lazy();
  const myId = req.session.userId;
  await db.prepare('DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?')
    .run(myId, req.params.id);
  res.json({ ok: true });
});

router.get('/blocked', requireAuth, async (req, res) => {
  lazy();
  const myId = req.session.userId;
  const blocked = await db.prepare(`
    SELECT u.id, u.name, u.avatar, u.color, b.created
    FROM blocked_users b JOIN users u ON u.id = b.blocked_id
    WHERE b.blocker_id = ?
  `).all(myId);
  res.json({ ok: true, blocked });
});

router.get('/is-blocked/:id', requireAuth, async (req, res) => {
  lazy();
  const myId = req.session.userId;
  const targetId = req.params.id;
  const byMe = !!await db.prepare('SELECT 1 FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?').get(myId, targetId);
  const byThem = !!await db.prepare('SELECT 1 FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?').get(targetId, myId);
  res.json({ ok: true, byMe, byThem });
});

router.get('/:id', requireAuth, async (req, res) => {
  lazy();
  const user = await db.prepare('SELECT id, name, email, avatar, color, online, last_login, created, admin_granted, settings FROM users WHERE id = ?')
    .get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
  res.json({ ok: true, user: { ...user, admin_granted: !!user.admin_granted } });
});

router.put('/:id', requireAuth, async (req, res) => {
  lazy();
  if (req.params.id !== req.session.userId) return res.status(403).json({ error: 'Sem permissão.' });
  const { name, color, settings } = req.body || {};
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

  if (name) await db.prepare('UPDATE users SET name = ? WHERE id = ?').run(sanitize(name.trim()), req.params.id);
  if (color) await db.prepare('UPDATE users SET color = ? WHERE id = ?').run(color, req.params.id);
  if (settings) await db.prepare('UPDATE users SET settings = ? WHERE id = ?').run(JSON.stringify(settings), req.params.id);

  const updated = await db.prepare('SELECT id, name, email, avatar, color, online, settings FROM users WHERE id = ?').get(req.params.id);
  res.json({ ok: true, user: updated });
});

module.exports = router;
