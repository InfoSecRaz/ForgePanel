const db = require('../db/db');
const { logActivity } = require('./activityService');

function detectPlayerEvent(template, line) {
  if (!template.playerPatterns) return null;
  const joinMatch = template.playerPatterns.join && line.match(new RegExp(template.playerPatterns.join));
  if (joinMatch) return { event: 'join', playerName: joinMatch[1] || joinMatch[0] };
  const leaveMatch = template.playerPatterns.leave && line.match(new RegExp(template.playerPatterns.leave));
  if (leaveMatch) return { event: 'leave', playerName: leaveMatch[1] || leaveMatch[0] };
  return null;
}

function recordPlayerEvent(serverId, playerName, event, io) {
  db.prepare('INSERT INTO player_history (server_id, player_name, event) VALUES (?, ?, ?)').run(serverId, playerName, event);
  logActivity(serverId, `player_${event}`, `${playerName} ${event === 'join' ? 'joined' : 'left'}`);
  io.emit(event === 'join' ? 'player:join' : 'player:leave', { serverId, playerName });
}

function processLine(template, serverId, line, io) {
  const match = detectPlayerEvent(template, line);
  if (match) recordPlayerEvent(serverId, match.playerName, match.event, io);
}

function getOnlinePlayers(serverId) {
  return db.prepare(`
    SELECT player_name, MAX(occurred_at) as last_event FROM player_history
    WHERE server_id = ?
    GROUP BY player_name
    HAVING (
      SELECT event FROM player_history p2
      WHERE p2.server_id = ? AND p2.player_name = player_history.player_name
      ORDER BY occurred_at DESC LIMIT 1
    ) = 'join'
  `).all(serverId, serverId).map((r) => r.player_name);
}

module.exports = { detectPlayerEvent, recordPlayerEvent, processLine, getOnlinePlayers };
