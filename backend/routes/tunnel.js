const express = require('express');
const db = require('../db/db');
const { requireAuth, requirePermission } = require('../auth');
const playitService = require('../services/playitService');

const router = express.Router({ mergeParams: true });

router.get('/', requireAuth, (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  res.json({
    enabled: !!server.playit_enabled,
    address: server.playit_public_address,
    tunnelId: server.playit_tunnel_id
  });
});

router.post('/enable', requireAuth, requirePermission('start_stop'), async (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  try {
    const result = await playitService.enableTunnel(server.id, server.port);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/disable', requireAuth, requirePermission('start_stop'), (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  res.json(playitService.disableTunnel(server.id));
});

module.exports = router;
