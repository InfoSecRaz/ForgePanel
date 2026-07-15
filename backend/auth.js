const session = require('express-session');
const bcrypt = require('bcrypt');
const db = require('./db/db');

const SALT_ROUNDS = 12;

function sessionMiddleware() {
  return session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' && process.env.FORCE_HTTPS === 'true'
    }
  });
}

function hashPassword(password) {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId || !req.session.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function getPermission(userId, serverId) {
  if (!userId || !serverId) return null;
  const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(userId);
  if (user && user.is_admin) {
    return {
      view_console: 1, send_console: 1, start_stop: 1, file_read: 1, file_write: 1,
      workshop_install: 1, config_edit: 1, backup_create: 1, backup_restore: 1
    };
  }
  return db.prepare(
    'SELECT * FROM user_server_permissions WHERE user_id = ? AND server_id = ?'
  ).get(userId, serverId) || null;
}

function requirePermission(field) {
  return (req, res, next) => {
    if (req.session.isAdmin) return next();
    const perm = getPermission(req.session.userId, req.params.id);
    if (!perm || !perm[field]) {
      return res.status(403).json({ error: `Missing permission: ${field}` });
    }
    next();
  };
}

module.exports = {
  sessionMiddleware,
  hashPassword,
  verifyPassword,
  requireAuth,
  requireAdmin,
  requirePermission,
  getPermission
};
