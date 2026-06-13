'use strict';

const crypto = require('crypto');

function requireAuth(req, res, next) {
  if (!req.session || (!req.session.userId && !req.session.adminId)) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.adminId) {
    return res.status(403).json({ error: 'Acesso negado.' });
  }
  next();
}

function csrfToken(req, res, next) {
  if (req.method === 'GET') {
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    res.locals.csrfToken = req.session.csrfToken;
  }
  next();
}

function csrfCheck(req, res, next) {
  // Skip CSRF for login and register (they don't have session yet)
  if (req.path === '/login' || req.path === '/register' || req.path === '/admin-login') {
    return next();
  }
  
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const token = req.headers['x-csrf-token'] || req.body?._csrf;
    if (!token || token !== req.session?.csrfToken) {
      return res.status(403).json({ error: 'Token CSRF inválido.' });
    }
  }
  next();
}

module.exports = { requireAuth, requireAdmin, csrfToken, csrfCheck };
