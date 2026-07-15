const express = require('express');
const db = require('../db/db');
const { requireAuth } = require('../auth');
const steamApi = require('../services/steamApi');
const workshopService = require('../services/workshopService');

const router = express.Router();

router.get('/search', requireAuth, async (req, res) => {
  try {
    const results = await steamApi.searchWorkshop(req.query.appid, req.query.q, Number(req.query.page) || 1);
    res.json(results);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/item/:itemId', requireAuth, async (req, res) => {
  try {
    const details = await steamApi.getItemDetails(req.params.itemId);
    if (!details) return res.status(404).json({ error: 'Item not found' });
    res.json(details);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/collection/resolve', requireAuth, async (req, res) => {
  const { collectionId } = req.body || {};
  if (!collectionId) return res.status(400).json({ error: 'collectionId is required' });

  try {
    const items = await steamApi.resolveCollection(collectionId);
    res.json(items);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/presets', requireAuth, (req, res) => {
  const rows = req.query.gameId
    ? db.prepare('SELECT * FROM mod_presets WHERE game_id = ? ORDER BY created_at DESC').all(req.query.gameId)
    : db.prepare('SELECT * FROM mod_presets ORDER BY created_at DESC').all();
  res.json(rows.map((r) => ({ ...r, mods: JSON.parse(r.mods) })));
});

router.post('/presets', requireAuth, (req, res) => {
  const { name, gameId, mods } = req.body || {};
  if (!name || !gameId || !mods) return res.status(400).json({ error: 'name, gameId, and mods are required' });
  res.status(201).json(workshopService.savePreset(name, gameId, mods));
});

module.exports = router;
