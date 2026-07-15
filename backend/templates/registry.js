const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = __dirname;

let cache = null;

function loadAll() {
  const templates = {};
  const entries = fs.readdirSync(TEMPLATES_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const templatePath = path.join(TEMPLATES_DIR, entry.name, 'template.json');
    if (!fs.existsSync(templatePath)) continue;
    try {
      const raw = fs.readFileSync(templatePath, 'utf8');
      const parsed = JSON.parse(raw);
      templates[parsed.id || entry.name] = { ...parsed, dir: path.join(TEMPLATES_DIR, entry.name) };
    } catch (err) {
      console.error(`Failed to load template ${entry.name}:`, err.message);
    }
  }
  return templates;
}

function reload() {
  cache = loadAll();
  return cache;
}

function getAll() {
  if (!cache) cache = loadAll();
  return cache;
}

function getTemplate(gameId) {
  return getAll()[gameId];
}

function listTemplates() {
  return Object.values(getAll());
}

module.exports = { getTemplate, listTemplates, reload };
