const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const archiver = require('archiver');
const db = require('../db/db');
const { requireAuth, requirePermission } = require('../auth');
const { resolveSafePath } = require('../services/pathSafety');
const { backupBeforeSave } = require('../services/configBackupService');
const { logActivity } = require('../services/activityService');

const router = express.Router({ mergeParams: true });

const DATA_ROOT = process.env.FORGE_DATA_PATH || path.join(__dirname, '..', '..', 'servers');
const DISK_UPLOAD_BLOCK_PERCENT = 95;

function dataDirFor(serverId) {
  return path.join(DATA_ROOT, serverId, 'data');
}

function getServerOr404(req, res) {
  const row = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!row) {
    res.status(404).json({ error: 'Server not found' });
    return null;
  }
  return row;
}

const upload = multer({ dest: path.join(require('os').tmpdir(), 'forgepanel-uploads') });

router.get('/', requireAuth, requirePermission('file_read'), (req, res) => {
  const server = getServerOr404(req, res);
  if (!server) return;

  try {
    const target = resolveSafePath(dataDirFor(server.id), req.query.path || '');
    const entries = fs.readdirSync(target, { withFileTypes: true }).map((entry) => {
      const stat = fs.statSync(path.join(target, entry.name));
      return {
        name: entry.name,
        isDirectory: entry.isDirectory(),
        sizeBytes: stat.size,
        modifiedAt: stat.mtime.toISOString()
      };
    });
    res.json({ path: req.query.path || '', entries });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/content', requireAuth, requirePermission('file_read'), (req, res) => {
  const server = getServerOr404(req, res);
  if (!server) return;

  try {
    const target = resolveSafePath(dataDirFor(server.id), req.query.path || '');
    if (fs.statSync(target).isDirectory()) {
      return res.status(400).json({ error: 'Cannot read a directory as a file' });
    }
    res.json({ path: req.query.path, content: fs.readFileSync(target, 'utf8') });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/content', requireAuth, requirePermission('file_write'), (req, res) => {
  const server = getServerOr404(req, res);
  if (!server) return;

  const { path: relPath, content } = req.body || {};
  try {
    const target = resolveSafePath(dataDirFor(server.id), relPath || '');
    backupBeforeSave(target);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content ?? '');
    logActivity(server.id, 'file_saved', `Saved ${relPath}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/upload', requireAuth, requirePermission('file_write'), upload.single('file'), (req, res) => {
  const server = getServerOr404(req, res);
  if (!server) {
    if (req.file) fs.unlinkSync(req.file.path);
    return;
  }

  try {
    const { diskPercent } = require('../services/resourceService');
    const usedPercent = diskPercent(dataDirFor(server.id), server.disk_limit_gb);
    if (usedPercent >= DISK_UPLOAD_BLOCK_PERCENT) {
      fs.unlinkSync(req.file.path);
      return res.status(413).json({ error: `Disk usage at ${usedPercent}%, uploads blocked at ${DISK_UPLOAD_BLOCK_PERCENT}%` });
    }

    const destRelPath = path.join(req.query.path || '', req.file.originalname);
    const dest = resolveSafePath(dataDirFor(server.id), destRelPath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(req.file.path, dest);
    logActivity(server.id, 'file_uploaded', `Uploaded ${destRelPath}`);
    res.json({ ok: true, path: destRelPath });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(400).json({ error: err.message });
  }
});

router.get('/download', requireAuth, requirePermission('file_read'), (req, res) => {
  const server = getServerOr404(req, res);
  if (!server) return;

  try {
    const target = resolveSafePath(dataDirFor(server.id), req.query.path || '');
    const stat = fs.statSync(target);

    if (stat.isDirectory()) {
      res.attachment(`${path.basename(target)}.zip`);
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(res);
      archive.directory(target, false);
      archive.finalize();
    } else {
      res.download(target);
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/', requireAuth, requirePermission('file_write'), (req, res) => {
  const server = getServerOr404(req, res);
  if (!server) return;

  try {
    const target = resolveSafePath(dataDirFor(server.id), req.query.path || '');
    fs.rmSync(target, { recursive: true, force: true });
    logActivity(server.id, 'file_deleted', `Deleted ${req.query.path}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
