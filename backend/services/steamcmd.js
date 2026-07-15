const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const STEAMCMD_PATH = process.env.STEAMCMD_PATH || '/usr/games/steamcmd';
const CACHE_DIR = process.env.FORGE_STEAMCMD_CACHE || path.join(__dirname, '..', '..', 'steamcmd_cache');

function run(args, onLine) {
  return new Promise((resolve, reject) => {
    const proc = spawn(STEAMCMD_PATH, args, { env: { ...process.env, HOME: CACHE_DIR } });
    let output = '';

    proc.stdout.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      output += text;
      if (onLine) text.split('\n').filter(Boolean).forEach(onLine);
    });
    proc.stderr.on('data', (chunk) => {
      output += chunk.toString('utf8');
    });

    proc.on('close', (code) => {
      if (code !== 0 && code !== 7) {
        return reject(new Error(`steamcmd exited with code ${code}: ${output.slice(-500)}`));
      }
      resolve(output);
    });
    proc.on('error', reject);
  });
}

async function installServer(appid, forceInstallDir, onLine, betaId) {
  const args = [
    '+force_install_dir', forceInstallDir,
    '+login', 'anonymous',
    '+app_update', String(appid)
  ];
  if (betaId) args.push('-beta', betaId);
  args.push('validate', '+quit');

  return run(args, onLine);
}

async function downloadWorkshopItem(appid, workshopItemId, onLine) {
  await run(['+login', 'anonymous', '+workshop_download_item', String(appid), String(workshopItemId), '+quit'], onLine);
  const contentDir = path.join(CACHE_DIR, 'steamapps', 'workshop', 'content', String(appid), String(workshopItemId));
  if (!fs.existsSync(contentDir)) {
    throw new Error(`Workshop item ${workshopItemId} downloaded but content directory not found at ${contentDir}`);
  }
  return contentDir;
}

module.exports = { installServer, downloadWorkshopItem, STEAMCMD_PATH, CACHE_DIR };
