'use strict';

/* global API, AppAdmin, sanitize */

async function renderAdmChats(el) {
  el.innerHTML = `
    <div class="pt">▸ Conversas</div>
    <div class="ps">Mensagens são criptografadas — conteúdo inacessível</div>
    <div class="card" style="text-align:center;padding:2rem;color:var(--t3);font-size:.82rem">
      As conversas são criptografadas de ponta a ponta com AES-256-GCM.<br/>
      O servidor apenas armazena dados criptografados.
    </div>`;
}
