'use strict';

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>"'&]/g, c => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' }[c]));
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(pass) {
  if (!pass || pass.length < 8) return 'Mínimo 8 caracteres.';
  if (!/[A-Z]/.test(pass)) return 'Precisa de pelo menos 1 letra maiúscula.';
  if (!/[0-9]/.test(pass)) return 'Precisa de pelo menos 1 número.';
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(pass)) return 'Precisa de pelo menos 1 símbolo (!@#$%^&*).';
  return null;
}

function validateRegister(req, res, next) {
  const { name, email, password, password2 } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Preencha todos os campos.' });
  }
  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Email inválido.' });
  }
  const err = validatePassword(password);
  if (err) {
    return res.status(400).json({ error: err });
  }
  if (password2 && password !== password2) {
    return res.status(400).json({ error: 'Senhas não conferem.' });
  }
  req.body.name = sanitize(name.trim());
  req.body.email = email.trim().toLowerCase();
  next();
}

function validateLogin(req, res, next) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Preencha todos os campos.' });
  }
  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Email inválido.' });
  }
  req.body.email = email.trim().toLowerCase();
  next();
}

module.exports = { sanitize, validateEmail, validatePassword, validateRegister, validateLogin };
