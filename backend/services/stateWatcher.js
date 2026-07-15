const db = require('../db/db');
const dockerService = require('./dockerService');
const { logActivity } = require('./activityService');
const { notify } = require('./discordService');

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
  if (server.state !== 'starting' || !template.readyPattern) return;
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
        console.error('Failed to attach to Docker events stream:', err.message);
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
            if (server && onContainerStart) onContainerStart(server.id);
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
