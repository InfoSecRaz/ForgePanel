const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ssh2 = require('ssh2');
const { STATUS_CODE, OPEN_MODE } = ssh2.utils.sftp;
const db = require('../db/db');
const { verifyPassword } = require('../auth');
const { resolveSafePath } = require('./pathSafety');
const { logActivity } = require('./activityService');

const DATA_ROOT = process.env.FORGE_DATA_PATH || path.join(__dirname, '..', '..', 'servers');
const KEYS_DIR = path.join(__dirname, '..', 'keys');
const HOST_KEY_PATH = path.join(KEYS_DIR, 'ssh_host_key');

function ensureHostKey() {
  fs.mkdirSync(KEYS_DIR, { recursive: true });
  if (!fs.existsSync(HOST_KEY_PATH)) {
    const { generateKeyPairSync } = crypto;
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
      publicKeyEncoding: { type: 'pkcs1', format: 'pem' }
    });
    fs.writeFileSync(HOST_KEY_PATH, privateKey, { mode: 0o600 });
  }
  return fs.readFileSync(HOST_KEY_PATH);
}

function resolveUserAndServer(username) {
  const lastDot = username.lastIndexOf('.');
  if (lastDot === -1) return null;
  const panelUsername = username.slice(0, lastDot);
  const shortId = username.slice(lastDot + 1);

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(panelUsername);
  if (!user) return null;

  const server = db.prepare('SELECT * FROM servers WHERE id LIKE ?').get(`${shortId}%`);
  if (!server) return null;

  if (!user.is_admin) {
    const perm = db.prepare('SELECT * FROM user_server_permissions WHERE user_id = ? AND server_id = ?').get(user.id, server.id);
    if (!perm || (!perm.file_read && !perm.file_write)) return null;
  }

  return { user, server };
}

function attrsFromStat(stat) {
  return {
    mode: stat.mode,
    uid: stat.uid || 0,
    gid: stat.gid || 0,
    size: stat.size,
    atime: Math.floor(stat.atimeMs / 1000),
    mtime: Math.floor(stat.mtimeMs / 1000)
  };
}

