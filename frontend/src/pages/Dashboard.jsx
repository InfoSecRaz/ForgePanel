import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import StatusBadge from '../components/StatusBadge';

function ResourceBar({ label, used, total, unit }) {
  const percent = total ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const color = percent < 70 ? 'bg-running' : percent < 90 ? 'bg-warning' : 'bg-stopped';
  return (
    <div>
      <div className="flex justify-between text-xs text-text-secondary mb-1">
        <span>{label}</span>
        <span>{used} / {total} {unit}</span>
      </div>
      <div className="h-2 bg-surface2 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [servers, setServers] = useState([]);
  const [host, setHost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/servers'), api.get('/settings/host')])
      .then(([serversData, hostData]) => {
        setServers(serversData);
        setHost(hostData);
      })
      .finally(() => setLoading(false));

    const socket = getSocket();
    const onStateChange = ({ serverId, state }) => {
      setServers((prev) => prev.map((s) => (s.id === serverId ? { ...s, state } : s)));
    };
    socket.on('state:change', onStateChange);
    return () => socket.off('state:change', onStateChange);
  }, []);

  if (loading) return <div className="p-6 text-text-secondary">Loading...</div>;

  const totalRam = servers.reduce((sum, s) => sum + (s.ram_limit_mb || 0), 0);
  const totalCpu = servers.reduce((sum, s) => sum + (s.cpu_limit_percent || 0), 0);
  const totalDisk = servers.reduce((sum, s) => sum + (s.disk_limit_gb || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <Link to="/templates" className="btn btn-primary">+ New Server</Link>
      </div>

      {host && (
        <div className="card p-4 grid grid-cols-3 gap-6">
          <ResourceBar label="RAM Allocated" used={totalRam} total={host.totalRamMb} unit="MB" />
          <ResourceBar label="CPU Allocated" used={totalCpu} total={host.cpuCores * 100} unit="%" />
          <ResourceBar label="Disk Allocated" used={totalDisk} total={host.totalDiskGb || 0} unit="GB" />
        </div>
      )}

      {servers.length === 0 ? (
        <div className="card p-10 text-center text-text-secondary">
          No servers yet. <Link to="/templates" className="text-info">Create one</Link> to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {servers.map((server) => (
            <Link key={server.id} to={`/servers/${server.id}`} className="card p-4 hover:border-info transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{server.name}</span>
                <StatusBadge state={server.state} />
              </div>
              <div className="text-sm text-text-secondary">{server.game_id}</div>
              <div className="text-xs text-text-secondary mt-2">
                {server.ram_limit_mb}MB RAM · {server.cpu_limit_percent}% CPU
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
