'use strict';

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const SALT_ROUNDS = 12;

let db;
let isPG = false;

async function init() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (DATABASE_URL) {
    return await initPG(DATABASE_URL);
  }
  return initSQLite();
}

function initSQLite() {
  const Database = require('better-sqlite3');
  const path = require('path');
  const DB_PATH = path.join(__dirname, '..', 'vault.db');
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  isPG = false;

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      avatar TEXT,
      color TEXT,
      online INTEGER DEFAULT 0,
      created TEXT,
      last_login TEXT,
      banned INTEGER DEFAULT 0,
      ban_reason TEXT DEFAULT '',
      banned_until INTEGER DEFAULT NULL,
      admin_granted INTEGER DEFAULT 0,
      settings TEXT DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      encrypted TEXT NOT NULL,
      encrypted_image TEXT DEFAULT '',
      msg_type TEXT DEFAULT 'text',
      timestamp TEXT,
      read INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS groups_t (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      icon TEXT DEFAULT '◗',
      created TEXT
    );
    CREATE TABLE IF NOT EXISTS group_members (
      group_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      PRIMARY KEY (group_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS group_messages (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      from_id TEXT NOT NULL,
      encrypted TEXT NOT NULL,
      encrypted_image TEXT DEFAULT '',
      msg_type TEXT DEFAULT 'text',
      timestamp TEXT
    );
    CREATE TABLE IF NOT EXISTS sys_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event TEXT,
      user_name TEXT,
      detail TEXT,
      timestamp TEXT
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      icon TEXT,
      message TEXT,
      timestamp TEXT,
      read INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS recovery_requests (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      message TEXT,
      user_id TEXT,
      date TEXT,
      status TEXT DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS blocked_users (
      blocker_id TEXT NOT NULL,
      blocked_id TEXT NOT NULL,
      created TEXT,
      PRIMARY KEY (blocker_id, blocked_id)
    );
    CREATE TABLE IF NOT EXISTS vault_files (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      original_name TEXT,
      stored_name TEXT,
      type TEXT,
      size INTEGER,
      uploaded TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_id);
    CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_id);
    CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  `);

  try { db.exec(`ALTER TABLE messages ADD COLUMN encrypted_image TEXT DEFAULT ''`); } catch (_) {}
  try { db.exec(`ALTER TABLE messages ADD COLUMN msg_type TEXT DEFAULT 'text'`); } catch (_) {}
  try { db.exec(`ALTER TABLE group_messages ADD COLUMN encrypted_image TEXT DEFAULT ''`); } catch (_) {}
  try { db.exec(`ALTER TABLE group_messages ADD COLUMN msg_type TEXT DEFAULT 'text'`); } catch (_) {}

  seedSQLite();
  return db;
}

function seedSQLite() {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (userCount > 0) return;
  const demoUsers = [
    { id: 'u2', name: 'Bruno Costa', email: 'bruno@vault.app', pass: crypto.randomBytes(12).toString('base64'), color: '#1de9b6', avatar: 'BC' },
    { id: 'u3', name: 'Carla Dias', email: 'carla@vault.app', pass: crypto.randomBytes(12).toString('base64'), color: '#69f0ae', avatar: 'CD' }
  ];
  const insertUser = db.prepare(`INSERT INTO users (id, name, email, password_hash, role, avatar, color, online, created, last_login, settings) VALUES (?, ?, ?, ?, 'user', ?, ?, 0, ?, 'nunca', '{}')`);
  const nowDate = new Date().toLocaleDateString('pt-BR');
  for (const u of demoUsers) {
    const hash = bcrypt.hashSync(u.pass, SALT_ROUNDS);
    insertUser.run(u.id, u.name, u.email, hash, u.avatar, u.color, nowDate);
    console.log(`[DB] Demo user: ${u.email} / ${u.pass}`);
  }
  const adminPass = process.env.ADMIN_PASS || crypto.randomBytes(16).toString('base64');
  const adminHash = bcrypt.hashSync(adminPass, SALT_ROUNDS);
  db.prepare('INSERT INTO admins (id, name, password_hash) VALUES (?, ?, ?)').run(process.env.ADMIN_ID || 'root', process.env.ADMIN_NAME || 'Vault Admin', adminHash);
  console.log(`[DB] Admin: ${process.env.ADMIN_ID || 'root'} / ${adminPass}`);
}

async function initPG(url) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  isPG = true;

  const client = await pool.connect();
  try {
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        avatar TEXT,
        color TEXT,
        online INTEGER DEFAULT 0,
        created TEXT,
        last_login TEXT,
        banned INTEGER DEFAULT 0,
        ban_reason TEXT DEFAULT '',
        banned_until TEXT DEFAULT NULL,
        admin_granted INTEGER DEFAULT 0,
        settings TEXT DEFAULT '{}'
      )`,
      `CREATE TABLE IF NOT EXISTS admins (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        encrypted TEXT NOT NULL,
        encrypted_image TEXT DEFAULT '',
        msg_type TEXT DEFAULT 'text',
        timestamp TEXT,
        read INTEGER DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS groups_t (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        creator_id TEXT NOT NULL,
        icon TEXT DEFAULT '◗',
        created TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS group_members (
        group_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        is_admin INTEGER DEFAULT 0,
        PRIMARY KEY (group_id, user_id)
      )`,
      `CREATE TABLE IF NOT EXISTS group_messages (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        from_id TEXT NOT NULL,
        encrypted TEXT NOT NULL,
        encrypted_image TEXT DEFAULT '',
        msg_type TEXT DEFAULT 'text',
        timestamp TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS sys_logs (
        id SERIAL PRIMARY KEY,
        event TEXT,
        user_name TEXT,
        detail TEXT,
        timestamp TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        icon TEXT,
        message TEXT,
        timestamp TEXT,
        read INTEGER DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS recovery_requests (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT,
        message TEXT,
        user_id TEXT,
        date TEXT,
        status TEXT DEFAULT 'pending'
      )`,
      `CREATE TABLE IF NOT EXISTS blocked_users (
        blocker_id TEXT NOT NULL,
        blocked_id TEXT NOT NULL,
        created TEXT,
        PRIMARY KEY (blocker_id, blocked_id)
      )`,
      `CREATE TABLE IF NOT EXISTS vault_files (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        original_name TEXT,
        stored_name TEXT,
        type TEXT,
        size INTEGER,
        uploaded TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_id)`,
      `CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_id)`,
      `CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_id)`,
      `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`
    ];

    for (const sql of tables) {
      await client.query(sql);
    }

    const userCount = (await client.query('SELECT COUNT(*) as c FROM users')).rows[0].c;
    if (parseInt(userCount) === 0) {
      const demoUsers = [
        { id: 'u2', name: 'Bruno Costa', email: 'bruno@vault.app', pass: crypto.randomBytes(12).toString('base64'), color: '#1de9b6', avatar: 'BC' },
        { id: 'u3', name: 'Carla Dias', email: 'carla@vault.app', pass: crypto.randomBytes(12).toString('base64'), color: '#69f0ae', avatar: 'CD' }
      ];
      const nowDate = new Date().toLocaleDateString('pt-BR');
      for (const u of demoUsers) {
        const hash = bcrypt.hashSync(u.pass, SALT_ROUNDS);
        await client.query(
          'INSERT INTO users (id, name, email, password_hash, role, avatar, color, online, created, last_login, settings) VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,\'nunca\',\'{}\')',
          [u.id, u.name, u.email, hash, 'user', u.avatar, u.color, nowDate]
        );
        console.log(`[DB] Demo user: ${u.email} / ${u.pass}`);
      }
      const adminPass = process.env.ADMIN_PASS || crypto.randomBytes(16).toString('base64');
      const adminHash = bcrypt.hashSync(adminPass, SALT_ROUNDS);
      await client.query(
        'INSERT INTO admins (id, name, password_hash) VALUES ($1,$2,$3)',
        [process.env.ADMIN_ID || 'root', process.env.ADMIN_NAME || 'Vault Admin', adminHash]
      );
      console.log(`[DB] Admin: ${process.env.ADMIN_ID || 'root'} / ${adminPass}`);
    }
  } finally {
    client.release();
  }

  db = createPGWrapper(pool);
  return db;
}

function createPGWrapper(pool) {
  return {
    _pool: pool,

    prepare(sql) {
      let idx = 0;
      const converted = sql.replace(/\?/g, () => '$' + (++idx));

      return {
        all(...params) {
          return pool.query(converted, params).then(r => r.rows).catch(() => []);
        },
        get(...params) {
          return pool.query(converted, params).then(r => r.rows[0] || undefined).catch(() => undefined);
        },
        run(...params) {
          return pool.query(converted, params).then(r => ({ changes: r.rowCount || 0 })).catch(() => ({ changes: 0 }));
        }
      };
    },

    exec(sql) {
      const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
      return stmts.reduce((prev, s) => prev.then(() => pool.query(s)), Promise.resolve()).then(() => {});
    }
  };
}

function pgPrepare(sql) {
  let idx = 0;
  const converted = sql.replace(/\?/g, () => '$' + (++idx));
  return converted;
}

function genId(prefix = '') {
  return prefix + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
}

function now() {
  const d = new Date();
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function dateNow() {
  return new Date().toLocaleDateString('pt-BR');
}

function getDb() { return db; }
function getIsPG() { return isPG; }

module.exports = { init, db: getDb, isPG: getIsPG, genId, now, dateNow, SALT_ROUNDS, pgPrepare };
