const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/db');
const dockerService = require('./dockerService');
const { getTemplate } = require('../templates/registry');
const { logActivity } = require('./activityService');
const { getTier } = require('./resourceService');

const DATA_ROOT = process.env.FORGE_DATA_PATH || path.join(__dirname, '..', '..', 'servers');
const BACKUP_ROOT = process.env.FORGE_BACKUP_PATH || path.join(__dirname, '..', '..', 'backups');

function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

async function preBackupSave(server) {
  const template = getTemplate(server.game_id);
  if (!template || !template.saveCommand || !server.container_id || server.state !== 'running') return;
  try {
    await dockerService.sendCommand(server.container_id, template.saveCommand);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  } catch (err) {
    // Save command may not be supported while stopped or offline; proceed with backup regardless.
  }
}

async function uploadToS3(localPath, filename) {
  const storageType = getSetting('backup_storage_type', 'local');
  if (storageType === 'local' || getTier() !== 'pro') return null;

  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
  const client = new S3Client({
    endpoint: getSetting('s3_endpoint'),
    region: getSetting('s3_region', 'us-east-1'),
    credentials: {
      accessKeyId: getSetting('s3_access_key'),
      secretAccessKey: getSetting('s3_secret_key')
    },
    forcePathStyle: true
  });

  const bucket = getSetting('s3_bucket');
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: filename,
    Body: fs.createReadStream(localPath)
  }));

  return `${getSetting('s3_endpoint')}/${bucket}/${filename}`;
}

async function backupServer(serverId) {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
  if (!server) throw new Error('Server not found');

  await preBackupSave(server);

  const dataDir = path.join(DATA_ROOT, serverId, 'data');
  const backupDir = path.join(BACKUP_ROOT, serverId);
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${server.name.replace(/[^a-z0-9_-]/gi, '_')}_${timestamp}.tar.gz`;
  const backupPath = path.join(backupDir, filename);

  execSync(`tar czf "${backupPath}" -C "${dataDir}" .`);

  const sizeBytes = fs.statSync(backupPath).size;
  const storageUrl = await uploadToS3(backupPath, filename).catch((err) => {
    console.error(`S3 backup upload failed for ${serverId}:`, err.message);
    return null;
  });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO backups (id, server_id, filename, path, size_bytes, storage_type, storage_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, serverId, filename, backupPath, sizeBytes, storageUrl ? 's3' : 'local', storageUrl);

  logActivity(serverId, 'backup_created', `Backup created: ${filename}`);
  enforceRetention(serverId);

  return db.prepare('SELECT * FROM backups WHERE id = ?').get(id);
}

function enforceRetention(serverId) {
  const retentionCount = parseInt(getSetting('backup_retention_count', '10'), 10);
  const backups = db.prepare('SELECT * FROM backups WHERE server_id = ? ORDER BY created_at DESC').all(serverId);

  for (const stale of backups.slice(retentionCount)) {
    try {
      if (fs.existsSync(stale.path)) fs.unlinkSync(stale.path);
    } catch (err) {
      // Local file already removed; still clean up the DB row below.
    }
    db.prepare('DELETE FROM backups WHERE id = ?').run(stale.id);
  }
}

async function restoreBackup(serverId, backupId) {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
  const backup = db.prepare('SELECT * FROM backups WHERE id = ? AND server_id = ?').get(backupId, serverId);
  if (!server || !backup) throw new Error('Server or backup not found');
  if (server.state !== 'stopped') throw new Error('Server must be stopped before restoring a backup');
  if (!fs.existsSync(backup.path)) throw new Error('Backup file not found on disk');

  const dataDir = path.join(DATA_ROOT, serverId, 'data');
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });

  execSync(`tar xzf "${backup.path}" -C "${dataDir}"`);
  logActivity(serverId, 'backup_restored', `Restored backup: ${backup.filename}`);
}

function deleteBackup(serverId, backupId) {
  const backup = db.prepare('SELECT * FROM backups WHERE id = ? AND server_id = ?').get(backupId, serverId);
  if (!backup) throw new Error('Backup not found');
  if (fs.existsSync(backup.path)) fs.unlinkSync(backup.path);
  db.prepare('DELETE FROM backups WHERE id = ?').run(backupId);
}

module.exports = { backupServer, restoreBackup, deleteBackup, enforceRetention };
