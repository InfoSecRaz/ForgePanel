const express = require('express');
const { requireAuth } = require('../auth');
const { listTemplates, getTemplate } = require('../templates/registry');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  res.json(listTemplates().map(({ dir, ...rest }) => rest));
});

router.get('/:id', requireAuth, (req, res) => {
  const template = getTemplate(req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });
  const { dir, ...rest } = template;
  res.json(rest);
});

module.exports = router;
