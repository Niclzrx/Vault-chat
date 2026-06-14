'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
let db, genId, now;
function lazy() { if (!db) { const d = require('../db'); db = d.db(); genId = d.genId; now = d.now; } }

const { requireAuth } = require('../middleware/auth');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, genId('f') + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Block dangerous file types
    const blocked = [
      '.exe', '.bat', '.cmd', '.sh', '.ps1', '.msi', '.com', '.pif',
      '.html', '.htm', '.php', '.phtml', '.php3', '.php4', '.php5',
      '.js', '.vbs', '.vbe', '.wsf', '.wsh', '.scr', '.hta',
      '.cpl', '.inf', '.reg', '.rgs', '.sct', '.shb', '.shs',
      '.svg'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (blocked.includes(ext)) {
      return cb(new Error('Tipo de arquivo não permitido.'));
    }
    
    // Also check MIME type
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm',
      'audio/mpeg', 'audio/wav',
      'application/pdf',
      'application/zip', 'application/x-rar-compressed',
      'text/plain', 'text/csv',
      'application/json'
    ];
    
    // Block SVG MIME type explicitly
    if (file.mimetype === 'image/svg+xml') {
      return cb(new Error('Tipo de arquivo não permitido.'));
    }
    
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error('Tipo de arquivo não permitido.'));
    }
    
    cb(null, true);
  }
});

router.get('/', requireAuth, async (req, res) => {
  lazy();
  const userId = req.session.userId;
  const files = await db.prepare(`
    SELECT f.id, f.original_name, f.stored_name, f.type, f.size, f.uploaded, f.user_id,
           u.name as uploader_name
    FROM vault_files f
    JOIN users u ON u.id = f.user_id
    WHERE f.user_id = ?
    ORDER BY f.uploaded DESC
  `).all(userId);

  res.json({ ok: true, files });
});

router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  lazy();
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

  const userId = req.session.userId;
  const id = genId('f');

  try { await db.exec(`CREATE TABLE IF NOT EXISTS vault_files (id TEXT PRIMARY KEY, user_id TEXT, original_name TEXT, stored_name TEXT, type TEXT, size INTEGER, uploaded TEXT)`); } catch(_) {}

  await db.prepare('INSERT INTO vault_files (id, user_id, original_name, stored_name, type, size, uploaded) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, userId, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, now());

  res.json({ ok: true, file: { id, name: req.file.originalname, size: req.file.size, type: req.file.mimetype } });
});

router.get('/download/:id', requireAuth, async (req, res) => {
  lazy();
  const file = await db.prepare('SELECT * FROM vault_files WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.session.userId);
  if (!file) return res.status(404).json({ error: 'Arquivo não encontrado.' });

  const filePath = path.join(UPLOAD_DIR, file.stored_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Arquivo não encontrado no disco.' });

  res.download(filePath, file.original_name);
});

router.delete('/:id', requireAuth, async (req, res) => {
  lazy();
  const file = await db.prepare('SELECT * FROM vault_files WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.session.userId);
  if (!file) return res.status(404).json({ error: 'Arquivo não encontrado.' });

  const filePath = path.join(UPLOAD_DIR, file.stored_name);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  await db.prepare('DELETE FROM vault_files WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
