const express = require('express');
const db = require('../db/db');
const { requireAuth, requirePermission } = require('../auth');
const dockerService = require('../services/dockerService');
const playerService = require('../services/playerService');
const { getTemplate } = require('../templates/registry');
const { logActivity } = require('../services/activityService');

const router = express.Router({ mergeParams: true });

router.get('/', requireAuth, (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  res.json({ online: playerService.getOnlinePlayers(server.id) });
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
    logActivity(server.id, 'player_kicked', `Kicked ${req.params.name}`);
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
    logActivity(server.id, 'player_banned', `Banned ${req.params.name}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
