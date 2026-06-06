'use strict';

const express = require('express');
const router = express.Router();
let db, now;
function lazy() { if (!db) { const d = require('../db'); db = d.db(); now = d.now; } }

const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  lazy();
  const userId = req.session.userId;
  const notifications = await db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50')
    .all(userId);
  const unread = (await db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read = 0').get(userId)).c;
  res.json({ ok: true, notifications, unread });
});

router.put('/:id', requireAuth, async (req, res) => {
  lazy();
  await db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.session.userId);
  res.json({ ok: true });
});

router.put('/', requireAuth, async (req, res) => {
  lazy();
  await db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.session.userId);
  res.json({ ok: true });
});

module.exports = router;
