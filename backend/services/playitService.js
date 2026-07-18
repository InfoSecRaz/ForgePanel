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

async function enableTunnel(serverId, port) {
  db.prepare('UPDATE servers SET playit_enabled = 1 WHERE id = ?').run(serverId);
  return { ok: true, dashboardUrl: 'https://playit.gg/account/tunnels', localPort: port };
}

function disableTunnel(serverId) {
  db.prepare('UPDATE servers SET playit_enabled = 0, playit_public_address = NULL WHERE id = ?').run(serverId);
  return { ok: true };
}

// Self-managed playit agents (this CLI's --systemd mode, version 1.0.9 as installed) have no
// local way to enumerate assigned tunnel addresses: `playit status` doesn't list them, there's
// no --json flag, the account-level API keys page is empty on the free tier, and the daemon's
// local IPC socket uses an undocumented protocol that resets the connection on unrecognized
// requests (confirmed by direct probing, not just assumption). So unlike enable/disable, the
// address itself has to be entered by whoever set up the tunnel on playit.gg's own dashboard,
// same pattern as the Discord notification webhook elsewhere in this app. If playit ever adds
// a documented local query mechanism, this is the function to replace.
function setPublicAddress(serverId, address, io) {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
  if (!server) throw new Error('Server not found');

  const trimmed = (address || '').trim() || null;
  db.prepare('UPDATE servers SET playit_public_address = ? WHERE id = ?').run(trimmed, serverId);

  if (io) io.emit('tunnel:update', { serverId, address: trimmed });
  if (trimmed && server.discord_webhook_url) {
    require('./discordService').notify(serverId, 'tunnel_changed', `Tunnel address for "${server.name}" set to ${trimmed}`);
  }
  return { ok: true, address: trimmed };
}

module.exports = {
  isInstalled,
  getStatus,
  generateClaimCode,
  getClaimUrl,
  exchangeClaim,
  enableTunnel,
  disableTunnel,
  setPublicAddress
};
