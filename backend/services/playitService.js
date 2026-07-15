const { execSync, spawn } = require('child_process');
const db = require('../db/db');

function isInstalled() {
  try {
    execSync('which playit', { stdio: 'ignore' });
    return true;
  } catch (err) {
    return false;
  }
}

function getStatus() {
  try {
    return execSync('playit status', { encoding: 'utf8' });
  } catch (err) {
    return err.stdout ? err.stdout.toString() : 'The playit service is not running.';
  }
}

function generateClaimCode() {
  return execSync('playit claim generate', { encoding: 'utf8' }).trim();
}

function getClaimUrl(claimCode) {
  return execSync(`playit claim url ${claimCode} --name ForgePanel --type self-managed`, { encoding: 'utf8' }).trim();
}

/**
 * Blocks (up to waitSeconds) until the user claims the agent in their browser,
 * then enables + starts the systemd service so it uses the newly provisioned secret.
 */
function exchangeClaim(claimCode, waitSeconds = 120) {
  return new Promise((resolve, reject) => {
    const proc = spawn('playit', ['claim', 'exchange', claimCode, '--wait', String(waitSeconds)]);
    let output = '';
    proc.stdout.on('data', (chunk) => (output += chunk));
    proc.stderr.on('data', (chunk) => (output += chunk));
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`Claim exchange failed: ${output}`));
      try {
        execSync('sudo systemctl enable playit');
        execSync('sudo systemctl start playit');
      } catch (err) {
        return reject(new Error(`Claimed, but failed to start playit service: ${err.message}`));
      }
      resolve({ ok: true });
    });
  });
}

/**
 * Self-managed playit agents don't expose a tunnel-creation API over the local CLI;
 * tunnel-to-port mappings are configured on the playit.gg dashboard after claiming.
 * We poll `playit status` for an address associated with the server's local port.
 */
function findPublicAddressForPort(port) {
  const status = getStatus();
  const lines = status.split('\n');
  for (const line of lines) {
    if (line.includes(String(port)) && /[a-z0-9.-]+\.(playit\.gg|joinmc\.link)/i.test(line)) {
      const match = line.match(/([a-z0-9.-]+\.(playit\.gg|joinmc\.link)(:\d+)?)/i);
      if (match) return match[1];
    }
  }
  return null;
}

async function enableTunnel(serverId, port) {
  db.prepare('UPDATE servers SET playit_enabled = 1 WHERE id = ?').run(serverId);
  return { ok: true, dashboardUrl: 'https://playit.gg/account/tunnels', localPort: port };
}

function disableTunnel(serverId) {
  db.prepare('UPDATE servers SET playit_enabled = 0, playit_public_address = NULL WHERE id = ?').run(serverId);
  return { ok: true };
}

function pollTunnelAddresses(io) {
  const servers = db.prepare('SELECT * FROM servers WHERE playit_enabled = 1').all();
  for (const server of servers) {
    const address = findPublicAddressForPort(server.port);
    if (address && address !== server.playit_public_address) {
      db.prepare('UPDATE servers SET playit_public_address = ? WHERE id = ?').run(address, server.id);
      io.emit('tunnel:update', { serverId: server.id, address });
      if (server.discord_webhook_url) {
        require('./discordService').notify(server.id, 'tunnel_changed', `Tunnel address for "${server.name}" changed to ${address}`);
      }
    }
  }
}

function startTunnelPolling(io) {
  setInterval(() => {
    try {
      pollTunnelAddresses(io);
    } catch (err) {
      // playit may be mid-reconnect; skip this cycle.
    }
  }, 30 * 1000);
}

module.exports = {
  isInstalled,
  getStatus,
  generateClaimCode,
  getClaimUrl,
  exchangeClaim,
  enableTunnel,
  disableTunnel,
  startTunnelPolling
};
