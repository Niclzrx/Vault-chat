'use strict';

/* global Crypto, sanitize, toast */

function renderCryptoPage(el) {
  el.innerHTML = `
    <div class="u-crypto">
      <h2>Laboratório de Criptografia</h2>
      <div class="crypto-section">
        <h3>AES-256-GCM</h3>
        <label>Texto</label>
        <textarea id="crypto-in" rows="3" placeholder="Texto para criptografar/descriptografar"></textarea>
        <label>Chave (senha)</label>
        <input type="text" id="crypto-key" placeholder="Senha para AES">
        <label>Resultado</label>
        <textarea id="crypto-out" rows="3" readonly placeholder="Resultado"></textarea>
        <div class="crypto-btns">
          <button onclick="doCryptoAES('encrypt','crypto-in','crypto-key','crypto-out')">◆ Criptografar</button>
          <button onclick="doCryptoAES('decrypt','crypto-in','crypto-key','crypto-out')">◇ Descriptografar</button>
        </div>
      </div>
      <div class="crypto-section">
        <h3>Hash SHA-256</h3>
        <label>Texto</label>
        <input type="text" id="hash-in" placeholder="Texto para gerar hash" onkeydown="if(event.key==='Enter') doHash()">
        <label>Hash</label>
        <input type="text" id="hash-out" readonly placeholder="Resultado do hash">
        <button onclick="doHash()">⚷ Gerar Hash</button>
      </div>
    </div>
  `;
}

async function doCryptoAES(op, inId, keyId, outId) {
  const input = document.getElementById(inId)?.value;
  const key = document.getElementById(keyId)?.value;
  const out = document.getElementById(outId);
  if (!input || !key) { toast('Preencha o texto e a chave.', 'err'); return; }
  if (!out) return;
  try {
    if (op === 'encrypt') {
      const result = await Crypto.encrypt(input, key);
      out.value = result;
      toast('Texto criptografado!', 'ok');
    } else {
      const result = await Crypto.decrypt(input, key);
      if (result === null) {
        out.value = '';
        toast('Falha na descriptografia. Chave ou dado inválido.', 'err');
      } else {
        out.value = result;
        toast('Texto descriptografado!', 'ok');
      }
    }
  } catch (e) {
    toast('Erro na operação: ' + e.message, 'err');
  }
}

async function doHash() {
  const input = document.getElementById('hash-in');
  const out = document.getElementById('hash-out');
  if (!input || !out) return;
  if (!input.value.trim()) { toast('Digite um texto para hash.', 'err'); return; }
  const hash = await Crypto.quickHash(input.value);
  out.value = hash;
  toast('Hash gerado!', 'ok');
}
