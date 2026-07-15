const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/db');
const steamcmd = require('./steamcmd');
const steamApi = require('./steamApi');
const { getTemplate } = require('../templates/registry');
const { logActivity } = require('./activityService');

const DATA_ROOT = process.env.FORGE_DATA_PATH || path.join(__dirname, '..', '..', 'servers');

function parseModInfo(contentDir) {
  const infoPath = path.join(contentDir, 'mod.info');
  if (!fs.existsSync(infoPath)) return { modId: null };
  const raw = fs.readFileSync(infoPath, 'utf8');
  const match = raw.match(/^id\s*=\s*(.+)$/m);
  return { modId: match ? match[1].trim() : null };
}

function updateModListField(server, template, io) {
  if (!template.workshopModListField) return;
  const configPath = path.join(DATA_ROOT, server.id, 'data', template.config.file);
  if (!fs.existsSync(configPath)) return;

  const mods = db.prepare('SELECT mod_id FROM workshop_mods WHERE server_id = ?').all(server.id)
    .map((r) => r.mod_id).filter(Boolean);
  const items = db.prepare('SELECT workshop_item_id FROM workshop_mods WHERE server_id = ?').all(server.id)
    .map((r) => r.workshop_item_id);

  let content = fs.readFileSync(configPath, 'utf8');
  const modsLine = `${template.workshopModListField.modsKey}=${mods.join(';')}`;
  const itemsLine = `${template.workshopModListField.itemsKey}=${items.join(';')}`;

  content = content.replace(new RegExp(`^${template.workshopModListField.modsKey}=.*$`, 'm'), modsLine);
  content = content.replace(new RegExp(`^${template.workshopModListField.itemsKey}=.*$`, 'm'), itemsLine);
  fs.writeFileSync(configPath, content);
}

async function installMod(serverId, workshopItemId, io) {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
  if (!server) throw new Error('Server not found');
  const template = getTemplate(server.game_id);
  if (!template || template.workshopProvider !== 'steam') {
    throw new Error('This game does not support Steam Workshop installs');
  }

  const details = await steamApi.getItemDetails(workshopItemId);
  const modsPath = path.join(DATA_ROOT, serverId, 'mods');

  const contentDir = await steamcmd.downloadWorkshopItem(template.workshopAppid || template.appid, workshopItemId, (line) => {
    io.emit('install:progress', { serverId, line, phase: 'workshop' });
  });

  const destDir = path.join(modsPath, workshopItemId);
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.cpSync(contentDir, destDir, { recursive: true });

  const { modId } = parseModInfo(destDir);

  const id = uuidv4();
  db.prepare(`
    INSERT INTO workshop_mods (id, server_id, workshop_item_id, mod_id, title, thumbnail_url, last_updated)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(id, serverId, workshopItemId, modId, details ? details.title : null, details ? details.preview_url : null);

  updateModListField(server, template, io);
  logActivity(serverId, 'mod_installed', `Installed mod: ${details ? details.title : workshopItemId}`);

  return db.prepare('SELECT * FROM workshop_mods WHERE id = ?').get(id);
}

async function installCollection(serverId, collectionId, io) {
  const items = await steamApi.resolveCollection(collectionId);
  const total = items.length;
  let current = 0;
  const results = [];

  for (const item of items) {
    current += 1;
    io.emit('install:progress', {
      serverId, phase: 'workshop_collection', current, total,
      line: `Installing ${current} of ${total}: ${item.title}`
    });
    try {
      const installed = await installMod(serverId, item.id, io);
      results.push({ ...item, status: 'done', modRecordId: installed.id });
    } catch (err) {
      results.push({ ...item, status: 'failed', error: err.message });
    }
  }

  return results;
}

function removeMod(serverId, modRecordId) {
  const mod = db.prepare('SELECT * FROM workshop_mods WHERE id = ? AND server_id = ?').get(modRecordId, serverId);
  if (!mod) throw new Error('Mod not found');

  const modsPath = path.join(DATA_ROOT, serverId, 'mods', mod.workshop_item_id);
  fs.rmSync(modsPath, { recursive: true, force: true });
  db.prepare('DELETE FROM workshop_mods WHERE id = ?').run(modRecordId);

  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
  const template = getTemplate(server.game_id);
  if (template) updateModListField(server, template);

  logActivity(serverId, 'mod_removed', `Removed mod: ${mod.title || mod.workshop_item_id}`);
}

function savePreset(name, gameId, mods) {
  const id = uuidv4();
  db.prepare('INSERT INTO mod_presets (id, name, game_id, mods) VALUES (?, ?, ?, ?)')
    .run(id, name, gameId, JSON.stringify(mods));
  return db.prepare('SELECT * FROM mod_presets WHERE id = ?').get(id);
}

async function applyPreset(serverId, presetId, io) {
  const preset = db.prepare('SELECT * FROM mod_presets WHERE id = ?').get(presetId);
  if (!preset) throw new Error('Preset not found');
  const mods = JSON.parse(preset.mods);

  const results = [];
  for (const mod of mods) {
    try {
      results.push(await installMod(serverId, mod.workshopItemId || mod.id, io));
    } catch (err) {
      results.push({ error: err.message, workshopItemId: mod.workshopItemId || mod.id });
    }
  }
  return results;
}

module.exports = { installMod, installCollection, removeMod, savePreset, applyPreset };
