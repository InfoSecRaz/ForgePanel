const { execSync } = require('child_process');
const fs = require('fs');
const db = require('../db/db');
const dockerService = require('./dockerService');

const POLL_STATS_MS = 10 * 1000;
const POLL_DISK_MS = 60 * 1000;
const RAM_ALERT_PERCENT = 90;
const RAM_ALERT_SUSTAIN_MS = 60 * 1000;

const ramOverThresholdSince = new Map();

function getTier() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'license_tier'").get();
  return row && row.value === 'pro' ? 'pro' : 'free';
}

function retentionHours() {
  return getTier() === 'pro' ? 30 * 24 : 24;
}

function du(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  try {
    const output = execSync(`du -sb "${dirPath}"`, { encoding: 'utf8' });
    return parseInt(output.split('\t')[0], 10) || 0;
  } catch (err) {
    return 0;
  }
}

function diskPercent(dirPath, diskLimitGb) {
  const bytes = du(dirPath);
  const limitBytes = diskLimitGb * 1024 * 1024 * 1024;
  if (!limitBytes) return 0;
  return Math.round((bytes / limitBytes) * 1000) / 10;
}

async function pollStats(io) {
  const servers = db.prepare("SELECT * FROM servers WHERE state = 'running' AND container_id IS NOT NULL").all();

  for (const server of servers) {
    try {
      const stats = await dockerService.getStats(server.container_id);
      const playerRow = db.prepare(`
        SELECT COUNT(*) as count FROM (
          SELECT player_name FROM player_history
          WHERE server_id = ? AND occurred_at = (
            SELECT MAX(occurred_at) FROM player_history p2
            WHERE p2.server_id = player_history.server_id AND p2.player_name = player_history.player_name
          ) AND event = 'join'
        )
      `).get(server.id);
      const playerCount = playerRow ? playerRow.count : 0;

      db.prepare(`
        INSERT INTO resource_history (server_id, cpu_percent, ram_mb, network_rx_mb, network_tx_mb, player_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(server.id, stats.cpuPercent, stats.ramMb, stats.networkRxMb, stats.networkTxMb, playerCount);

      io.emit('stats:update', {
        serverId: server.id,
        cpu: stats.cpuPercent,
        ram: stats.ramMb,
        network_rx: stats.networkRxMb,
        network_tx: stats.networkTxMb,
        players: playerCount
      });

      const ramPercent = (stats.ramMb / server.ram_limit_mb) * 100;
      if (ramPercent >= RAM_ALERT_PERCENT) {
        const since = ramOverThresholdSince.get(server.id) || Date.now();
        ramOverThresholdSince.set(server.id, since);
        if (Date.now() - since >= RAM_ALERT_SUSTAIN_MS) {
          const { notify } = require('./discordService');
          notify(server.id, 'ram_alert', `Server "${server.name}" has been above ${RAM_ALERT_PERCENT}% RAM for over 60s`);
          ramOverThresholdSince.delete(server.id);
        }
      } else {
        ramOverThresholdSince.delete(server.id);
      }
    } catch (err) {
      // Container may have just stopped between the state check and stats call; skip this cycle.
    }
  }
}

function pollDisk() {
  const path = require('path');
  const DATA_ROOT = process.env.FORGE_DATA_PATH || path.join(__dirname, '..', '..', 'servers');
  const servers = db.prepare('SELECT * FROM servers').all();

  for (const server of servers) {
    const dataDir = path.join(DATA_ROOT, server.id, 'data');
    const percent = diskPercent(dataDir, server.disk_limit_gb);
    const bytes = du(dataDir);
    db.prepare('UPDATE resource_history SET disk_mb = ? WHERE server_id = ? AND id = (SELECT MAX(id) FROM resource_history WHERE server_id = ?)')
      .run(Math.round(bytes / (1024 * 1024)), server.id, server.id);
  }
}

function pruneHistory() {
  const cutoffHours = retentionHours();
  db.prepare(`DELETE FROM resource_history WHERE recorded_at < datetime('now', '-${cutoffHours} hours')`).run();
}

function startMonitoring(io) {
  setInterval(() => pollStats(io).catch(() => {}), POLL_STATS_MS);
  setInterval(() => {
    try {
      pollDisk();
      pruneHistory();
    } catch (err) {
      // Non-fatal: skip this cycle and retry on the next interval.
    }
  }, POLL_DISK_MS);
}

module.exports = { du, diskPercent, startMonitoring, getTier };
