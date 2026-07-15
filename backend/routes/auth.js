const express = require('express');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const db = require('../db/db');
const { verifyPassword, requireAuth } = require('../auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password, totpToken } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (user.totp_enabled) {
    if (!totpToken) {
      return res.status(200).json({ requires2fa: true });
    }
    const verified = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: totpToken,
      window: 1
    });
    if (!verified) {
      return res.status(401).json({ error: 'Invalid 2FA code' });
    }
  }

  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.isAdmin = !!user.is_admin;

  res.json({ id: user.id, username: user.username, isAdmin: !!user.is_admin });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', requireAuth, (req, res) => {
  res.json({
    id: req.session.userId,
    username: req.session.username,
    isAdmin: req.session.isAdmin
  });
});

router.post('/2fa/setup', requireAuth, (req, res) => {
  const secret = speakeasy.generateSecret({ name: `ForgePanel (${req.session.username})` });
  db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').run(secret.base32, req.session.userId);
  qrcode.toDataURL(secret.otpauth_url, (err, dataUrl) => {
    if (err) return res.status(500).json({ error: 'Failed to generate QR code' });
    res.json({ secret: secret.base32, qrCode: dataUrl });
  });
});

router.post('/2fa/verify', requireAuth, (req, res) => {
  const { token } = req.body || {};
  const user = db.prepare('SELECT totp_secret FROM users WHERE id = ?').get(req.session.userId);
  if (!user || !user.totp_secret) {
    return res.status(400).json({ error: '2FA not set up' });
  }
  const verified = speakeasy.totp.verify({
    secret: user.totp_secret,
    encoding: 'base32',
    token,
    window: 1
  });
  if (!verified) {
    return res.status(401).json({ error: 'Invalid code' });
  }
  db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(req.session.userId);
  res.json({ ok: true });
});

module.exports = router;
