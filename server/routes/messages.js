'use strict';

const express = require('express');
const router = express.Router();
let db, genId, now;
function lazy() { if (!db) { const d = require('../db'); db = d.db(); genId = d.genId; now = d.now; } }

const { requireAuth } = require('../middleware/auth');
const { msgLimiter } = require('../middleware/rateLimit');

router.get('/:userId', requireAuth, async (req, res) => {
  lazy();
  const myId = req.session.userId;
  const otherId = req.params.userId;
  const key = [myId, otherId].sort().join('_');

  const messages = await db.prepare(`
    SELECT m.*, u.name as from_name, u.avatar as from_avatar, u.color as from_color
    FROM messages m
    JOIN users u ON u.id = m.from_id
    WHERE (m.from_id = ? AND m.to_id = ?) OR (m.from_id = ? AND m.to_id = ?)
    ORDER BY m.timestamp ASC
  `).all(myId, otherId, otherId, myId);

  const msgs = messages.map(m => ({
    ...m,
    encrypted_image: m.encrypted_image || '',
    msg_type: m.msg_type || 'text'
  }));

  await db.prepare('UPDATE messages SET read = 1 WHERE from_id = ? AND to_id = ? AND read = 0')
    .run(otherId, myId);

  res.json({ ok: true, messages: msgs, convKey: key });
});

router.post('/', requireAuth, msgLimiter, async (req, res) => {
  lazy();
  const { to, encrypted, encrypted_image, msg_type } = req.body || {};
  if (!to) return res.status(400).json({ error: 'Dados inválidos.' });
  if (!encrypted && !encrypted_image) return res.status(400).json({ error: 'Dados inválidos.' });

  const from = req.session.userId;

  const blockedByTarget = await db.prepare('SELECT 1 FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?').get(to, from);
  if (blockedByTarget) return res.status(403).json({ error: 'Você foi bloqueado por este usuário.' });

  const blockedBySender = await db.prepare('SELECT 1 FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?').get(from, to);
  if (blockedBySender) return res.status(403).json({ error: 'Você bloqueou este usuário.' });

  const toUser = await db.prepare('SELECT id, name FROM users WHERE id = ?').get(to);
  if (!toUser) return res.status(404).json({ error: 'Destinatário não encontrado.' });

  const id = genId('m');
  const timestamp = now();
  const type = msg_type || (encrypted_image ? 'image' : 'text');

  await db.prepare('INSERT INTO messages (id, from_id, to_id, encrypted, encrypted_image, msg_type, timestamp, read) VALUES (?, ?, ?, ?, ?, ?, ?, 0)')
    .run(id, from, to, encrypted || '', encrypted_image || '', type, timestamp);

  const fromUser = await db.prepare('SELECT name FROM users WHERE id = ?').get(from);

  await db.prepare('INSERT INTO notifications (id, user_id, icon, message, timestamp, read) VALUES (?, ?, ?, ?, ?, 0)')
    .run(genId('n'), to, '▸', `Nova mensagem de ${fromUser?.name || '?'}`, timestamp);

  res.json({ ok: true, message: { id, from, to, encrypted, encrypted_image, msg_type: type, timestamp } });
});

router.delete('/conversation/:userId', requireAuth, async (req, res) => {
  lazy();
  const myId = req.session.userId;
  const otherId = req.params.userId;
  await db.prepare('DELETE FROM messages WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)')
    .run(myId, otherId, otherId, myId);
  res.json({ ok: true });
});

router.delete('/:msgId', requireAuth, async (req, res) => {
  lazy();
  const myId = req.session.userId;
  const msgId = req.params.msgId;
  const msg = await db.prepare('SELECT * FROM messages WHERE id = ?').get(msgId);
  if (!msg) return res.status(404).json({ error: 'Mensagem não encontrada.' });
  if (msg.from_id !== myId) return res.status(403).json({ error: 'Sem permissão.' });
  await db.prepare('DELETE FROM messages WHERE id = ?').run(msgId);
  res.json({ ok: true });
});

module.exports = router;
