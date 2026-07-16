const db = require('../db/db');

let io = null;

function attachIo(socketIo) {
  io = socketIo;
}

function logActivity(serverId, eventType, description, metadata, userId, ipAddress) {
  const stmt = db.prepare(`
    INSERT INTO activity_log (server_id, event_type, description, metadata, user_id, ip_address)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    serverId, eventType, description || null, metadata ? JSON.stringify(metadata) : null,
    userId || null, ipAddress || null
  );

  const username = userId ? (db.prepare('SELECT username FROM users WHERE id = ?').get(userId) || {}).username : null;

  const event = {
    id: info.lastInsertRowid,
    serverId,
    eventType,
    description,
    metadata,
    userId: userId || null,
    username: username || null,
    ipAddress: ipAddress || null,
    occurredAt: new Date().toISOString()
  };

  if (io) io.emit('activity:new', { serverId, event });
  return event;
}

function actorFromReq(req) {
  return {
    userId: (req.session && req.session.userId) || null,
    ipAddress: req.headers['x-forwarded-for'] || req.ip || null
  };
}

module.exports = { attachIo, logActivity, actorFromReq };
