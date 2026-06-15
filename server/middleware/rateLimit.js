'use strict';

const rateLimit = require('express-rate-limit');

// Custom key function to prevent X-Forwarded-For bypass
// Uses session ID when available, falls back to IP
function getKey(req) {
  if (req.session && req.session.userId) return `user:${req.session.userId}`;
  if (req.session && req.session.adminId) return `admin:${req.session.adminId}`;
  return req.ip;
}

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Muitas tentativas de login. Tente novamente em 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getKey
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Muitas requisições. Aguarde um momento.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getKey
});

const msgLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 10,
  message: { error: 'Você está enviando mensagens rápido demais.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getKey
});

const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { error: 'Muitas tentativas de registro. Aguarde 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getKey
});

// Stricter limiter for sensitive operations
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Muitas tentativas. Aguarde 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getKey
});

// Recovery limiter - prevent spam
const recoveryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3,
  message: { error: 'Muitas solicitações. Aguarde 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getKey
});

module.exports = { loginLimiter, apiLimiter, msgLimiter, registerLimiter, strictLimiter, recoveryLimiter };
