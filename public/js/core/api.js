'use strict';

const API = {
  csrfToken: null,

  async init() {
    try {
      const res = await fetch('/api/csrf', { credentials: 'same-origin' });
      const data = await res.json();
      this.csrfToken = data.csrfToken;
    } catch (_) {}
  },

  async request(method, url, body = null) {
    const opts = {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }
    };
    if (this.csrfToken) opts.headers['X-CSRF-Token'] = this.csrfToken;
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erro na requisição');
    return data;
  },

  get(url) { return this.request('GET', url); },
  post(url, body) { return this.request('POST', url, body); },
  put(url, body) { return this.request('PUT', url, body); },
  del(url) { return this.request('DELETE', url); },

  register(name, email, password, password2) {
    return this.post('/api/auth/register', { name, email, password, password2 });
  },

  login(email, password) {
    return this.post('/api/auth/login', { email, password });
  },

  adminLogin(id, password) {
    return this.post('/api/auth/admin-login', { id, password });
  },

  logout() {
    return this.post('/api/auth/logout');
  },

  me() {
    return this.get('/api/auth/me');
  },

  getUsers() {
    return this.get('/api/users');
  },

  getContacts() {
    return this.get('/api/users/contacts');
  },

  getUnread() {
    return this.get('/api/users/unread');
  },

  blockUser(id) {
    return this.post('/api/users/block/' + id);
  },

  unblockUser(id) {
    return this.del('/api/users/block/' + id);
  },

  getBlocked() {
    return this.get('/api/users/blocked');
  },

  isBlocked(id) {
    return this.get('/api/users/is-blocked/' + id);
  },

  getUser(id) {
    return this.get('/api/users/' + id);
  },

  updateProfile(id, data) {
    return this.put('/api/users/' + id, data);
  },

  getMessages(userId) {
    return this.get('/api/messages/' + userId);
  },

  sendMessage(to, encrypted, encrypted_image, msg_type) {
    const body = { to };
    if (encrypted) body.encrypted = encrypted;
    if (encrypted_image) body.encrypted_image = encrypted_image;
    if (msg_type) body.msg_type = msg_type;
    return this.post('/api/messages', body);
  },

  deleteMessage(msgId) {
    return this.del('/api/messages/' + msgId);
  },

  deleteConversation(userId) {
    return this.del('/api/messages/conversation/' + userId);
  },

  getGroups() {
    return this.get('/api/groups');
  },

  createGroup(name, members) {
    return this.post('/api/groups', { name, members });
  },

  getGroup(id) {
    return this.get('/api/groups/' + id);
  },

  getGroupMessages(groupId) {
    return this.get('/api/groups/' + groupId + '/messages');
  },

  sendGroupMessage(groupId, encrypted) {
    return this.post('/api/groups/' + groupId + '/messages', { encrypted });
  },

  addGroupMember(groupId, userId) {
    return this.post('/api/groups/' + groupId + '/members', { userId });
  },

  removeGroupMember(groupId, userId) {
    return this.del('/api/groups/' + groupId + '/members/' + userId);
  },

  renameGroup(groupId, name) {
    return this.put('/api/groups/' + groupId, { name });
  },

  deleteGroup(groupId) {
    return this.del('/api/groups/' + groupId);
  },

  getNotifications() {
    return this.get('/api/notifications');
  },

  markNotificationRead(id) {
    return this.put('/api/notifications/' + id);
  },

  markAllNotificationsRead() {
    return this.put('/api/notifications');
  },

  getFiles() {
    return this.get('/api/files');
  },

  uploadFile(file) {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      fetch('/api/files/upload', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData
      }).then(r => r.json()).then(d => {
        if (d.ok) resolve(d);
        else reject(new Error(d.error));
      }).catch(reject);
    });
  },

  downloadFile(id) {
    window.open('/api/files/download/' + id + '?token=' + Date.now(), '_blank');
  },

  deleteFile(id) {
    return this.del('/api/files/' + id);
  },

  adminStats() {
    return this.get('/api/admin/stats');
  },

  adminUsers() {
    return this.get('/api/admin/users');
  },

  adminBan(userId, duration, reason) {
    return this.put('/api/admin/users/' + userId + '/ban', { duration, reason });
  },

  adminUnban(userId) {
    return this.put('/api/admin/users/' + userId + '/unban');
  },

  adminKick(userId) {
    return this.put('/api/admin/users/' + userId + '/kick');
  },

  adminGrantAdmin(userId) {
    return this.put('/api/admin/users/' + userId + '/grant-admin');
  },

  adminRevokeAdmin(userId) {
    return this.put('/api/admin/users/' + userId + '/revoke-admin');
  },

  adminLogs() {
    return this.get('/api/admin/logs');
  },

  adminRecovery() {
    return this.get('/api/admin/recovery');
  },

  adminResolveRecovery(id, status, new_password) {
    return this.put('/api/admin/recovery/' + id, { status, new_password });
  },

  adminConfig() {
    return this.get('/api/admin/config');
  },

  adminChangePass(new_password) {
    return this.put('/api/admin/config/admin-pass', { new_password });
  },

  adminExport() {
    return this.post('/api/admin/export');
  },

  adminReset() {
    return this.post('/api/admin/reset');
  }
};
