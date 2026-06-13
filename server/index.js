'use strict';

require('dotenv').config();

const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const { Server } = require('socket.io');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const { init: initDB, db: getDb } = require('./db');
const { csrfToken } = require('./middleware/auth');
const { requestLogger, authLogger } = require('./middleware/audit');

const app = express();
app.set('trust proxy', 1);

const CERT_DIR = path.join(__dirname, '..', 'certs');
const useHTTPS = process.env.NODE_ENV !== 'production' && fs.existsSync(path.join(CERT_DIR, 'cert.pem')) && fs.existsSync(path.join(CERT_DIR, 'key.pem'));

let server;
if (useHTTPS) {
  const sslOptions = {
    key: fs.readFileSync(path.join(CERT_DIR, 'key.pem')),
    cert: fs.readFileSync(path.join(CERT_DIR, 'cert.pem'))
  };
  server = https.createServer(sslOptions, app);
  console.log('[VAULT] HTTPS habilitado com certificados locais');
} else {
  server = http.createServer(app);
  console.log('[VAULT] HTTP (sem HTTPS — certificados não encontrados em certs/)');
}

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:' + PORT, 'https://vault-chat-nlu3.onrender.com'];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  },
  maxHttpBufferSize: 10e6
});

(async () => {
  await initDB();
  startServer();
})();

function startServer() {

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  referrerPolicy: { policy: "no-referrer" },
  xssFilter: true,
  frameguard: false,
  hidePoweredBy: true,
  permittedCrossDomainPolicies: { permittedPolicies: "none" }
}));
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const sessionMiddleware = session({
  name: 'vault.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 30 * 60 * 1000 // 30 minutes session timeout
  }
});
app.use(sessionMiddleware);

// Session timeout middleware - reset on activity
app.use((req, res, next) => {
  if (req.session && req.session.userId) {
    const now = Date.now();
    if (req.session.lastActivity && (now - req.session.lastActivity) > 30 * 60 * 1000) {
      req.session.destroy();
      return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    }
    req.session.lastActivity = now;
  }
  next();
});

app.use(csrfToken);

// Audit logging
app.use(requestLogger);
app.use('/api/auth', authLogger);

app.use(express.static(path.join(__dirname, '..', 'public')));

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const groupRoutes = require('./routes/groups');
const fileRoutes = require('./routes/files');
const notifRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/notifications', notifRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/csrf', (req, res) => {
  res.json({ csrfToken: res.locals.csrfToken });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const onlineUsers = new Map();

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, () => {
    const session = socket.request.session;
    if (session && (session.userId || session.adminId)) {
      next();
    } else {
      next(new Error('Não autenticado'));
    }
  });
});

io.on('connection', (socket) => {
  const session = socket.request.session;
  const userId = session.userId;
  const adminId = session.adminId;

  if (userId) {
    onlineUsers.set(userId, socket.id);
    const db = getDb();
    db.prepare('UPDATE users SET online = 1 WHERE id = ?').run(userId);
    io.emit('user:online', { userId, online: true });
  }

  socket.on('chat:join', (data) => {
    const room = `chat:${[data.from, data.to].sort().join('_')}`;
    socket.join(room);
  });

  socket.on('chat:send', async (data) => {
    try {
      const db = getDb();
      const { to, encrypted, encrypted_image, msg_type } = data;
      const from = userId;
      if (!from || !to) return;
      if (!encrypted && !encrypted_image) return;

      const blockedByTarget = await db.prepare('SELECT 1 FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?').get(to, from);
      if (blockedByTarget) return;

      const blockedBySender = await db.prepare('SELECT 1 FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?').get(from, to);
      if (blockedBySender) return;

      const id = 'm' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
      const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const type = msg_type || (encrypted_image ? 'image' : 'text');

      await db.prepare('INSERT INTO messages (id, from_id, to_id, encrypted, encrypted_image, msg_type, timestamp, read) VALUES (?, ?, ?, ?, ?, ?, ?, 0)')
        .run(id, from, to, encrypted || '', encrypted_image || '', type, timestamp);

      const fromUser = await db.prepare('SELECT name FROM users WHERE id = ?').get(from);
      await db.prepare('INSERT INTO notifications (id, user_id, icon, message, timestamp, read) VALUES (?, ?, ?, ?, ?, 0)')
        .run('n' + Date.now(), to, '▸', `Nova mensagem de ${fromUser?.name || '?'}`, timestamp);

      const room = `chat:${[from, to].sort().join('_')}`;
      io.to(room).emit('chat:message', { id, from, to, encrypted, encrypted_image, msg_type: type, timestamp });

      const toSocket = onlineUsers.get(to);
      if (toSocket) io.to(toSocket).emit('chat:notify', { from, fromName: fromUser?.name });
    } catch (_) {}
  });

  socket.on('chat:typing', (data) => {
    const room = `chat:${[userId, data.to].sort().join('_')}`;
    socket.to(room).emit('chat:typing', { from: userId });
  });

  socket.on('group:join', (data) => {
    socket.join(`group:${data.groupId}`);
  });

  socket.on('group:send', async (data) => {
    try {
      const db = getDb();
      const { groupId, encrypted } = data;
      if (!userId || !groupId || !encrypted) return;

      const group = await db.prepare('SELECT * FROM groups_t WHERE id = ?').get(groupId);
      if (!group) return;

      const isMember = await db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, userId);
      if (!isMember) return;

      const id = 'gm' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
      const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      await db.prepare('INSERT INTO group_messages (id, group_id, from_id, encrypted, timestamp) VALUES (?, ?, ?, ?, ?)')
        .run(id, groupId, userId, encrypted, timestamp);

      const fromUser = await db.prepare('SELECT name FROM users WHERE id = ?').get(userId);
      const members = await db.prepare('SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ?').all(groupId, userId);

      for (const m of members) {
        await db.prepare('INSERT INTO notifications (id, user_id, icon, message, timestamp, read) VALUES (?, ?, ?, ?, ?, 0)')
          .run('n' + Date.now(), m.user_id, '◗', `${fromUser?.name || '?'} no grupo "${group.name}"`, timestamp);
      }

      io.to(`group:${groupId}`).emit('group:message', { id, group_id: groupId, from_id: userId, encrypted, timestamp, from_name: fromUser?.name, from_avatar: fromUser?.avatar, from_color: fromUser?.color });
    } catch (_) {}
  });

  socket.on('group:typing', (data) => {
    socket.to(`group:${data.groupId}`).emit('group:typing', { from: userId, groupId: data.groupId });
  });

  socket.on('disconnect', async () => {
    if (userId) {
      onlineUsers.delete(userId);
      const db = getDb();
      await db.prepare('UPDATE users SET online = 0 WHERE id = ?').run(userId);
      io.emit('user:online', { userId, online: false });
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const proto = useHTTPS ? 'https' : 'http';
  console.log(`[VAULT] Servidor rodando em ${proto}://localhost:${PORT}`);
  console.log(`[VAULT] Ambiente: ${process.env.NODE_ENV || 'development'}`);
  if (useHTTPS) console.log('[VAULT] Certificados: localhost+2.pem (válido até 2028)');
});

} // end startServer
