require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const { sessionMiddleware, requireAuth } = require('./auth');
const { attachIo, logActivity } = require('./services/activityService');
const { InstallService } = require('./services/installService');
const dockerService = require('./services/dockerService');
const playerService = require('./services/playerService');
const stateWatcher = require('./services/stateWatcher');
const resourceService = require('./services/resourceService');
const playitService = require('./services/playitService');
const schedulerService = require('./services/schedulerService');
const modUpdateChecker = require('./services/modUpdateChecker');
const discordService = require('./services/discordService');
const sftpService = require('./services/sftpService');
const { getTemplate } = require('./templates/registry');

const authRoutes = require('./routes/auth');
const serverRoutes = require('./routes/servers');
const fileRoutes = require('./routes/files');
const workshopRoutes = require('./routes/workshop');
const workshopGlobalRoutes = require('./routes/workshopGlobal');
const configRoutes = require('./routes/config');
const resourceRoutes = require('./routes/resources');
const tunnelRoutes = require('./routes/tunnel');
const backupRoutes = require('./routes/backups');
const taskRoutes = require('./routes/tasks');
const discordRoutes = require('./routes/discord');
const playerRoutes = require('./routes/players');
const userRoutes = require('./routes/users');
const settingsRoutes = require('./routes/settings');
const templateRoutes = require('./routes/templates');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });

const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(sessionMiddleware());
app.use(express.static(path.join(__dirname, 'public')));

app.locals.io = io;
app.locals.installService = new InstallService(io);

attachIo(io);

app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/servers/:id/files', fileRoutes);
app.use('/api/servers/:id/workshop', workshopRoutes);
app.use('/api/servers/:id/config', configRoutes);
app.use('/api/servers/:id/resources', resourceRoutes);
app.use('/api/servers/:id/tunnel', tunnelRoutes);
app.use('/api/servers/:id/backups', backupRoutes);
app.use('/api/servers/:id/tasks', taskRoutes);
app.use('/api/servers/:id/players', playerRoutes);
app.use('/api/workshop', workshopGlobalRoutes);
app.use('/api/discord', discordRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/templates', templateRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) res.status(200).send('ForgePanel backend is running. Frontend build not present yet.');
  });
});

io.use((socket, next) => {
  sessionMiddleware()(socket.request, {}, next);
});

const activeLogStreams = new Map();

async function ensureLogStream(serverId) {
  if (activeLogStreams.has(serverId)) return;

  const db = require('./db/db');
  const row = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
  if (!row || !row.container_id) return;
  const template = getTemplate(row.game_id);

  try {
    const stream = await dockerService.streamLogs(row.container_id, (line) => {
      io.to(`console:${serverId}`).emit('console:output', { serverId, line, timestamp: Date.now() });
      if (template) {
        stateWatcher.checkReadyPattern(db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId), template, line, io);
        playerService.processLine(template, serverId, line, io);
      }
    });
    activeLogStreams.set(serverId, stream);
    stream.on('end', () => activeLogStreams.delete(serverId));
    stream.on('error', () => activeLogStreams.delete(serverId));
  } catch (err) {
    console.error(`Failed to stream logs for ${serverId}:`, err.message);
  }
}

// Log streams stay open for the lifetime of the container (needed for player/ready-state
// detection even with no console viewers) and are cleaned up by the stream's own 'end' event
// when the container stops, not by socket room membership.

// If the backend process restarts (deploy, crash, manual `systemctl restart`) while a
// container is already running, the docker 'start' event that would normally trigger
// ensureLogStream() via stateWatcher.attachStartHandler() has already fired and is gone —
// docker only emits it once, at the moment the container actually starts. Without this
// reconciliation pass, any server that was mid-boot (state = 'starting') at the moment the
// panel restarted would stay stuck in "starting" forever: nothing re-attaches its log
// stream, so checkReadyPattern() never runs again and the ready-state line the game server
// already printed (or is about to print) is never observed. Servers that had already
// finished booting (state = 'running') have the same problem for player join/leave
// tracking, which also depends on the log stream being attached.
async function reconcileServerStates() {
  const db = require('./db/db');
  // 'restarting' is included alongside 'starting'/'running': if the panel restarts while
  // a server is mid-restart, the same missed-'start'-event problem applies (see the
  // 'restarting' handling in stateWatcher.watchDockerEvents for the live-process case).
  const rows = db.prepare("SELECT * FROM servers WHERE state IN ('starting', 'running', 'restarting') AND container_id IS NOT NULL").all();

  for (const row of rows) {
    try {
      const info = await dockerService.inspectContainer(row.container_id);
      if (info.State && info.State.Running) {
        if (row.state === 'restarting') stateWatcher.setState(row.id, 'starting', io);
        await ensureLogStream(row.id);
      } else {
        // Container isn't actually running (e.g. it crashed or was stopped externally
        // while the panel was down) — the DB state is stale, so correct it rather than
        // leaving the UI showing "starting"/"running" for a dead container.
        stateWatcher.setState(row.id, 'crashed', io);
        logActivity(row.id, 'server_crashed', 'Server was not running on panel startup');
      }
    } catch (err) {
      // inspectContainer throws if the container no longer exists at all.
      stateWatcher.setState(row.id, 'crashed', io);
      logActivity(row.id, 'server_crashed', 'Container missing on panel startup');
    }
  }
}

io.on('connection', (socket) => {
  const joinedServers = new Set();

  socket.on('console:join', async ({ serverId }) => {
    joinedServers.add(serverId);
    socket.join(`console:${serverId}`);
    await ensureLogStream(serverId);
  });

  socket.on('console:leave', ({ serverId }) => {
    joinedServers.delete(serverId);
    socket.leave(`console:${serverId}`);
  });

  socket.on('disconnect', () => {
    joinedServers.clear();
  });

  socket.on('console:input', async ({ serverId, command }) => {
    const db = require('./db/db');
    const row = db.prepare('SELECT container_id FROM servers WHERE id = ?').get(serverId);
    if (row && row.container_id) {
      try {
        await dockerService.sendCommand(row.container_id, command);
      } catch (err) {
        socket.emit('console:output', { serverId, line: `[ForgePanel] Failed to send command: ${err.message}`, timestamp: Date.now() });
      }
    }
  });
});

async function start() {
  await dockerService.ensureNetwork();

  stateWatcher.attachStartHandler(ensureLogStream);
  stateWatcher.watchDockerEvents(io);
  await reconcileServerStates();
  resourceService.startMonitoring(io);
  playitService.startTunnelPolling(io);
  schedulerService.loadAllTasks();
  modUpdateChecker.startPeriodicCheck();
  discordService.initBot();

  try {
    sftpService.start();
  } catch (err) {
    console.error('Failed to start SFTP server:', err.message);
  }

  server.listen(PORT, () => {
    console.log(`ForgePanel backend listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start ForgePanel backend:', err);
  process.exit(1);
});

module.exports = { app, server, io };
