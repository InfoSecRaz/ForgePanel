const db = require('../db/db');

let io = null;

function attachIo(socketIo) {
  io = socketIo;
}

function logActivity(serverId, eventType, description, metadata) {
  const stmt = db.prepare(`
    INSERT INTO activity_log (server_id, event_type, description, metadata)
    VALUES (?, ?, ?, ?)
  `);
  const info = stmt.run(serverId, eventType, description || null, metadata ? JSON.stringify(metadata) : null);

  const event = {
    id: info.lastInsertRowid,
    serverId,
    eventType,
    description,
    metadata,
    occurredAt: new Date().toISOString()
  };

  if (io) io.emit('activity:new', { serverId, event });
  return event;
}

module.exports = { attachIo, logActivity };
