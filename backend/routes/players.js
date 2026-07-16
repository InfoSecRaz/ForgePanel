const express = require('express');
const db = require('../db/db');
const { requireAuth, requirePermission } = require('../auth');
const dockerService = require('../services/dockerService');
const playerService = require('../services/playerService');
const { getTemplate } = require('../templates/registry');
const { logActivity, actorFromReq } = require('../services/activityService');

const router = express.Router({ mergeParams: true });

router.get('/', requireAuth, (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  res.json({ online: playerService.getOnlinePlayers(server.id) });
});

router.get('/history', requireAuth, (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const rows = db.prepare(`
    SELECT player_name, MAX(occurred_at) as last_seen, COUNT(*) as sessions
    FROM player_history
    WHERE server_id = ? AND event = 'join'
    GROUP BY player_name
    ORDER BY last_seen DESC
    LIMIT 20
  `).all(req.params.id);

  res.json(rows.map((r) => ({ playerName: r.player_name, lastSeen: r.last_seen, sessions: r.sessions })));
});

router.post('/:name/kick', requireAuth, requirePermission('start_stop'), async (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  const template = getTemplate(server.game_id);

  try {
    const command = template && template.kickCommand
      ? template.kickCommand.replace('{player}', req.params.name)
      : `kick ${req.params.name}`;
    await dockerService.sendCommand(server.container_id, command);
    {
      const { userId, ipAddress } = actorFromReq(req);
      logActivity(server.id, 'player_kicked', `Kicked ${req.params.name}`, null, userId, ipAddress);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:name/ban', requireAuth, requirePermission('start_stop'), async (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  const template = getTemplate(server.game_id);

  try {
    const command = template && template.banCommand
      ? template.banCommand.replace('{player}', req.params.name)
      : `ban ${req.params.name}`;
    await dockerService.sendCommand(server.container_id, command);
    {
      const { userId, ipAddress } = actorFromReq(req);
      logActivity(server.id, 'player_banned', `Banned ${req.params.name}`, null, userId, ipAddress);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
