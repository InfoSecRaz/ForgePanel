const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db/db');
const { requireAuth, requirePermission } = require('../auth');
const { getTemplate } = require('../templates/registry');
const { renderConfig } = require('../services/configService');
const { backupBeforeSave } = require('../services/configBackupService');
const { logActivity, actorFromReq } = require('../services/activityService');

const router = express.Router({ mergeParams: true });

const DATA_ROOT = process.env.FORGE_DATA_PATH || path.join(__dirname, '..', '..', 'servers');

router.get('/', requireAuth, requirePermission('config_edit'), (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const template = getTemplate(server.game_id);
  if (!template) return res.status(400).json({ error: 'Unknown template' });

  const configPath = template.config && template.config.file
    ? path.join(DATA_ROOT, server.id, 'data', template.config.file)
    : null;

  res.json({
    fields: template.fields || [],
    raw: configPath && fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : null,
    configType: template.config ? template.config.type : 'args'
  });
});

router.post('/', requireAuth, requirePermission('config_edit'), (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const template = getTemplate(server.game_id);
  if (!template) return res.status(400).json({ error: 'Unknown template' });

  const dataPath = path.join(DATA_ROOT, server.id, 'data');
  const { fields, raw } = req.body || {};

  try {
    if (raw !== undefined && template.config && template.config.file) {
      const configPath = path.join(dataPath, template.config.file);
      backupBeforeSave(configPath);
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, raw);
    } else if (fields) {
      if (template.config && template.config.file) {
        backupBeforeSave(path.join(dataPath, template.config.file));
      }
      renderConfig(template, dataPath, fields);
    }
    {
      const { userId, ipAddress } = actorFromReq(req);
      logActivity(server.id, 'config_changed', 'Configuration updated', null, userId, ipAddress);
    }
    res.json({ ok: true, warning: server.state === 'running' ? 'Server is running; restart to apply changes' : null });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
