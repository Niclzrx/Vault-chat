// =========================================
// VAULT v3.0 — Session & Admin Trigger
// =========================================
'use strict';

/* global AppUser, AppAdmin, toast, doLogout, SEC, go */

const Session = {
  _lastActivity: Date.now(),
  _timer: null,
  touch() { this._lastActivity = Date.now(); },
  start() {
    document.addEventListener('click', () => this.touch(), { passive: true });
    document.addEventListener('keydown', () => this.touch(), { passive: true });
    document.addEventListener('mousemove', () => this.touch(), { passive: true });
    this._timer = setInterval(() => {
      if (!AppUser || AppAdmin) return;
      if (Date.now() - this._lastActivity > SEC.SESSION_TIMEOUT_MS) {
        toast('Sessão expirada por inatividade.', 'warn');
        doLogout();
      }
    }, 30000);
  },
  stop() { clearInterval(this._timer); }
};

const AdminTrigger = {
  _count: 0, _timer: null,
  // Key sequence fallback: type "vault" anywhere on login page
  _seq: '', _seqTarget: 'vault',
  init() {
    const ghost = document.getElementById('admin-ghost');
    if (ghost) ghost.addEventListener('click', () => this._onClick());
    // Keyboard shortcut on login page: type "vault" in sequence
    document.addEventListener('keydown', (e) => {
      const page = document.getElementById('p-login');
      if (!page || !page.classList.contains('active')) { this._seq = ''; return; }
      if (document.activeElement && ['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
      this._seq = (this._seq + e.key).slice(-this._seqTarget.length);
      if (this._seq === this._seqTarget) { this._seq = ''; go('p-adm-login'); }
    });
  },
  _onClick() {
    if (!this._timer) this._timer = setTimeout(() => this._reset(), SEC.ADMIN_CLICK_TIMEOUT_MS);
    this._count++;
    if (this._count >= SEC.ADMIN_CLICK_REQUIRED) {
      this._reset();
      go('p-adm-login');
    }
  },
  _reset() { this._count = 0; clearTimeout(this._timer); this._timer = null; }
};

function adminClick() { AdminTrigger._onClick(); }
