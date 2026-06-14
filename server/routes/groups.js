'use strict';

const express = require('express');
const router = express.Router();
let db, genId, now, dateNow;
function lazy() { if (!db) { const d = require('../db'); db = d.db(); genId = d.genId; now = d.now; dateNow = d.dateNow; } }

const { requireAuth } = require('../middleware/auth');
const { msgLimiter } = require('../middleware/rateLimit');
const { sanitize } = require('../middleware/validate');

router.get('/', requireAuth, async (req, res) => {
  lazy();
  const userId = req.session.userId;
  const isAdmin = !!req.session.adminId;
  
  let groups;
  if (isAdmin) {
    // Admin can see all groups
    groups = await db.prepare(`
      SELECT g.*
      FROM groups_t g
      ORDER BY g.created DESC
    `).all();
  } else {
    // Regular user can only see groups they're a member of
    groups = await db.prepare(`
      SELECT g.*, gm.is_admin
      FROM groups_t g
      JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
      ORDER BY g.created DESC
    `).all(userId);
  }

  for (const g of groups) {
    g.memberCount = (await db.prepare('SELECT COUNT(*) as c FROM group_members WHERE group_id = ?').get(g.id)).c;
    g.msgCount = (await db.prepare('SELECT COUNT(*) as c FROM group_messages WHERE group_id = ?').get(g.id)).c;
  }

  res.json({ ok: true, groups });
});

router.post('/', requireAuth, async (req, res) => {
  lazy();
  const { name, members } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Informe um nome para o grupo.' });

  const userId = req.session.userId;
  const id = genId('g');
  const created = dateNow();

  await db.prepare('INSERT INTO groups_t (id, name, creator_id, created) VALUES (?, ?, ?, ?)')
    .run(id, sanitize(name), userId, created);

  await db.prepare('INSERT INTO group_members (group_id, user_id, is_admin) VALUES (?, ?, 1)')
    .run(id, userId);

  const allMembers = new Set([userId, ...(members || [])]);
  for (const uid of allMembers) {
    if (uid === userId) continue;
    const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(uid);
    if (user) {
      await db.prepare('INSERT INTO group_members (group_id, user_id, is_admin) VALUES (?, ?, 0) ON CONFLICT DO NOTHING')
        .run(id, uid);
      await db.prepare('INSERT INTO notifications (id, user_id, icon, message, timestamp, read) VALUES (?, ?, ?, ?, ?, 0)')
        .run(genId('n'), uid, '◗', `Você foi adicionado ao grupo "${sanitize(name)}"`, now());
    }
  }

  await db.prepare(`INSERT INTO sys_logs (event, user_name, detail, timestamp) VALUES ('GROUP_CREATE', ?, ?, ?)`)
    .run((await db.prepare('SELECT name FROM users WHERE id = ?').get(userId))?.name || '?', sanitize(name), now());

  res.json({ ok: true, group: { id, name: sanitize(name), creator_id: userId, created } });
});

router.get('/:id', requireAuth, async (req, res) => {
  lazy();
  const group = await db.prepare('SELECT * FROM groups_t WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Grupo não encontrado.' });

  const isMember = await db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?')
    .get(group.id, req.session.userId);
  if (!isMember) return res.status(403).json({ error: 'Você não é membro deste grupo.' });

  const members = await db.prepare(`
    SELECT u.id, u.name, u.avatar, u.color, u.online, gm.is_admin
    FROM users u
    JOIN group_members gm ON gm.user_id = u.id
    WHERE gm.group_id = ?
  `).all(group.id);

  res.json({ ok: true, group, members });
});

router.get('/:id/messages', requireAuth, async (req, res) => {
  lazy();
  const group = await db.prepare('SELECT * FROM groups_t WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Grupo não encontrado.' });

  const isMember = await db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?')
    .get(group.id, req.session.userId);
  if (!isMember) return res.status(403).json({ error: 'Você não é membro deste grupo.' });

  const messages = await db.prepare(`
    SELECT gm.*, u.name as from_name, u.avatar as from_avatar, u.color as from_color
    FROM group_messages gm
    JOIN users u ON u.id = gm.from_id
    WHERE gm.group_id = ?
    ORDER BY gm.timestamp ASC
  `).all(group.id);

  res.json({ ok: true, messages, grpKey: 'group_' + group.id });
});