function bindSftpHandlers(sftpStream, rootDir, context) {
  const handles = new Map();
  let nextHandle = 0;

  function newHandle() {
    const id = Buffer.alloc(4);
    id.writeUInt32BE(nextHandle++, 0);
    return id;
  }

  function safe(reqid, relPath, fn) {
    try {
      const target = resolveSafePath(rootDir, relPath);
      fn(target);
    } catch (err) {
      sftpStream.status(reqid, STATUS_CODE.PERMISSION_DENIED);
    }
  }

  sftpStream.on('REALPATH', (reqid, reqPath) => {
    safe(reqid, reqPath, (target) => {
      const rel = path.relative(rootDir, target) || '.';
      sftpStream.name(reqid, [{ filename: '/' + rel.replace(/\\/g, '/'), longname: '/' + rel, attrs: {} }]);
    });
  });

  sftpStream.on('OPENDIR', (reqid, reqPath) => {
    safe(reqid, reqPath, (target) => {
      const entries = fs.readdirSync(target);
      const handle = newHandle();
      handles.set(handle.toString('hex'), { type: 'dir', target, entries, offset: 0 });
      sftpStream.handle(reqid, handle);
    });
  });

  sftpStream.on('READDIR', (reqid, handleBuf) => {
    const h = handles.get(handleBuf.toString('hex'));
    if (!h || h.type !== 'dir') return sftpStream.status(reqid, STATUS_CODE.FAILURE);
    if (h.offset >= h.entries.length) return sftpStream.status(reqid, STATUS_CODE.EOF);

    const batch = h.entries.slice(h.offset, h.offset + 100);
    h.offset += batch.length;

    const names = batch.map((name) => {
      const stat = fs.lstatSync(path.join(h.target, name));
      return { filename: name, longname: name, attrs: attrsFromStat(stat) };
    });
    sftpStream.name(reqid, names);
  });

  sftpStream.on('LSTAT', (reqid, reqPath) => {
    safe(reqid, reqPath, (target) => sftpStream.attrs(reqid, attrsFromStat(fs.lstatSync(target))));
  });

  sftpStream.on('FSTAT', (reqid, handleBuf) => {
    const h = handles.get(handleBuf.toString('hex'));
    if (!h) return sftpStream.status(reqid, STATUS_CODE.FAILURE);
    sftpStream.attrs(reqid, attrsFromStat(fs.fstatSync(h.fd)));
  });

  sftpStream.on('OPEN', (reqid, reqPath, flags) => {
    safe(reqid, reqPath, (target) => {
      const writing = flags & OPEN_MODE.WRITE || flags & OPEN_MODE.CREAT;
      if (writing && !context.canWrite) return sftpStream.status(reqid, STATUS_CODE.PERMISSION_DENIED);

      let nodeFlags = 'r';
      if (flags & OPEN_MODE.CREAT && flags & OPEN_MODE.TRUNC) nodeFlags = 'w';
      else if (flags & OPEN_MODE.CREAT) nodeFlags = 'a+';
      else if (flags & OPEN_MODE.WRITE) nodeFlags = 'r+';

      const fd = fs.openSync(target, nodeFlags);
      const handle = newHandle();
      handles.set(handle.toString('hex'), { type: 'file', fd, target });
      sftpStream.handle(reqid, handle);
    });
  });

  sftpStream.on('READ', (reqid, handleBuf, offset, length) => {
    const h = handles.get(handleBuf.toString('hex'));
    if (!h) return sftpStream.status(reqid, STATUS_CODE.FAILURE);
    const buffer = Buffer.alloc(length);
    const bytesRead = fs.readSync(h.fd, buffer, 0, length, offset);
    if (bytesRead === 0) return sftpStream.status(reqid, STATUS_CODE.EOF);
    sftpStream.data(reqid, buffer.slice(0, bytesRead));
  });

  sftpStream.on('WRITE', (reqid, handleBuf, offset, data) => {
    const h = handles.get(handleBuf.toString('hex'));
    if (!h) return sftpStream.status(reqid, STATUS_CODE.FAILURE);
    if (!context.canWrite) return sftpStream.status(reqid, STATUS_CODE.PERMISSION_DENIED);
    fs.writeSync(h.fd, data, 0, data.length, offset);
    sftpStream.status(reqid, STATUS_CODE.OK);
  });

  sftpStream.on('CLOSE', (reqid, handleBuf) => {
    const h = handles.get(handleBuf.toString('hex'));
    if (h && h.type === 'file') fs.closeSync(h.fd);
    handles.delete(handleBuf.toString('hex'));
    sftpStream.status(reqid, STATUS_CODE.OK);
  });

  sftpStream.on('MKDIR', (reqid, reqPath) => {
    if (!context.canWrite) return sftpStream.status(reqid, STATUS_CODE.PERMISSION_DENIED);
    safe(reqid, reqPath, (target) => {
      fs.mkdirSync(target, { recursive: true });
      sftpStream.status(reqid, STATUS_CODE.OK);
    });
  });

  sftpStream.on('RMDIR', (reqid, reqPath) => {
    if (!context.canWrite) return sftpStream.status(reqid, STATUS_CODE.PERMISSION_DENIED);
    safe(reqid, reqPath, (target) => {
      fs.rmdirSync(target);
      sftpStream.status(reqid, STATUS_CODE.OK);
    });
  });

  sftpStream.on('REMOVE', (reqid, reqPath) => {
    if (!context.canWrite) return sftpStream.status(reqid, STATUS_CODE.PERMISSION_DENIED);
    safe(reqid, reqPath, (target) => {
      fs.unlinkSync(target);
      logActivity(context.server.id, 'sftp_delete', `SFTP deleted ${reqPath} (user: ${context.user.username})`);
      sftpStream.status(reqid, STATUS_CODE.OK);
    });
  });

  sftpStream.on('RENAME', (reqid, oldPath, newPath) => {
    if (!context.canWrite) return sftpStream.status(reqid, STATUS_CODE.PERMISSION_DENIED);
    try {
      const from = resolveSafePath(rootDir, oldPath);
      const to = resolveSafePath(rootDir, newPath);
      fs.renameSync(from, to);
      logActivity(context.server.id, 'sftp_rename', `SFTP renamed ${oldPath} -> ${newPath} (user: ${context.user.username})`);
      sftpStream.status(reqid, STATUS_CODE.OK);
    } catch (err) {
      sftpStream.status(reqid, STATUS_CODE.FAILURE);
    }
  });

  sftpStream.on('SETSTAT', (reqid) => sftpStream.status(reqid, STATUS_CODE.OK));
}

function start() {
  const hostKey = ensureHostKey();
  const port = process.env.SFTP_PORT || 2022;

  const server = new ssh2.Server({ hostKeys: [hostKey] }, (client) => {
    let resolved = null;

    client.on('authentication', (ctx) => {
      if (ctx.method !== 'password') return ctx.reject(['password']);

      const match = resolveUserAndServer(ctx.username);
      if (!match || !verifyPassword(ctx.password, match.user.password_hash)) {
        return ctx.reject(['password']);
      }

      resolved = match;
      ctx.accept();
    });

    client.on('ready', () => {
      client.on('session', (accept) => {
        const session = accept();
        session.on('sftp', (accept2) => {
          const sftpStream = accept2();
          const rootDir = path.join(DATA_ROOT, resolved.server.id, 'data');
          const canWrite = resolved.user.is_admin ||
            !!(db.prepare('SELECT file_write FROM user_server_permissions WHERE user_id = ? AND server_id = ?')
              .get(resolved.user.id, resolved.server.id) || {}).file_write;

          logActivity(resolved.server.id, 'sftp_connect', `SFTP session opened by ${resolved.user.username}`);
          bindSftpHandlers(sftpStream, rootDir, { user: resolved.user, server: resolved.server, canWrite });
        });
      });
    });
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`ForgePanel SFTP server listening on port ${port}`);
  });

  return server;
}

module.exports = { start };
