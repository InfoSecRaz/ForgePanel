const cron = require('node-cron');
const parser = require('cron-parser');
const db = require('../db/db');
const dockerService = require('./dockerService');
const { logActivity } = require('./activityService');
const { notify } = require('./discordService');

const jobs = new Map();
const warningTimers = new Map();

const RESTART_WARNING_OFFSETS_MIN = [10, 5, 1];

function clearWarnings(taskId) {
  const timers = warningTimers.get(taskId) || [];
  timers.forEach(clearTimeout);
  warningTimers.delete(taskId);
}

function scheduleRestartWarnings(task, server) {
  clearWarnings(task.id);
  try {
    const interval = parser.parseExpression(task.cron_expression);
    const nextRun = interval.next().toDate();
    const timers = [];

    for (const minutesBefore of RESTART_WARNING_OFFSETS_MIN) {
      const fireAt = nextRun.getTime() - minutesBefore * 60 * 1000;
      const delay = fireAt - Date.now();
      if (delay <= 0) continue;

      timers.push(setTimeout(async () => {
        const message = `Server restarting in ${minutesBefore} minute${minutesBefore === 1 ? '' : 's'}`;
        try {
          if (server.container_id) await dockerService.sendCommand(server.container_id, `say ${message}`);
        } catch (err) {
          // Server may be offline or not accept stdin "say"; the Discord notification below still goes out.
        }
        notify(server.id, 'restart_warning', message);
      }, delay));
    }

    warningTimers.set(task.id, timers);
  } catch (err) {
    console.error(`Failed to schedule restart warnings for task ${task.id}:`, err.message);
  }
}

async function executeTask(task) {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(task.server_id);
  if (!server) return;

  const payload = task.payload ? JSON.parse(task.payload) : {};

  try {
    switch (task.type) {
      case 'restart':
        await dockerService.restartContainer(server.container_id);
        logActivity(server.id, 'scheduled_restart', `Scheduled restart: ${task.name}`);
        break;
      case 'backup': {
        const { backupServer } = require('./backupService');
        await backupServer(server.id);
        logActivity(server.id, 'scheduled_backup', `Scheduled backup: ${task.name}`);
        break;
      }
      case 'command':
        if (server.container_id && payload.command) {
          await dockerService.sendCommand(server.container_id, payload.command);
        }
        logActivity(server.id, 'scheduled_command', `Scheduled command: ${payload.command}`);
        break;
      case 'update_check': {
        const { checkForUpdates } = require('./modUpdateChecker');
        await checkForUpdates(server.id);
        break;
      }
      default:
        console.error(`Unknown scheduled task type: ${task.type}`);
    }

    db.prepare("UPDATE scheduled_tasks SET last_run = datetime('now') WHERE id = ?").run(task.id);
  } catch (err) {
    logActivity(server.id, 'scheduled_task_failed', `Task "${task.name}" failed: ${err.message}`);
  }

  if (task.type === 'restart') scheduleRestartWarnings(task, server);
}

function unscheduleTask(taskId) {
  const job = jobs.get(taskId);
  if (job) {
    job.stop();
    jobs.delete(taskId);
  }
  clearWarnings(taskId);
}

function scheduleTask(task) {
  unscheduleTask(task.id);
  if (!task.enabled) return;

  const job = cron.schedule(task.cron_expression, () => executeTask(task));
  jobs.set(task.id, job);

  if (task.type === 'restart') {
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(task.server_id);
    if (server) scheduleRestartWarnings(task, server);
  }
}

function loadAllTasks() {
  const tasks = db.prepare('SELECT * FROM scheduled_tasks WHERE enabled = 1').all();
  tasks.forEach(scheduleTask);
}

module.exports = { scheduleTask, unscheduleTask, loadAllTasks };
