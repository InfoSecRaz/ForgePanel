const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/db');
const { requireAuth, requirePermission } = require('../auth');
const schedulerService = require('../services/schedulerService');

const router = express.Router({ mergeParams: true });

router.get('/', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM scheduled_tasks WHERE server_id = ? ORDER BY created_at DESC').all(req.params.id));
});

router.post('/', requireAuth, requirePermission('config_edit'), (req, res) => {
  const { name, type, cronExpression, payload, enabled } = req.body || {};
  if (!name || !type || !cronExpression) {
    return res.status(400).json({ error: 'name, type, and cronExpression are required' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO scheduled_tasks (id, server_id, name, type, cron_expression, payload, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.id, name, type, cronExpression, payload ? JSON.stringify(payload) : null, enabled === false ? 0 : 1);

  const task = db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(id);
  schedulerService.scheduleTask(task);
  res.status(201).json(task);
});

router.put('/:taskId', requireAuth, requirePermission('config_edit'), (req, res) => {
  const task = db.prepare('SELECT * FROM scheduled_tasks WHERE id = ? AND server_id = ?').get(req.params.taskId, req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const { name, cronExpression, payload, enabled } = req.body || {};
  db.prepare(`
    UPDATE scheduled_tasks SET
      name = COALESCE(?, name),
      cron_expression = COALESCE(?, cron_expression),
      payload = COALESCE(?, payload),
      enabled = COALESCE(?, enabled)
    WHERE id = ?
  `).run(name, cronExpression, payload ? JSON.stringify(payload) : null, enabled === undefined ? null : (enabled ? 1 : 0), req.params.taskId);

  const updated = db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(req.params.taskId);
  schedulerService.scheduleTask(updated);
  res.json(updated);
});

router.delete('/:taskId', requireAuth, requirePermission('config_edit'), (req, res) => {
  schedulerService.unscheduleTask(req.params.taskId);
  db.prepare('DELETE FROM scheduled_tasks WHERE id = ? AND server_id = ?').run(req.params.taskId, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
