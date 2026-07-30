const express = require('express');
const os = require('os');
const { execSync } = require('child_process');
const db = require('../db/db');
const { requireAdmin, requireAuth } = require('../auth');
const playitService = require('../services/playitService');
const { getTier } = require('../services/resourceService');
const logger = require('../logger');

const router = express.Router();

// discord_bot_token intentionally NOT redacted: the Discord settings UI needs to display
// and let the admin re-verify the real saved value (show/hide toggle, same pattern as the
// Steam API key), which is impossible if the server never sends it back.
const REDACTED_KEYS = new Set(['s3_secret_key']);
// Separate from REDACTED_KEYS on purpose: a field can need wipe-protection on save without
// being hidden on read. discord_bot_token is readable (see above) but still must never be
// blanked out by an empty/placeholder value sneaking through a save.
const PROTECT_FROM_EMPTY_KEYS = new Set(['discord_bot_token', 's3_secret_key']);

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

const THEME_DEFAULTS = {
  theme_accent_color: '#f59e0b',
  theme_panel_name: 'ForgePanel',
  theme_panel_icon: '🔨',
  theme_card_style: 'warm',
  theme_background: 'solid',
  theme_font: 'inter',
  theme_attribution: 'true',
  theme_setup_complete: 'false'
};

const THEME_KEY_MAP = {
  accentColor: 'theme_accent_color',
  panelName: 'theme_panel_name',
  panelIcon: 'theme_panel_icon',
  cardStyle: 'theme_card_style',
  background: 'theme_background',
  font: 'theme_font',
  attribution: 'theme_attribution',
  setupComplete: 'theme_setup_complete'
};

function getThemeSettings() {
  const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'theme_%'").all();
  const stored = {};
  for (const row of rows) stored[row.key] = row.value;
  const merged = { ...THEME_DEFAULTS, ...stored };
  return {
    accentColor: merged.theme_accent_color,
    panelName: merged.theme_panel_name,
    panelIcon: merged.theme_panel_icon,
    cardStyle: merged.theme_card_style,
    background: merged.theme_background,
    font: merged.theme_font,
    attribution: merged.theme_attribution === 'true',
    setupComplete: merged.theme_setup_complete === 'true'
  };
}

// Public and unauthenticated on purpose: the login page and the first-run wizard's own
// redirect check both need panel identity/theme before a session exists.
router.get('/theme', (req, res) => {
  res.json(getThemeSettings());
});

router.put('/theme', requireAdmin, (req, res) => {
  const body = req.body || {};
  const stmt = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  const tx = db.transaction(() => {
    for (const [camel, dbKey] of Object.entries(THEME_KEY_MAP)) {
      // Partial updates only -- a key simply absent from the body is left untouched.
      if (!Object.prototype.hasOwnProperty.call(body, camel)) continue;
      const value = body[camel];
      stmt.run(dbKey, value === null || value === undefined ? null : String(value));
    }
  });
  tx();
  res.json(getThemeSettings());
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
      logger.error({ err }, 'playit claim exchange failed');
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
      // Never let a protected field's save wipe the real stored value with the redacted
      // placeholder (a round-tripped GET response) or an accidental empty string -- only an
      // explicit non-empty value can replace a saved secret.
      if (PROTECT_FROM_EMPTY_KEYS.has(key) && (!value || value === '••••••••')) continue;
      stmt.run(key, value === null || value === undefined ? null : String(value));
    }
  });
  tx(Object.entries(updates));

  res.json({ ok: true });
});

module.exports = router;
