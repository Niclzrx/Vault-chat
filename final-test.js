const https = require('https');

function makeRequest(method, path, data, cookies, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'vault-chat-nlu3.onrender.com',
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...extraHeaders
      }
    };
    
    if (cookies) {
      options.headers['Cookie'] = cookies;
    }
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        resolve({ status: res.statusCode, body, setCookie, headers: res.headers });
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      if (typeof data === 'string') {
        req.write(data);
      } else {
        req.write(JSON.stringify(data));
      }
    }
    req.end();
  });
}

async function runFinalTests() {
  console.log('🧪 TESTE FINAL DE SEGURANÇA\n');
  console.log('=' .repeat(50));
  
  // Login
  console.log('\n[1] LOGIN');
  const loginRes = await makeRequest('POST', '/api/auth/login', {
    email: 'bruno@vault.app',
    password: 'Bruno@123456'
  });
  const cookies = loginRes.setCookie?.[0]?.split(';')[0];
  console.log('Status:', loginRes.status === 200 ? '✅ OK' : '❌ FALHOU');
  
  // CSRF
  console.log('\n[2] CSRF');
  const csrfRes = await makeRequest('POST', '/api/auth/login', {
    email: 'bruno@vault.app',
    password: 'Bruno@123456'
  });
  console.log('Login SEM CSRF:', csrfRes.status === 403 ? '✅ BLOQUEADO' : '⚠️ PERMITIDO');
  
  // Clickjacking
  console.log('\n[3] CLICKJACKING');
  const mainPage = await makeRequest('GET', '/');
  console.log('X-Frame-Options:', mainPage.headers['x-frame-options'] === 'DENY' ? '✅ DENY' : '❌ NÃO CONFIGURADO');
  console.log('X-Content-Type-Options:', mainPage.headers['x-content-type-options'] ? '✅ CONFIGURADO' : '❌ NÃO CONFIGURADO');
  console.log('X-XSS-Protection:', mainPage.headers['x-xss-protection'] ? '✅ CONFIGURADO' : '❌ NÃO CONFIGURADO');
  
  // Rate Limit
  console.log('\n[4] RATE LIMIT');
  let rateLimited = false;
  for (let i = 0; i < 35; i++) {
    const res = await makeRequest('GET', '/api/users', null, cookies);
    if (res.status === 429) {
      rateLimited = true;
      console.log(`Rate limit ativado após ${i + 1} requisições: ✅ SEGURO`);
      break;
    }
  }
  if (!rateLimited) {
    console.log('Rate limit NÃO ativado: ⚠️ VERIFICAR');
  }
  
  // SQL Injection
  console.log('\n[5] SQL INJECTION');
  const sqliTests = [
    "' OR '1'='1",
    "admin'--",
    "'; DROP TABLE users;--",
    "' UNION SELECT * FROM users--"
  ];
  
  let sqliBlocked = true;
  for (const payload of sqliTests) {
    const res = await makeRequest('POST', '/api/auth/login', {
      email: payload,
      password: 'x'
    });
    const blocked = res.status === 400 || res.status === 401;
    if (!blocked) sqliBlocked = false;
    console.log(`SQLi "${payload.substring(0, 20)}...": ${blocked ? '✅' : '❌'}`);
  }
  
  // XSS
  console.log('\n[6] XSS');
  const xssRes = await makeRequest('POST', '/api/messages', {
    to: 'u3',
    text: '<script>alert("XSS")</script>'
  }, cookies);
  console.log('XSS tentativa:', xssRes.status === 400 || xssRes.status === 403 ? '✅ BLOQUEADO' : '❌ PERMITIDO');
  
  // Privilege Escalation
  console.log('\n[7] PRIVILEGE ESCALATION');
  const adminRes = await makeRequest('GET', '/api/admin/stats', null, cookies);
  console.log('Acesso admin:', adminRes.status === 403 ? '✅ BLOQUEADO' : '❌ PERMITIDO');
  
  // File Upload
  console.log('\n[8] FILE UPLOAD');
  const boundary = '----TestBoundary123';
  const htmlContent = '<script>alert("XSS")</script>';
  const formData = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.html"\r\nContent-Type: text/html\r\n\r\n${htmlContent}\r\n--${boundary}--`;
  
  const uploadRes = await makeRequest('POST', '/api/files/upload', formData, cookies, {
    'Content-Type': `multipart/form-data; boundary=${boundary}`
  });
  console.log('Upload HTML:', uploadRes.status === 400 || uploadRes.status === 403 || uploadRes.status === 500 ? '✅ BLOQUEADO' : '❌ PERMITIDO');
  
  // IDOR
  console.log('\n[9] IDOR');
  const idorRes = await makeRequest('GET', '/api/messages/u3', null, cookies);
  console.log('Acesso msgs outro:', idorRes.status === 200 ? '⚠️ PERMITIDO (verificar conteúdo)' : '✅ BLOQUEADO');
  
  // Path Traversal
  console.log('\n[10] PATH TRAVERSAL');
  const pathRes = await makeRequest('GET', '/api/files/../../../etc/passwd', null, cookies);
  console.log('Path Traversal:', pathRes.status === 400 || pathRes.status === 404 ? '✅ BLOQUEADO' : '❌ PERMITIDO');
  
  console.log('\n' + '=' .repeat(50));
  console.log('✅ TESTES CONCLUÍDOS');
  console.log('=' .repeat(50));
}

runFinalTests().catch(console.error);
