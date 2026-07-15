const path = require('path');
const fs = require('fs');
const tar = require('fs');
const { docker, createServerContainer } = require('./dockerService');
const db = require('../db/db');
const { logActivity } = require('./activityService');
const { renderConfig } = require('./configService');

const DATA_ROOT = process.env.FORGE_DATA_PATH || path.join(__dirname, '..', '..', 'servers');

function emitProgress(io, serverId, line, phase, current, total) {
  io.emit('install:progress', { serverId, line, phase, current, total });
}

async function imageExists(imageTag) {
  const images = await docker.listImages();
  return images.some((img) => (img.RepoTags || []).includes(imageTag));
}

async function buildImage(io, serverId, template) {
  const imageTag = `forgepanel/${template.id}:latest`;
  if (await imageExists(imageTag)) return imageTag;

  emitProgress(io, serverId, `Building image ${imageTag}...`, 'build', 0, 1);
  const contextPath = template.dir;

  const stream = await docker.buildImage(
    { context: contextPath, src: fs.readdirSync(contextPath) },
    { t: imageTag }
  );

  await new Promise((resolve, reject) => {
    docker.modem.followProgress(
      stream,
      (err, res) => (err ? reject(err) : resolve(res)),
      (event) => {
        if (event.stream) emitProgress(io, serverId, event.stream.trim(), 'build');
      }
    );
  });

  return imageTag;
}

async function runInstallContainer(io, serverId, template, dataPath) {
  emitProgress(io, serverId, 'Starting install container...', 'download', 0, 1);

  const env = [
    `STEAMCMD_APPID=${template.appid || ''}`,
    'STEAM_USER=anonymous',
    `HOST_UID=${process.getuid ? process.getuid() : 1000}`,
    `HOST_GID=${process.getgid ? process.getgid() : 1000}`
  ];

  const container = await docker.createContainer({
    Image: `forgepanel/${template.id}:latest`,
    Env: env,
    Cmd: ['--install-only'],
    HostConfig: {
      Binds: [
        `${dataPath}:/server/data`,
        `${process.env.FORGE_STEAMCMD_CACHE}:/steamcmd_cache`
      ],
      AutoRemove: false
    }
  });

  await container.start();

  const logStream = await container.logs({ follow: true, stdout: true, stderr: true });
  await new Promise((resolve) => {
    docker.modem.demuxStream(
      logStream,
      { write: (chunk) => emitProgress(io, serverId, chunk.toString('utf8').trim(), 'download') },
      { write: (chunk) => emitProgress(io, serverId, chunk.toString('utf8').trim(), 'download') }
    );
    logStream.on('end', resolve);
  });

  const result = await container.wait();
  await container.remove();

  if (result.StatusCode !== 0) {
    throw new Error(`Install container exited with code ${result.StatusCode}`);
  }
}

function copyDefaultConfig(template, dataPath) {
  const defaultConfigDir = path.join(template.dir, 'default_config');
  if (!fs.existsSync(defaultConfigDir)) return;

  fs.cpSync(defaultConfigDir, dataPath, { recursive: true, force: false });
}

async function install(serverId, template, fields, io) {
  const dataPath = path.join(DATA_ROOT, serverId, 'data');
  const modsPath = path.join(DATA_ROOT, serverId, 'mods');

  try {
    await buildImage(io, serverId, template);
    copyDefaultConfig(template, dataPath);
    await runInstallContainer(io, serverId, template, dataPath);

    if (template.id === 'minecraft_java' || template.id === 'minecraft_bedrock') {
      fs.writeFileSync(path.join(dataPath, 'eula.txt'), 'eula=true\n');
    }

    renderConfig(template, dataPath, fields);

    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
    const portBindings = {};
    (template.ports || []).forEach((entry, idx) => {
      const containerPort = entry.port;
      const protocol = entry.protocol || 'tcp';
      const isPrimary = entry.primary || idx === 0;
      const isQuery = containerPort === template.queryPort;
      const hostPort = isPrimary ? server.port : (isQuery ? server.query_port : containerPort);
      portBindings[`${containerPort}/${protocol}`] = hostPort;
    });

    const container = await createServerContainer({
      serverId,
      gameId: template.id,
      image: `forgepanel/${template.id}:latest`,
      envVars: fields,
      portBindings,
      ramLimitMb: server.ram_limit_mb,
      cpuLimitPercent: server.cpu_limit_percent,
      dataPath,
      modsPath
    });

    db.prepare("UPDATE servers SET state = 'stopped', container_id = ? WHERE id = ?").run(container.id, serverId);
    logActivity(serverId, 'install_complete', `Server installed from template ${template.id}`);
    io.emit('install:done', { serverId, success: true });
  } catch (err) {
    db.prepare("UPDATE servers SET state = 'stopped' WHERE id = ?").run(serverId);
    logActivity(serverId, 'install_failed', err.message);
    io.emit('install:done', { serverId, success: false, error: err.message });
    throw err;
  }
}

class InstallService {
  constructor(io) {
    this.io = io;
  }

  install(serverId, template, fields) {
    return install(serverId, template, fields, this.io);
  }
}

module.exports = { InstallService };
