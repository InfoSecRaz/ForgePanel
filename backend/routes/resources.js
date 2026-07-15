const express = require('express');
const db = require('../db/db');
const { requireAuth } = require('../auth');

const router = express.Router({ mergeParams: true });

const RANGE_TO_SQL = {
  '30min': '-30 minutes',
  '1h': '-1 hours',
  '6h': '-6 hours',
  '24h': '-24 hours',
  '7d': '-7 days',
  '30d': '-30 days'
};

router.get('/', requireAuth, (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const range = RANGE_TO_SQL[req.query.range] || RANGE_TO_SQL['1h'];
  const rows = db.prepare(`
    SELECT cpu_percent, ram_mb, disk_mb, network_rx_mb, network_tx_mb, player_count, recorded_at
    FROM resource_history
    WHERE server_id = ? AND recorded_at >= datetime('now', ?)
    ORDER BY recorded_at ASC
  `).all(server.id, range);

  res.json({ range: req.query.range || '1h', points: rows });
});

module.exports = router;
