// =========================================
// AI Chat — Assistente Inteligente
// =========================================
'use strict';

/* global AppUser, AppAdmin, sanitize, fmtTime, toast, togglePw, API */

const AI = {
  apiKey: localStorage.getItem('vault_ai_key') || '',
  model: localStorage.getItem('vault_ai_model') || 'ministral-3:3b',
  history: JSON.parse(localStorage.getItem('vault_ai_history') || '[]'),
  maxTokens: parseInt(localStorage.getItem('vault_ai_tokens')) || 2048,
  temperature: parseFloat(localStorage.getItem('vault_ai_temp')) || 0.7,
  apiUrl: localStorage.getItem('vault_ai_url') || 'https://ollama.com/v1/chat/completions',

  saveKey(key) {
    this.apiKey = key;
    localStorage.setItem('vault_ai_key', key);
  },

  clearKey() {
    this.apiKey = '';
    localStorage.removeItem('vault_ai_key');
  },

  saveHistory() {
    localStorage.setItem('vault_ai_history', JSON.stringify(this.history));
  },

  clearHistory() {
    this.history = [];
    this.saveHistory();
  },

  async send(message) {
    const messages = [...this.history.slice(-20).map(m => ({ role: m.role, content: m.content })), { role: 'user', content: message }];
    const body = {
      model: this.model,
      messages: [{ role: 'system', content: 'Você é um assistente integrado à plataforma Vault, um ambiente seguro de mensagens criptografadas. Seja direto, técnico quando necessário e responda em português brasileiro.' }, ...messages],
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      stream: false
    };

    let res;
    try {
      const proxyHeaders = {};
      if (this.apiKey) proxyHeaders['Authorization'] = 'Bearer ' + this.apiKey;
      res = await fetch('/api/ai-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ apiUrl: this.apiUrl, body, headers: proxyHeaders })
      });
    } catch (e) {
      throw new Error('Falha de rede ao conectar com o servidor proxy.');
    }
    if (!res.ok) {
      let err;
      try { err = (await res.json()).error || await res.text(); } catch (_) { err = await res.text(); }
      throw new Error('API retornou ' + res.status + ' — ' + (typeof err === 'string' ? err.slice(0, 200) : JSON.stringify(err).slice(0, 200)));
    }
    let data;
    try { data = await res.json(); } catch (_) { throw new Error('Resposta inválida da API (não é JSON).'); }
    if (data.error) throw new Error('API: ' + (typeof data.error === 'string' ? data.error.slice(0, 300) : data.error.message || JSON.stringify(data.error).slice(0, 300)));
    const reply = data.choices ? data.choices[0].message.content : data.message?.content || data.response || '';
    if (!reply) throw new Error('Resposta vazia da API. Verifique URL (' + this.apiUrl + '), modelo (' + this.model + ') e chave.');
    this.history.push({ role: 'assistant', content: reply, time: fmtTime() });
    this.saveHistory();
    return reply;
  }
};

async function renderAIChat() {
  const area = document.getElementById('ai-chat-area');
  const configArea = document.getElementById('ai-config-area');
  const notice = document.getElementById('ai-block-notice');
  if (!area) return;

  document.querySelectorAll('#ai-main .si').forEach(el => el.classList.remove('on'));
  document.getElementById('si-ai-chat')?.classList.add('on');

  if (configArea) configArea.style.display = 'none';

  if (AppUser) {
    try {
      const blockRes = await API.adminAIBlocked();
      if (blockRes.ok && blockRes.blocked && blockRes.blocked.includes(AppUser.id)) {
        if (notice) notice.style.display = 'block';
        area.innerHTML = '';
        return;
      }
    } catch (_) {}
  }
  if (notice) notice.style.display = 'none';

  area.innerHTML = `
    <div class="card ai-chat-container">
      <div class="ai-msg-wrap" id="ai-msgs"></div>
      <div id="ai-typing" class="ai-typing" style="display:none">
        <span></span><span></span><span></span>
      </div>
      <div class="ai-input-row">
        <textarea id="ai-input" placeholder="Digite sua mensagem para IA..." rows="1" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendAI()}"></textarea>
        <button class="btn pri sm" onclick="sendAI()">↑</button>
        <button class="btn sm" onclick="clearAIChat()" title="Limpar conversa">⊠</button>
      </div>
      <div class="ai-token-count">${AI.history.length} mensagens no histórico</div>
    </div>`;

  renderAIMessages();
}

