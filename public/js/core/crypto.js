// =========================================
// VAULT v3.0 — Crypto
// =========================================
'use strict';

const Crypto = {
  _toB64(bytes) {
    const CHUNK = 8192;
    let bin = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  },
  _fromB64(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  },
  async deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMat = await crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: typeof salt === 'string' ? enc.encode(salt) : salt, iterations: 100000, hash: 'SHA-256' },
      keyMat,
      { name: 'AES-GCM', length: 256 },
      false, ['encrypt', 'decrypt']
    );
  },
  async encrypt(plaintext, password) {
    const enc  = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv   = crypto.getRandomValues(new Uint8Array(12));
    const key  = await this.deriveKey(password, salt);
    const ct   = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
    const packed = new Uint8Array(16 + 12 + ct.byteLength);
    packed.set(salt, 0); packed.set(iv, 16); packed.set(new Uint8Array(ct), 28);
    return this._toB64(packed);
  },
  async decrypt(b64, password) {
    try {
      const packed = this._fromB64(b64);
      const salt = packed.slice(0, 16);
      const iv   = packed.slice(16, 28);
      const ct   = packed.slice(28);
      const key  = await this.deriveKey(password, salt);
      const pt   = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
      return new TextDecoder().decode(pt);
    } catch { return null; }
  },
  async encryptBinary(data, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv   = crypto.getRandomValues(new Uint8Array(12));
    const key  = await this.deriveKey(password, salt);
    const ct   = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    const packed = new Uint8Array(16 + 12 + ct.byteLength);
    packed.set(salt, 0); packed.set(iv, 16); packed.set(new Uint8Array(ct), 28);
    return this._toB64(packed);
  },
  async decryptBinary(b64, password) {
    try {
      const packed = this._fromB64(b64);
      const salt = packed.slice(0, 16);
      const iv   = packed.slice(16, 28);
      const ct   = packed.slice(28);
      const key  = await this.deriveKey(password, salt);
      return await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    } catch { return null; }
  },
  generateToken(len = 32) {
    return Array.from(crypto.getRandomValues(new Uint8Array(len)))
      .map(b => b.toString(16).padStart(2,'0')).join('');
  }
};
