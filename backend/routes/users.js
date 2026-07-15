const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/db');
const { requireAdmin, hashPassword } = require('../auth');

const router = express.Router();

function toApiUser(row) {
  const { password_hash, totp_secret, ...rest } = row;
  return { ...rest, totpEnabled: !!row.totp_enabled, isAdmin: !!row.is_admin };
}

router.get('/', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM users ORDER BY created_at').all().map(toApiUser));
});

router.post('/', requireAdmin, (req, res) => {
  const { username, password, isAdmin } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' });

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'Username already taken' });

  const id = uuidv4();
  db.prepare('INSERT INTO users (id, username, password_hash, is_admin) VALUES (?, ?, ?, ?)')
    .run(id, username, hashPassword(password), isAdmin ? 1 : 0);

  res.status(201).json(toApiUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)));
});

router.put('/:id', requireAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { password, isAdmin } = req.body || {};
  if (password) db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), req.params.id);
  if (isAdmin !== undefined) db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(isAdmin ? 1 : 0, req.params.id);

  res.json(toApiUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)));
});

router.delete('/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/:id/permissions', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM user_server_permissions WHERE user_id = ?').all(req.params.id));
});

router.put('/:id/permissions/:serverId', requireAdmin, (req, res) => {
  const fields = [
    'view_console', 'send_console', 'start_stop', 'file_read', 'file_write',
    'workshop_install', 'config_edit', 'backup_create', 'backup_restore'
  ];
  const values = fields.map((f) => {
    const camel = f.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    return req.body && req.body[camel] ? 1 : 0;
  });

  db.prepare(`
    INSERT INTO user_server_permissions (user_id, server_id, ${fields.join(', ')})
    VALUES (?, ?, ${fields.map(() => '?').join(', ')})
    ON CONFLICT(user_id, server_id) DO UPDATE SET ${fields.map((f) => `${f} = excluded.${f}`).join(', ')}
  `).run(req.params.id, req.params.serverId, ...values);

  res.json(db.prepare('SELECT * FROM user_server_permissions WHERE user_id = ? AND server_id = ?').get(req.params.id, req.params.serverId));
});

module.exports = router;
