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

async function runAdvancedTests() {
  console.log('🧪 TESTES AVANÇADOS DE SEGURANÇA\n');
  
  // Login primeiro
  console.log('=== PREPARAÇÃO: Login como Bruno ===');
  const loginRes = await makeRequest('POST', '/api/auth/login', {
    email: 'bruno@vault.app',
    password: 'Bruno@123456'
  });
  const cookies = loginRes.setCookie?.[0]?.split(';')[0];
  console.log('Login:', loginRes.status === 200 ? '✅ OK' : '❌ FALHOU');
  
  // Teste 1: CSRF
  console.log('\n=== TESTE 1: CSRF ===');
  const csrfToken = loginRes.body.match(/csrfToken.*?"([^"]+)"/)?.[1];
  console.log('CSRF Token encontrado:', csrfToken ? '✅ SIM' : '❌ NÃO');
  
  // Tenta login SEM token CSRF
  const csrfBypass = await makeRequest('POST', '/api/auth/login', {
    email: 'bruno@vault.app',
    password: 'Bruno@123456'
  });
  console.log('Login SEM CSRF token:', csrfBypass.status === 200 ? '⚠️ PERMITIDO' : '✅ BLOQUEADO');
  
  // Teste 2: Session Fixation
  console.log('\n=== TESTE 2: SESSION FIXATION ===');
  const fixedSession = await makeRequest('POST', '/api/auth/login', {
    email: 'bruno@vault.app',
    password: 'Bruno@123456'
  }, 'vault.sid=FIXED_SESSION_ID_12345');
  console.log('Session Fixation:', fixedSession.status === 200 ? '⚠️ VULNERÁVEL' : '✅ SEGURO');
  console.log('Nova sessão:', fixedSession.setCookie ? '✅ REGENERADA' : '❌ NÃO REGENERADA');
  
  // Teste 3: Clickjacking
  console.log('\n=== TESTE 3: CLICKJACKING ===');
  const mainPage = await makeRequest('GET', '/', null, cookies);
  const xFrameOptions = mainPage.headers['x-frame-options'];
  const cspFrame = mainPage.headers['content-security-policy'];
  console.log('X-Frame-Options:', xFrameOptions || '❌ NÃO CONFIGURADO');
  console.log('CSP frame-ancestors:', cspFrame?.includes('frame-ancestors') ? '✅ CONFIGURADO' : '❌ NÃO CONFIGURADO');
  
  // Teste 4: File Upload Malicioso
  console.log('\n=== TESTE 4: FILE UPLOAD ===');
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const fileContent = `<script>alert('XSS')</script>`;
  const formData = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="malicious.html"\r\nContent-Type: text/html\r\n\r\n${fileContent}\r\n--${boundary}--`;
  
  const uploadRes = await makeRequest('POST', '/api/files/upload', formData, cookies, {
    'Content-Type': `multipart/form-data; boundary=${boundary}`
  });
  console.log('Upload HTML:', uploadRes.status === 400 || uploadRes.status === 403 ? '✅ BLOQUEADO' : '⚠️ PERMITIDO');
  console.log('Resposta:', uploadRes.body);
  
  // Teste 5: WebSocket Hijacking
  console.log('\n=== TESTE 5: WEBSOCKET ===');
  console.log('WebSocket: Requer teste manual no navegador');
  console.log('Teste: Conectar ws://vault-chat-nlu3.onrender.com sem autenticação');
  
  // Teste 6: API Abuse (Rate Limit)
  console.log('\n=== TESTE 6: API ABUSE (RATE LIMIT) ===');
  let blocked = false;
  for (let i = 0; i < 15; i++) {
    const res = await makeRequest('GET', '/api/users', null, cookies);
    if (res.status === 429) {
      blocked = true;
      console.log(`Rate limit ativado após ${i + 1} requisições: ✅ SEGURO`);
      break;
    }
  }
  if (!blocked) {
    console.log('Rate limit NÃO ativado após 15 requisições: ⚠️ VULNERÁVEL');
  }
  
  // Teste 7: HTTP Response Splitting
  console.log('\n=== TESTE 7: HTTP RESPONSE SPLITTING ===');
  const splitRes = await makeRequest('POST', '/api/auth/login', {
    email: 'bruno@vault.app\r\nX-Injected-Header: true',
    password: 'Bruno@123456'
  });
  console.log('Response Splitting:', splitRes.headers['x-injected-header'] ? '⚠️ VULNERÁVEL' : '✅ SEGURO');
  
  // Teste 8: SQL Injection Avançado
  console.log('\n=== TESTE 8: SQL INJECTION AVANÇADO ===');
  const sqliTests = [
    "admin'--",
    "admin'/*",
    "' OR 1=1--",
    "'; DROP TABLE users;--",
    "' UNION SELECT * FROM users--"
  ];
  
  for (const payload of sqliTests) {
    const res = await makeRequest('POST', '/api/auth/login', {
      email: payload,
      password: 'x'
    });
    console.log(`SQLi "${payload}":`, res.status === 400 || res.status === 401 ? '✅ BLOQUEADO' : '⚠️ PERMITIDO');
  }
  
  // Teste 9: Path Traversal
  console.log('\n=== TESTE 9: PATH TRAVERSAL ===');
  const pathTests = [
    '/api/files/../../../etc/passwd',
    '/api/files/..%2F..%2F..%2Fetc%2Fpasswd',
    '/api/files/....//....//....//etc/passwd'
  ];
  
  for (const path of pathTests) {
    const res = await makeRequest('GET', path, null, cookies);
    console.log(`Path Traversal "${path}":`, res.status === 400 || res.status === 404 ? '✅ BLOQUEADO' : '⚠️ PERMITIDO');
  }
  
  console.log('\n✅ TESTES AVANÇADOS CONCLUÍDOS');
}

runAdvancedTests().catch(console.error);
