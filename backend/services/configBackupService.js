const fs = require('fs');
const path = require('path');

const MAX_VERSIONS = 5;

function backupBeforeSave(filePath) {
  if (!fs.existsSync(filePath)) return;

  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const backupDir = path.join(dir, '.forgepanel_backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `${base}.${timestamp}.bak`);
  fs.copyFileSync(filePath, backupPath);

  const existing = fs.readdirSync(backupDir)
    .filter((f) => f.startsWith(`${base}.`) && f.endsWith('.bak'))
    .sort()
    .reverse();

  for (const stale of existing.slice(MAX_VERSIONS)) {
    fs.unlinkSync(path.join(backupDir, stale));
  }
}

module.exports = { backupBeforeSave };
