const db = require('../db/db');
const dockerService = require('./dockerService');
const { logActivity } = require('./activityService');
const { notify } = require('./discordService');
const logger = require('../logger');

function setState(serverId, state, io) {
  const row = db.prepare('SELECT state FROM servers WHERE id = ?').get(serverId);
  if (!row) return;
  const previous = row.state;
  if (previous === state) return;

  db.prepare("UPDATE servers SET state = ?, updated_at = datetime('now') WHERE id = ?").run(state, serverId);
  io.emit('state:change', { serverId, state, previous });
  return previous;
}

function checkReadyPattern(server, template, line, io) {
  if (!['starting', 'restarting'].includes(server.state) || !template.readyPattern) return;
  if (line.includes(template.readyPattern)) {
    setState(server.id, 'running', io);
    logActivity(server.id, 'server_started', 'Server reached ready state');
  }
}

async function handleContainerDie(containerId, io) {
  const server = db.prepare('SELECT * FROM servers WHERE container_id = ?').get(containerId);
  if (!server) return;

  if (server.state === 'stopping') {
    setState(server.id, 'stopped', io);
    logActivity(server.id, 'server_stopped', 'Server stopped cleanly');
    return;
  }

  if (server.state === 'running' || server.state === 'starting') {
    setState(server.id, 'crashed', io);
    logActivity(server.id, 'server_crashed', 'Server exited unexpectedly');
    notify(server.id, 'crashed', `Server "${server.name}" crashed`);

    if (server.auto_restart) {
      setTimeout(async () => {
        try {
          setState(server.id, 'starting', io);
          await dockerService.startContainer(containerId);
        } catch (err) {
          setState(server.id, 'crashed', io);
        }
      }, (server.auto_restart_delay || 10) * 1000);
    }
  }
}

let onContainerStart = null;

function attachStartHandler(fn) {
  onContainerStart = fn;
}

function watchDockerEvents(io) {
  dockerService.docker.getEvents(
    { filters: JSON.stringify({ label: ['forgepanel=true'], type: ['container'] }) },
    (err, stream) => {
      if (err) {
        logger.error({ err }, 'Failed to attach to Docker events stream');
        return;
      }
      stream.on('data', (chunk) => {
        try {
          const event = JSON.parse(chunk.toString('utf8'));
          const action = event.Action || event.status;
          const containerId = (event.Actor && event.Actor.ID) || event.id;
          if (action === 'die') handleContainerDie(containerId, io);
          if (action === 'start') {
            const server = db.prepare('SELECT * FROM servers WHERE container_id = ?').get(containerId);
            if (server) {
              // A container started outside the panel's own /start or /restart routes (manual
              // `docker start`, a host reboot, external tooling) never gets its DB state set to
              // 'starting', so checkReadyPattern's gate above would never open for it. Reconcile
              // here so the ready-pattern match still fires for these out-of-band starts.
              if (!['starting', 'restarting'].includes(server.state)) setState(server.id, 'starting', io);
              if (onContainerStart) onContainerStart(server.id);
            }
          }
        } catch (err) {
          // Ignore malformed or partial event chunks.
        }
      });
      stream.on('error', () => {
        setTimeout(() => watchDockerEvents(io), 5000);
      });
    }
  );
}

module.exports = { setState, checkReadyPattern, watchDockerEvents, attachStartHandler };
