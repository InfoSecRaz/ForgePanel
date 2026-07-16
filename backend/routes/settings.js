const express = require('express');
const os = require('os');
const { execSync } = require('child_process');
const db = require('../db/db');
const { requireAdmin, requireAuth } = require('../auth');
const playitService = require('../services/playitService');
const { getTier } = require('../services/resourceService');

const router = express.Router();

const REDACTED_KEYS = new Set(['discord_bot_token', 's3_secret_key']);

function getHostCapacity() {
  let totalDiskGb = null;
  try {
    const output = execSync("df -k --output=size / | tail -1", { encoding: 'utf8' }).trim();
    totalDiskGb = Math.round((parseInt(output, 10) * 1024) / (1024 * 1024 * 1024));
  } catch (err) {
    totalDiskGb = null;
  }

  return {
    totalRamMb: Math.round(os.totalmem() / (1024 * 1024)),
    cpuCores: os.cpus().length,
    totalDiskGb,
    tier: getTier()
  };
}

router.get('/host', requireAuth, (req, res) => {
  res.json(getHostCapacity());
});

router.get('/', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = REDACTED_KEYS.has(row.key) ? (row.value ? '••••••••' : null) : row.value;
  }
  res.json({ ...settings, host: getHostCapacity() });
});

router.post('/playit/claim-start', requireAdmin, async (req, res) => {
  try {
    const code = playitService.generateClaimCode();
    const url = playitService.getClaimUrl(code);

    playitService.exchangeClaim(code, 120).catch((err) => {
      console.error('playit claim exchange failed:', err.message);
    });

    res.json({ url, code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/playit/status', requireAdmin, (req, res) => {
  res.json({ installed: playitService.isInstalled(), status: playitService.getStatus() });
});

router.put('/', requireAdmin, (req, res) => {
  const updates = req.body || {};
  const stmt = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  const tx = db.transaction((entries) => {
    for (const [key, value] of entries) {
      if (REDACTED_KEYS.has(key) && value === '••••••••') continue;
      stmt.run(key, value === null || value === undefined ? null : String(value));
    }
  });
  tx(Object.entries(updates));

  res.json({ ok: true });
});

module.exports = router;
