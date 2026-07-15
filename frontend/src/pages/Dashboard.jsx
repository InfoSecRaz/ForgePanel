import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useToast } from '../lib/ToastContext';
import StatusBadge from '../components/StatusBadge';

function MiniBar({ percent, color }) {
  return (
    <div className="h-1 bg-hairline rounded-full overflow-hidden flex-1">
      <div className={`h-full ${color}`} style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

function ResourceBar({ label, used, total, unit }) {
  const percent = total ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const color = percent < 70 ? 'bg-running' : percent < 90 ? 'bg-warning' : 'bg-stopped';
  return (
    <div>
      <div className="flex justify-between text-label text-text-secondary mb-1">
        <span>{label}</span>
        <span>{used} / {total} {unit}</span>
      </div>
      <div className="h-2 bg-hairline rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-100`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function ServerCard({ server }) {
  const cpuPercent = server._cpu ?? 0;
  const ramPercent = server.ram_limit_mb ? Math.min(100, ((server._ram ?? 0) / server.ram_limit_mb) * 100) : 0;

  return (
    <Link
      to={`/servers/${server.id}`}
      className="card p-4 hover:border-hairline-strong hover:bg-surface2 transition-colors duration-100 flex flex-col gap-3"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-button bg-surface3 flex items-center justify-center text-[13px] text-text-secondary flex-shrink-0">
          {server.game_id.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] text-text-primary truncate" style={{ fontWeight: 590 }}>{server.name}</div>
          <div className="text-label text-text-muted truncate">{server.game_id}</div>
        </div>
        <StatusBadge state={server.state} />
      </div>
      <div className="flex items-center gap-3">
        <MiniBar percent={cpuPercent} color="bg-accent" />
        <span className="text-label text-text-muted w-8 text-right">{Math.round(cpuPercent)}%</span>
      </div>
      <div className="flex items-center gap-3">
        <MiniBar percent={ramPercent} color="bg-running" />
        <span className="text-label text-text-muted w-8 text-right">{Math.round(ramPercent)}%</span>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const [servers, setServers] = useState([]);
  const [host, setHost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const toast = useToast();

  useEffect(() => {
    Promise.all([api.get('/servers'), api.get('/settings/host')])
      .then(([serversData, hostData]) => {
        setServers(serversData);
        setHost(hostData);
      })
      .catch((err) => toast.error(`Failed to load dashboard: ${err.message}`))
      .finally(() => setLoading(false));

    const socket = getSocket();
    const onStateChange = ({ serverId, state }) => {
      setServers((prev) => prev.map((s) => (s.id === serverId ? { ...s, state } : s)));
    };
    const onStats = ({ serverId, cpu, ram }) => {
      setServers((prev) => prev.map((s) => (s.id === serverId ? { ...s, _cpu: cpu, _ram: ram } : s)));
    };
    socket.on('state:change', onStateChange);
    socket.on('stats:update', onStats);
    return () => {
      socket.off('state:change', onStateChange);
      socket.off('stats:update', onStats);
    };
  }, []);

  if (loading) return <div className="p-lg text-text-secondary text-[13px]">Loading...</div>;

  const totalRam = servers.reduce((sum, s) => sum + (s.ram_limit_mb || 0), 0);
  const totalCpu = servers.reduce((sum, s) => sum + (s.cpu_limit_percent || 0), 0);
  const totalDisk = servers.reduce((sum, s) => sum + (s.disk_limit_gb || 0), 0);

  const filtered = query
    ? servers.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()) || s.game_id.toLowerCase().includes(query.toLowerCase()))
    : servers;

  return (
    <div className="p-lg space-y-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title text-text-primary">Dashboard</h1>
        <Link to="/templates" className="btn btn-primary">+ New Server</Link>
      </div>

      {host && (
        <div className="card p-4 grid grid-cols-3 gap-lg">
          <ResourceBar label="RAM Allocated" used={totalRam} total={host.totalRamMb} unit="MB" />
          <ResourceBar label="CPU Allocated" used={totalCpu} total={host.cpuCores * 100} unit="%" />
          <ResourceBar label="Disk Allocated" used={totalDisk} total={host.totalDiskGb || 0} unit="GB" />
        </div>
      )}

      {servers.length > 0 && (
        <input
          className="input max-w-xs"
          placeholder="Search servers..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}

      {servers.length === 0 ? (
        <div className="card p-xl text-center flex flex-col items-center gap-2">
          <span className="text-text-muted text-[32px] leading-none">▢</span>
          <div className="text-section-head text-text-secondary">No servers yet</div>
          <div className="text-caption text-text-muted mb-2">Create your first game server from a template.</div>
          <Link to="/templates" className="btn btn-primary">Browse Templates</Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-xl text-center text-text-muted text-caption">No servers match "{query}"</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
          {filtered.map((server) => <ServerCard key={server.id} server={server} />)}
        </div>
      )}
    </div>
  );
}
