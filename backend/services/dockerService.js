const Docker = require('dockerode');

const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });

const NETWORK_NAME = 'forgepanel-net';
const CONTAINER_PREFIX = 'fp-';

function containerName(serverId) {
  return `${CONTAINER_PREFIX}${serverId}`;
}

async function ensureNetwork() {
  const networks = await docker.listNetworks({ filters: { name: [NETWORK_NAME] } });
  const exact = networks.find((n) => n.Name === NETWORK_NAME);
  if (exact) return exact;
  return docker.createNetwork({ Name: NETWORK_NAME, Driver: 'bridge' });
}

async function isForgepanelContainer(containerId) {
  const info = await docker.getContainer(containerId).inspect();
  return info.Config.Labels && info.Config.Labels.forgepanel === 'true';
}

async function portInUse(hostPort) {
  const containers = await docker.listContainers({ all: true });
  return containers.some((c) =>
    (c.Ports || []).some((p) => p.PublicPort === Number(hostPort))
  );
}

async function createServerContainer({ serverId, gameId, image, envVars, portBindings, ramLimitMb, cpuLimitPercent, dataPath, modsPath }) {
  await ensureNetwork();

  const exposedPorts = {};
  const hostBindings = {};
  for (const [containerPort, hostPort] of Object.entries(portBindings)) {
    exposedPorts[containerPort] = {};
    hostBindings[containerPort] = [{ HostPort: String(hostPort) }];
  }

  const container = await docker.createContainer({
    name: containerName(serverId),
    Image: image,
    // Run as the host UID/GID that owns the bind-mounted data volume so both the game
    // process and the panel's own file manager/SFTP can read and write the same files.
    User: process.getuid ? `${process.getuid()}:${process.getgid()}` : undefined,
    Env: Object.entries(envVars || {}).map(([k, v]) => `${k}=${v}`),
    ExposedPorts: exposedPorts,
    Labels: {
      forgepanel: 'true',
      'forgepanel.server_id': serverId,
      'forgepanel.game': gameId
    },
    HostConfig: {
      Memory: ramLimitMb ? ramLimitMb * 1024 * 1024 : undefined,
      MemorySwap: ramLimitMb ? ramLimitMb * 1024 * 1024 : undefined,
      NanoCpus: cpuLimitPercent ? Math.round((cpuLimitPercent / 100) * 1e9) : undefined,
      PortBindings: hostBindings,
      Binds: [
        `${dataPath}:/server/data`,
        `${modsPath}:/server/mods`,
        `${process.env.FORGE_STEAMCMD_CACHE}:/steamcmd_cache`
      ],
      RestartPolicy: { Name: 'no' }
    },
    NetworkingConfig: {
      EndpointsConfig: { [NETWORK_NAME]: {} }
    }
  });

  return container;
}

async function startContainer(containerId) {
  const container = docker.getContainer(containerId);
  await container.start();
  return container.inspect();
}

async function stopContainer(containerId, timeoutSec = 30) {
  const container = docker.getContainer(containerId);
  await container.stop({ t: timeoutSec });
  return container.inspect();
}

async function restartContainer(containerId, timeoutSec = 30) {
  const container = docker.getContainer(containerId);
  await container.restart({ t: timeoutSec });
  return container.inspect();
}

async function removeContainer(containerId) {
  const container = docker.getContainer(containerId);
  await container.remove({ force: true });
}

async function inspectContainer(containerId) {
  return docker.getContainer(containerId).inspect();
}

async function getStats(containerId) {
  const container = docker.getContainer(containerId);
  const stats = await container.stats({ stream: false });

  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * (stats.cpu_stats.online_cpus || 1) * 100 : 0;

  const ramMb = stats.memory_stats.usage ? stats.memory_stats.usage / (1024 * 1024) : 0;

  let rx = 0;
  let tx = 0;
  if (stats.networks) {
    for (const iface of Object.values(stats.networks)) {
      rx += iface.rx_bytes || 0;
      tx += iface.tx_bytes || 0;
    }
  }

  return {
    cpuPercent: Math.round(cpuPercent * 10) / 10,
    ramMb: Math.round(ramMb),
    networkRxMb: Math.round((rx / (1024 * 1024)) * 10) / 10,
    networkTxMb: Math.round((tx / (1024 * 1024)) * 10) / 10
  };
}

async function streamLogs(containerId, onLine) {
  const container = docker.getContainer(containerId);
  const stream = await container.logs({ follow: true, stdout: true, stderr: true, tail: 500, timestamps: false });

  docker.modem.demuxStream(
    stream,
    { write: (chunk) => onLine(chunk.toString('utf8')) },
    { write: (chunk) => onLine(chunk.toString('utf8')) }
  );

  return stream;
}

async function sendCommand(containerId, command) {
  const container = docker.getContainer(containerId);
  const stream = await container.attach({ stream: true, stdin: true });
  stream.write(`${command}\n`);
}

module.exports = {
  docker,
  NETWORK_NAME,
  CONTAINER_PREFIX,
  containerName,
  ensureNetwork,
  isForgepanelContainer,
  portInUse,
  createServerContainer,
  startContainer,
  stopContainer,
  restartContainer,
  removeContainer,
  inspectContainer,
  getStats,
  streamLogs,
  sendCommand
};
