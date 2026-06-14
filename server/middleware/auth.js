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
    // Generate CSRF token for session-based requests
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    res.locals.csrfToken = req.session.csrfToken;
    
    // Generate CSRF token for cookie-based requests (login/register)
    if (!req.cookies.csrf_token) {
      const cookieToken = crypto.randomBytes(32).toString('hex');
      res.cookie('csrf_token', cookieToken, {
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 60 * 1000 // 30 minutes
      });
    }
  }
  next();
}

function csrfCheck(req, res, next) {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const path = req.path || '';
    const isAuthRoute = path.includes('/login') || path.includes('/register') || path.includes('/admin-login') || path.includes('/recovery');
    
    if (isAuthRoute) {
      // For auth routes, check cookie-based CSRF token
      const cookieToken = req.cookies?.csrf_token;
      const headerToken = req.headers['x-csrf-token'];
      if (!cookieToken || cookieToken !== headerToken) {
        return res.status(403).json({ error: 'Token CSRF inválido.' });
      }
    } else {
      // For other routes, check session-based CSRF token
      const token = req.headers['x-csrf-token'] || req.body?._csrf;
      if (!token || token !== req.session?.csrfToken) {
        return res.status(403).json({ error: 'Token CSRF inválido.' });
      }
    }
  }
  next();
}

module.exports = { requireAuth, requireAdmin, csrfToken, csrfCheck };
