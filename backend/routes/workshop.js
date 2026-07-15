const express = require('express');
const db = require('../db/db');
const { requireAuth, requirePermission } = require('../auth');
const workshopService = require('../services/workshopService');

const router = express.Router({ mergeParams: true });

router.get('/', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM workshop_mods WHERE server_id = ? ORDER BY installed_at DESC').all(req.params.id));
});

router.post('/install', requireAuth, requirePermission('workshop_install'), async (req, res) => {
  const { workshopItemId } = req.body || {};
  if (!workshopItemId) return res.status(400).json({ error: 'workshopItemId is required' });

  try {
    const mod = await workshopService.installMod(req.params.id, workshopItemId, req.app.locals.io);
    res.status(201).json(mod);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/collection', requireAuth, requirePermission('workshop_install'), async (req, res) => {
  const { collectionId } = req.body || {};
  if (!collectionId) return res.status(400).json({ error: 'collectionId is required' });

  try {
    const results = await workshopService.installCollection(req.params.id, collectionId, req.app.locals.io);
    res.status(201).json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/preset/:presetId', requireAuth, requirePermission('workshop_install'), async (req, res) => {
  try {
    const results = await workshopService.applyPreset(req.params.id, req.params.presetId, req.app.locals.io);
    res.status(201).json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:modId', requireAuth, requirePermission('workshop_install'), (req, res) => {
  try {
    workshopService.removeMod(req.params.id, req.params.modId);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
