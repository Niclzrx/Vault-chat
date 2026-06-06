'use strict';

/* global API, AppUser, sanitize, fmtSize, fmtFileIcon, toast */

function renderFiles(u, el) {
  el.innerHTML = `
    <div class="u-files">
      <h2>Meus Arquivos</h2>
      <div class="file-upload-area" id="file-drop" ondragover="event.preventDefault()" ondrop="handleDrop(event)">
        <p>Arraste arquivos aqui ou clique para selecionar</p>
        <input type="file" id="file-input" multiple onchange="handleFileInput(event)">
        <button onclick="document.getElementById('file-input').click()">Selecionar Arquivos</button>
      </div>
      <div class="file-list" id="file-list">
        <p>Carregando...</p>
      </div>
    </div>
  `;
  refreshFileList();
}

async function refreshFileList() {
  const list = document.getElementById('file-list');
  if (!list) return;
  try {
    const res = await API.getFiles();
    if (!res.ok) { list.innerHTML = '<p class="err">Erro ao carregar arquivos.</p>'; return; }
    const files = res.files || [];
    if (!files.length) {
      list.innerHTML = '<p class="empty">Nenhum arquivo enviado ainda.</p>';
      return;
    }
    list.innerHTML = files.map(f => {
      const icon = fmtFileIcon(f.type || 'application/octet-stream', f.original_name || f.stored_name || '');
      return `
        <div class="file-item">
          <span class="file-icon">${icon}</span>
          <div class="file-info">
            <span class="file-name">${sanitize(f.original_name)}</span>
            <span class="file-meta">${fmtSize(f.size || 0)} • ${f.uploaded ? new Date(f.uploaded).toLocaleDateString('pt-BR') : ''}</span>
          </div>
          <div class="file-actions">
            <button onclick="API.downloadFile('${f.id}')">⬇</button>
            <button onclick="deleteFile('${f.id}')">⊠</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    list.innerHTML = '<p class="err">Erro ao carregar arquivos.</p>';
  }
}

function handleDrop(e) {
  e.preventDefault();
  const files = e.dataTransfer.files;
  if (!files.length) return;
  [...files].forEach(f => uploadFile(f));
}

function handleFileInput(e) {
  const files = e.target.files;
  if (!files.length) return;
  [...files].forEach(f => uploadFile(f));
  e.target.value = '';
}

async function uploadFile(file) {
  try {
    await API.uploadFile(file);
    toast('Arquivo "' + file.name + '" enviado!', 'ok');
    refreshFileList();
  } catch (e) {
    toast('Erro ao enviar "' + file.name + '".', 'err');
  }
}

async function deleteFile(fileId) {
  try {
    await API.deleteFile(fileId);
    toast('Arquivo excluído.', 'ok');
    refreshFileList();
  } catch (e) {
    toast('Erro ao excluir arquivo.', 'err');
  }
}