router.post('/:id/messages', requireAuth, msgLimiter, async (req, res) => {
  lazy();
  const { encrypted } = req.body || {};
  if (!encrypted) return res.status(400).json({ error: 'Dados inválidos.' });

  const group = await db.prepare('SELECT * FROM groups_t WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Grupo não encontrado.' });

  const isMember = await db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?')
    .get(group.id, req.session.userId);
  if (!isMember) return res.status(403).json({ error: 'Você não é membro deste grupo.' });

  const id = genId('gm');
  const timestamp = now();

  await db.prepare('INSERT INTO group_messages (id, group_id, from_id, encrypted, timestamp) VALUES (?, ?, ?, ?, ?)')
    .run(id, group.id, req.session.userId, encrypted, timestamp);

  const fromUser = await db.prepare('SELECT name FROM users WHERE id = ?').get(req.session.userId);
  const members = await db.prepare('SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ?')
    .all(group.id, req.session.userId);

  for (const m of members) {
    await db.prepare('INSERT INTO notifications (id, user_id, icon, message, timestamp, read) VALUES (?, ?, ?, ?, ?, 0)')
      .run(genId('n'), m.user_id, '◗', `${fromUser?.name || '?'} no grupo "${group.name}"`, timestamp);
  }

  res.json({ ok: true, message: { id, group_id: group.id, from_id: req.session.userId, encrypted, timestamp } });
});

router.post('/:id/members', requireAuth, async (req, res) => {
  lazy();
  const { userId } = req.body || {};
  const group = await db.prepare('SELECT * FROM groups_t WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Grupo não encontrado.' });

  const isAdmin = await db.prepare('SELECT is_admin FROM group_members WHERE group_id = ? AND user_id = ?')
    .get(group.id, req.session.userId);
  if (!isAdmin?.is_admin) return res.status(403).json({ error: 'Apenas administradores podem adicionar membros.' });

  const user = await db.prepare('SELECT id, name FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

  const existing = await db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(group.id, userId);
  if (existing) return res.status(409).json({ error: 'Usuário já é membro.' });

  await db.prepare('INSERT INTO group_members (group_id, user_id, is_admin) VALUES (?, ?, 0)').run(group.id, userId);
  await db.prepare('INSERT INTO notifications (id, user_id, icon, message, timestamp, read) VALUES (?, ?, ?, ?, ?, 0)')
    .run(genId('n'), userId, '◗', `Você foi adicionado ao grupo "${group.name}"`, now());

  res.json({ ok: true });
});

router.delete('/:id/members/:uid', requireAuth, async (req, res) => {
  lazy();
  const group = await db.prepare('SELECT * FROM groups_t WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Grupo não encontrado.' });

  const isAdmin = await db.prepare('SELECT is_admin FROM group_members WHERE group_id = ? AND user_id = ?')
    .get(group.id, req.session.userId);
  if (!isAdmin?.is_admin) return res.status(403).json({ error: 'Apenas administradores podem remover membros.' });

  await db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(group.id, req.params.uid);

  await db.prepare('INSERT INTO notifications (id, user_id, icon, message, timestamp, read) VALUES (?, ?, ?, ?, ?, 0)')
    .run(genId('n'), req.params.uid, '◗', `Você foi removido do grupo "${group.name}"`, now());

  res.json({ ok: true });
});

router.put('/:id', requireAuth, async (req, res) => {
  lazy();
  const { name } = req.body || {};
  const group = await db.prepare('SELECT * FROM groups_t WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Grupo não encontrado.' });

  const isAdmin = await db.prepare('SELECT is_admin FROM group_members WHERE group_id = ? AND user_id = ?')
    .get(group.id, req.session.userId);
  if (!isAdmin?.is_admin) return res.status(403).json({ error: 'Sem permissão.' });

  if (name) await db.prepare('UPDATE groups_t SET name = ? WHERE id = ?').run(sanitize(name), group.id);
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, async (req, res) => {
  lazy();
  const group = await db.prepare('SELECT * FROM groups_t WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Grupo não encontrado.' });

  const isAdmin = !!req.session.adminId;
  if (!isAdmin && group.creator_id !== req.session.userId) {
    return res.status(403).json({ error: 'Apenas o criador ou administrador pode excluir o grupo.' });
  }

  await db.prepare('DELETE FROM group_messages WHERE group_id = ?').run(group.id);
  await db.prepare('DELETE FROM group_members WHERE group_id = ?').run(group.id);
  await db.prepare('DELETE FROM groups_t WHERE id = ?').run(group.id);

  res.json({ ok: true });
});

module.exports = router;
