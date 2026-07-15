const db = require('../db/db');
const steamApi = require('./steamApi');
const { notify } = require('./discordService');
const { getTier } = require('./resourceService');

async function checkForUpdates(serverId) {
  if (getTier() !== 'pro') return [];

  const mods = db.prepare('SELECT * FROM workshop_mods WHERE server_id = ?').all(serverId);
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
  const updated = [];

  for (const mod of mods) {
    try {
      const details = await steamApi.getItemDetails(mod.workshop_item_id);
      if (!details) continue;

      const remoteUpdatedAt = details.time_updated ? new Date(details.time_updated * 1000).toISOString() : null;
      const isNewer = remoteUpdatedAt && mod.last_updated && remoteUpdatedAt > mod.last_updated;

      if (isNewer && !mod.update_available) {
        db.prepare('UPDATE workshop_mods SET update_available = 1 WHERE id = ?').run(mod.id);
        updated.push(mod);
      }
    } catch (err) {
      // Steam API may be rate-limited or the item may have been removed; skip and retry next cycle.
    }
  }

  if (updated.length > 0 && server) {
    notify(server.id, 'mods_updated', `${updated.length} mod update(s) available for "${server.name}"`);
  }

  return updated;
}

function startPeriodicCheck(intervalMs = 60 * 60 * 1000) {
  setInterval(() => {
    const servers = db.prepare('SELECT id FROM servers').all();
    servers.forEach((s) => checkForUpdates(s.id).catch(() => {}));
  }, intervalMs);
}

module.exports = { checkForUpdates, startPeriodicCheck };
