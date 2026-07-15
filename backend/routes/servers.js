const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/db');
const dockerService = require('../services/dockerService');
const { requireAuth, requirePermission } = require('../auth');
const { getTemplate } = require('../templates/registry');
const { logActivity } = require('../services/activityService');

const router = express.Router();

const DATA_ROOT = process.env.FORGE_DATA_PATH || path.join(__dirname, '..', '..', 'servers');

function serverDirs(serverId) {
  const base = path.join(DATA_ROOT, serverId);
  return { base, data: path.join(base, 'data'), mods: path.join(base, 'mods') };
}

function toApiServer(row) {
  const { rcon_password, ...rest } = row;
  return rest;
}

router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM servers ORDER BY created_at DESC').all();
  res.json(rows.map(toApiServer));
});

router.get('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Server not found' });
  res.json(toApiServer(row));
});

router.post('/', requireAuth, async (req, res) => {
  const { name, gameId, port, queryPort, ramLimitMb, cpuLimitPercent, diskLimitGb, fields } = req.body || {};
  if (!name || !gameId) return res.status(400).json({ error: 'name and gameId are required' });

  const template = getTemplate(gameId);
  if (!template) return res.status(400).json({ error: `Unknown game_id: ${gameId}` });

  const primaryPortEntry = (template.ports || []).find((p) => p.primary) || (template.ports || [])[0];
  const resolvedPort = port || (primaryPortEntry && primaryPortEntry.port);
  const resolvedQueryPort = queryPort || template.queryPort || null;

  if (!resolvedPort) return res.status(400).json({ error: `Template ${gameId} has no ports defined` });
  if (await dockerService.portInUse(resolvedPort)) {
    return res.status(409).json({ error: `Port ${resolvedPort} is already in use` });
  }

  const id = uuidv4();
  const dirs = serverDirs(id);
  fs.mkdirSync(dirs.data, { recursive: true });
  fs.mkdirSync(dirs.mods, { recursive: true });

  const rconPassword = crypto.randomBytes(12).toString('hex');

  db.prepare(`
    INSERT INTO servers (id, name, game_id, state, port, query_port, rcon_password,
      ram_limit_mb, cpu_limit_percent, disk_limit_gb)
    VALUES (?, ?, ?, 'installing', ?, ?, ?, ?, ?, ?)
  `).run(
    id, name, gameId, resolvedPort, resolvedQueryPort,
    rconPassword, ramLimitMb || template.defaultRamMb || 2048, cpuLimitPercent || 100, diskLimitGb || 20
  );

  logActivity(id, 'server_created', `Server "${name}" created from template ${gameId}`);

  res.status(201).json(toApiServer(db.prepare('SELECT * FROM servers WHERE id = ?').get(id)));

  req.app.locals.installService.install(id, template, fields || {}).catch((err) => {
    db.prepare('UPDATE servers SET state = ? WHERE id = ?').run('stopped', id);
    logActivity(id, 'install_failed', err.message);
  });
});

router.put('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Server not found' });

  const fields = [
    'name', 'ram_limit_mb', 'cpu_limit_percent', 'disk_limit_gb', 'auto_restart', 'auto_restart_delay',
    'discord_webhook_url', 'discord_bot_channel_id', 'discord_chat_relay'
  ];
  const updates = [];
  const values = [];
  for (const f of fields) {
    const camel = f.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (req.body && req.body[camel] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(req.body[camel]);
    }
  }
  if (updates.length === 0) return res.json(toApiServer(row));

  updates.push("updated_at = datetime('now')");
  values.push(req.params.id);
  db.prepare(`UPDATE servers SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json(toApiServer(db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id)));
});

router.delete('/:id', requireAuth, async (req, res) => {
  const row = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Server not found' });

  if (row.container_id) {
    try {
      await dockerService.removeContainer(row.container_id);
    } catch (err) {
      // Container may already be gone; proceed with DB cleanup regardless.
    }
  }

  db.prepare('DELETE FROM servers WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/:id/start', requireAuth, requirePermission('start_stop'), async (req, res) => {
  const row = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Server not found' });
  if (!row.container_id) return res.status(400).json({ error: 'Server has no container; reinstall required' });

  const previous = row.state;
  db.prepare('UPDATE servers SET state = ? WHERE id = ?').run('starting', row.id);
  req.app.locals.io.emit('state:change', { serverId: row.id, state: 'starting', previous });

  try {
    await dockerService.startContainer(row.container_id);
    logActivity(row.id, 'server_start_requested', 'Start command issued');
    res.json({ ok: true });
  } catch (err) {
    db.prepare('UPDATE servers SET state = ? WHERE id = ?').run('crashed', row.id);
    req.app.locals.io.emit('state:change', { serverId: row.id, state: 'crashed', previous: 'starting' });
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/stop', requireAuth, requirePermission('start_stop'), async (req, res) => {
  const row = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Server not found' });

  const previous = row.state;
  db.prepare('UPDATE servers SET state = ? WHERE id = ?').run('stopping', row.id);
  req.app.locals.io.emit('state:change', { serverId: row.id, state: 'stopping', previous });

  try {
    const template = getTemplate(row.game_id);
    if (template && template.stop && template.stop.type === 'stdin') {
      await dockerService.sendCommand(row.container_id, template.stop.command);
    } else {
      await dockerService.stopContainer(row.container_id);
    }
    logActivity(row.id, 'server_stop_requested', 'Stop command issued');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/restart', requireAuth, requirePermission('start_stop'), async (req, res) => {
  const row = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Server not found' });

  const previous = row.state;
  db.prepare('UPDATE servers SET state = ? WHERE id = ?').run('restarting', row.id);
  req.app.locals.io.emit('state:change', { serverId: row.id, state: 'restarting', previous });

  try {
    await dockerService.restartContainer(row.container_id);
    logActivity(row.id, 'server_restart_requested', 'Restart command issued');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/status', requireAuth, async (req, res) => {
  const row = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Server not found' });

  let containerState = null;
  if (row.container_id) {
    try {
      const info = await dockerService.inspectContainer(row.container_id);
      containerState = info.State;
    } catch (err) {
      containerState = null;
    }
  }
  res.json({ state: row.state, container: containerState });
});

module.exports = router;
