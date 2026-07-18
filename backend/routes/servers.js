const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/db');
const dockerService = require('../services/dockerService');
const { requireAuth, requirePermission } = require('../auth');
const { getTemplate } = require('../templates/registry');
const { logActivity, actorFromReq } = require('../services/activityService');
const { getMaxPlayers } = require('../services/configService');

const router = express.Router();

const DATA_ROOT = process.env.FORGE_DATA_PATH || path.join(__dirname, '..', '..', 'servers');

function serverDirs(serverId) {
  const base = path.join(DATA_ROOT, serverId);
  return { base, data: path.join(base, 'data'), mods: path.join(base, 'mods') };
}

function latestDiskMb(serverId) {
  const row = db.prepare('SELECT disk_mb FROM resource_history WHERE server_id = ? ORDER BY id DESC LIMIT 1').get(serverId);
  return row && row.disk_mb != null ? row.disk_mb : null;
}

function toApiServer(row) {
  const { rcon_password, ...rest } = row;
  const template = getTemplate(row.game_id);
  return {
    ...rest,
    maxPlayers: template ? getMaxPlayers(template, serverDirs(row.id).data) : null,
    diskUsedMb: latestDiskMb(row.id)
  };
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
  const {
    name, gameId, port, queryPort, ramLimitMb, cpuLimitPercent, diskLimitGb, fields, installOptionValues
  } = req.body || {};
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

  const buildBranchOption = (template.installOptions || []).find((o) => o.key === 'buildBranch');
  const installBranch = buildBranchOption
    ? ((installOptionValues && installOptionValues.buildBranch) || buildBranchOption.default || 'stable')
    : 'stable';

  db.prepare(`
    INSERT INTO servers (id, name, game_id, state, port, query_port, rcon_password,
      ram_limit_mb, cpu_limit_percent, disk_limit_gb, install_branch)
    VALUES (?, ?, ?, 'installing', ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, name, gameId, resolvedPort, resolvedQueryPort,
    rconPassword, ramLimitMb || template.defaultRamMb || 2048, cpuLimitPercent || 100, diskLimitGb || 20, installBranch
  );

  {
    const { userId, ipAddress } = actorFromReq(req);
    logActivity(id, 'server_created', `Server "${name}" created from template ${gameId}`, null, userId, ipAddress);
  }

  res.status(201).json(toApiServer(db.prepare('SELECT * FROM servers WHERE id = ?').get(id)));

  req.app.locals.installService.install(id, template, fields || {}, installOptionValues || {}).catch((err) => {
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
      const value = req.body[camel];
      values.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
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
    const { userId, ipAddress } = actorFromReq(req);
    logActivity(row.id, 'server_start_requested', 'Start command issued', null, userId, ipAddress);
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
    {
      const { userId, ipAddress } = actorFromReq(req);
      logActivity(row.id, 'server_stop_requested', 'Stop command issued', null, userId, ipAddress);
    }
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
    {
      const { userId, ipAddress } = actorFromReq(req);
      logActivity(row.id, 'server_restart_requested', 'Restart command issued', null, userId, ipAddress);
    }
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

router.get('/:id/activity', requireAuth, (req, res) => {
  const row = db.prepare('SELECT id FROM servers WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Server not found' });

  const rows = db.prepare(`
    SELECT a.*, u.username FROM activity_log a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.server_id = ?
    ORDER BY a.occurred_at DESC LIMIT 50
  `).all(req.params.id);

  res.json({
    events: rows.map((r) => ({
      id: r.id,
      eventType: r.event_type,
      description: r.description,
      metadata: r.metadata ? JSON.parse(r.metadata) : null,
      userId: r.user_id,
      username: r.username,
      ipAddress: r.ip_address,
      occurredAt: r.occurred_at
    }))
  });
});

router.get('/:id/console/history', requireAuth, async (req, res) => {
  const row = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Server not found' });
  if (!row.container_id) return res.json({ lines: [] });

  try {
    const lines = await dockerService.getRecentLogs(row.container_id, 200);
    res.json({ lines });
  } catch (err) {
    res.json({ lines: [] });
  }
});

module.exports = router;
