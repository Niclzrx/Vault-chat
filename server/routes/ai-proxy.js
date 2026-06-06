'use strict';

const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');
const { URL } = require('url');

const { requireAuth } = require('../middleware/auth');

const ALLOWED_HOSTS = [
  'api.openai.com',
  'api.groq.com',
  'generativelanguage.googleapis.com',
  'ollama.com',
  'localhost',
  '127.0.0.1'
];

router.post('/', requireAuth, async (req, res) => {
  const { apiUrl, body, headers: extraHeaders } = req.body || {};
  if (!apiUrl || !body) return res.status(400).json({ error: 'apiUrl e body são obrigatórios.' });

  try {
    const parsedUrl = new URL(apiUrl);
    if (!ALLOWED_HOSTS.some(h => parsedUrl.hostname === h || parsedUrl.hostname.endsWith('.' + h))) {
      return res.status(403).json({ error: 'Host não permitido.' });
    }

    const isHTTPS = parsedUrl.protocol === 'https:';
    const transport = isHTTPS ? https : http;

    const postData = JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    };
    if (extraHeaders) Object.assign(headers, extraHeaders);

    const result = await new Promise((resolve, reject) => {
      const r = transport.request({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHTTPS ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers
      }, (resp) => {
        let data = '';
        resp.on('data', chunk => data += chunk);
        resp.on('end', () => resolve({ status: resp.statusCode, data }));
      });
      r.on('error', reject);
      r.setTimeout(30000, () => { r.destroy(); reject(new Error('Timeout')); });
      r.write(postData);
      r.end();
    });

    res.status(result.status).json(JSON.parse(result.data));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
