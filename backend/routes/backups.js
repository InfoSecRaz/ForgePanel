const express = require('express');
const db = require('../db/db');
const { requireAuth, requirePermission } = require('../auth');
const backupService = require('../services/backupService');

const router = express.Router({ mergeParams: true });

router.get('/', requireAuth, requirePermission('backup_create'), (req, res) => {
  const rows = db.prepare('SELECT * FROM backups WHERE server_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json(rows);
});

router.post('/', requireAuth, requirePermission('backup_create'), async (req, res) => {
  try {
    const backup = await backupService.backupServer(req.params.id);
    res.status(201).json(backup);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:backupId/restore', requireAuth, requirePermission('backup_restore'), async (req, res) => {
  try {
    await backupService.restoreBackup(req.params.id, req.params.backupId);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:backupId', requireAuth, requirePermission('backup_create'), (req, res) => {
  try {
    backupService.deleteBackup(req.params.id, req.params.backupId);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