function renderAIMessages() {
  const wrap = document.getElementById('ai-msgs');
  if (!wrap) return;
  if (AI.history.length === 0) {
    wrap.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--t3);font-size:.82rem">Inicie uma conversa com o assistente IA.<br/>Pergunte o que quiser.</div>';
    return;
  }
  wrap.innerHTML = AI.history.map(m => {
    const isUser = m.role === 'user';
    return `<div class="ai-msg ${isUser ? 'user' : 'ai'}">
      <div class="ai-av">${isUser ? '◉' : '◈'}</div>
      <div>
        <div class="ai-bbl">${renderAIResponse(m.content)}</div>
        <div class="msg-t">${m.time || ''}</div>
      </div>
    </div>`;
  }).join('');
  wrap.scrollTop = wrap.scrollHeight;
}

function renderAIResponse(text) {
  const escaped = sanitize(text);
  const withCode = escaped.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  const withInline = withCode.replace(/`([^`]+)`/g, '<code>$1</code>');
  const withParagraphs = withInline.split('\n\n').map(p => {
    const trimmed = p.trim();
    if (trimmed.startsWith('<pre>') || trimmed.startsWith('<code>')) return trimmed;
    return '<p>' + trimmed.replace(/\n/g, '<br/>') + '</p>';
  }).join('');
  return withParagraphs;
}

async function sendAI() {
  const inp = document.getElementById('ai-input');
  const txt = inp?.value.trim();
  if (!txt) return;
  inp.value = '';
  inp.disabled = true;
  inp.style.height = 'auto';

  const typing = document.getElementById('ai-typing');
  if (typing) typing.style.display = 'flex';

  AI.history.push({ role: 'user', content: txt, time: fmtTime() });
  AI.saveHistory();
  renderAIMessages();

  try {
    await AI.send(txt);
    renderAIMessages();
    const tc = document.querySelector('.ai-token-count');
    if (tc) tc.textContent = AI.history.length + ' mensagens no histórico';
  } catch (err) {
    toast(err.message || 'Erro ao comunicar com IA.', 'err');
    renderAIMessages();
  } finally {
    if (typing) typing.style.display = 'none';
    inp.disabled = false;
    inp.focus();
  }
}

function clearAIChat() {
  if (!confirm('Limpar todo o histórico da conversa com IA?')) return;
  AI.clearHistory();
  renderAIMessages();
  const tc = document.querySelector('.ai-token-count');
  if (tc) tc.textContent = '0 mensagens no histórico';
  toast('Histórico limpo.', 'ok');
}

function showAIConfig() {
  const area = document.getElementById('ai-config-area');
  const chatArea = document.getElementById('ai-chat-area');
  if (!area) return;
  if (area.style.display !== 'none') { area.style.display = 'none'; return; }
  area.style.display = 'block';
  if (chatArea) chatArea.style.display = 'none';
  document.querySelectorAll('#ai-main .si').forEach(el => el.classList.remove('on'));
  document.getElementById('si-ai-chat')?.classList.add('on');

  area.innerHTML = `
    <div class="card">
      <div class="st" style="margin-bottom:.85rem">⊡ Configuração da IA</div>
      <div class="field">
        <label>API URL</label>
        <input id="ai-api-url" type="url" value="${sanitize(AI.apiUrl)}" placeholder="https://api.openai.com/v1/chat/completions"/>
        <div style="font-size:.68rem;color:var(--t3);margin-top:.25rem">OpenAI, Groq, Ollama Cloud (https://ollama.com/v1/chat/completions ou https://ollama.com/api/chat), Ollama local (http://localhost:11434/api/chat)</div>
      </div>
      <div class="field">
        <label>API Key (deixe vazio se não precisar)</label>
        <div class="toggle-pw">
          <input id="ai-api-key" type="password" value="${sanitize(AI.apiKey)}" placeholder="sk-..."/>
          <button class="eye-btn" onclick="togglePw('ai-api-key',this)">◎</button>
        </div>
        <div style="font-size:.68rem;color:var(--t3);margin-top:.25rem">Sua chave fica salva apenas no seu navegador.</div>
      </div>
      <div class="field">
        <label>Modelo (ex: gpt-4o-mini, llama3.2, gemma2, etc)</label>
        <input id="ai-model" type="text" value="${sanitize(AI.model)}" placeholder="gpt-4o-mini"/>
      </div>
      <div class="field">
        <label>Temperatura (criatividade): ${AI.temperature}</label>
        <input id="ai-temp" type="range" min="0" max="2" step="0.1" value="${AI.temperature}"/>
      </div>
      <div class="field">
        <label>Máx tokens: ${AI.maxTokens}</label>
        <input id="ai-tokens" type="range" min="256" max="4096" step="256" value="${AI.maxTokens}"/>
      </div>
      <button class="btn sec sm" onclick="saveAIConfig()">▣ Salvar configuração</button>
      <button class="btn sm" onclick="clearAIKey()" style="margin-left:.5rem">Limpar API Key</button>
      <button class="btn sm" onclick="showAIChat()" style="margin-left:.5rem">← Voltar ao chat</button>
    </div>`;
}

function showAIChat() {
  const configArea = document.getElementById('ai-config-area');
  const chatArea = document.getElementById('ai-chat-area');
  if (configArea) configArea.style.display = 'none';
  if (chatArea) chatArea.style.display = '';
  renderAIChat();
}

function saveAIConfig() {
  const url = document.getElementById('ai-api-url')?.value.trim();
  const key = document.getElementById('ai-api-key')?.value.trim();
  const model = document.getElementById('ai-model')?.value.trim();
  const temp = parseFloat(document.getElementById('ai-temp')?.value);
  const tokens = parseInt(document.getElementById('ai-tokens')?.value);
  if (url) { AI.apiUrl = url; localStorage.setItem('vault_ai_url', url); }
  if (key !== undefined) AI.saveKey(key);
  if (model) { AI.model = model; localStorage.setItem('vault_ai_model', model); }
  if (!isNaN(temp)) { AI.temperature = temp; localStorage.setItem('vault_ai_temp', temp); }
  if (!isNaN(tokens)) { AI.maxTokens = tokens; localStorage.setItem('vault_ai_tokens', tokens); }
  toast('Configuração salva!', 'ok');
}

function clearAIKey() {
  AI.clearKey();
  const keyInput = document.getElementById('ai-api-key');
  if (keyInput) keyInput.value = '';
  toast('API Key removida.', 'ok');
}

function renderAIHistory() {
  const area = document.getElementById('ai-chat-area');
  const configArea = document.getElementById('ai-config-area');
  if (configArea) configArea.style.display = 'none';
  if (!area) return;
  document.querySelectorAll('#ai-main .si').forEach(el => el.classList.remove('on'));
  document.getElementById('si-ai-history')?.classList.add('on');

  if (AI.history.length === 0) {
    area.innerHTML = '<div class="card" style="text-align:center;padding:2rem;color:var(--t3)">Nenhum histórico de conversa com IA.</div>';
    return;
  }
  const grouped = [];
  let current = [];
  for (const m of AI.history) {
    if (m.role === 'user' && current.length > 0 && current[current.length-1].role === 'assistant') {
      grouped.push([...current]);
      current = [];
    }
    current.push(m);
  }
  if (current.length > 0) grouped.push([...current]);

  area.innerHTML = `<div class="pt">▤ Histórico de Conversas</div><div class="ps">${AI.history.length} mensagens no total</div>
    ${grouped.slice(-10).reverse().map((conv, gi) => `
      <div class="card card-hover" style="margin-bottom:.5rem;cursor:pointer" onclick="restoreAIConversation(${gi})">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:.8rem;font-weight:600">${sanitize(conv[0]?.content?.slice(0,80) || 'Conversa')}${(conv[0]?.content?.length||0)>80?'...':''}</div>
          <span style="font-size:.68rem;color:var(--t3)">${conv[0]?.time || ''}</span>
        </div>
        <div style="font-size:.7rem;color:var(--t2);margin-top:.2rem">${conv.length} mensagens</div>
      </div>`).join('')}`;

  window._aiGroupedHistory = grouped;
}

function restoreAIConversation(idx) {
  renderAIChat();
  toast('Histórico carregado.', 'info');
}

(function() {
  const cfg = localStorage.getItem('vault_ai_config');
  if (cfg) try { const s = JSON.parse(cfg); if (s.model) AI.model = s.model; if (s.temperature != null) AI.temperature = s.temperature; if (s.maxTokens) AI.maxTokens = s.maxTokens; } catch(e) {}
  ['url','model','temp','tokens'].forEach(k => { const v = localStorage.getItem('vault_ai_' + k); if (v) { if (k==='url') AI.apiUrl = v; if (k==='model') AI.model = v; if (k==='temp') AI.temperature = parseFloat(v); if (k==='tokens') AI.maxTokens = parseInt(v); } });
})();
