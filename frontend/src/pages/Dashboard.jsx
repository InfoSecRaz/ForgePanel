import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useToast } from '../lib/ToastContext';
import StatusBadge from '../components/StatusBadge';
import { formatUptime } from '../lib/format';

const BUSY_STATES = ['starting', 'stopping', 'installing', 'restarting'];

function QuickActions({ server }) {
  const [confirming, setConfirming] = useState(null);
  const timeoutRef = useRef(null);
  const toast = useToast();

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  async function runAction(action) {
    clearTimeout(timeoutRef.current);
    setConfirming(null);
    try {
      await api.post(`/servers/${server.id}/${action}`);
    } catch (err) {
      toast.error(err.message);
    }
  }

  function handleStart(e) {
    e.preventDefault();
    e.stopPropagation();
    toast.success(`Starting ${server.name}...`);
    runAction('start');
  }

  function requestConfirm(e, action) {
    e.preventDefault();
    e.stopPropagation();
    if (confirming === action) {
      runAction(action);
      return;
    }
    setConfirming(action);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setConfirming(null), 2000);
  }

  if (BUSY_STATES.includes(server.state)) {
    return (
      <button
        className="btn btn-secondary"
        disabled
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
        <span className="inline-block w-3 h-3 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
      </button>
    );
  }

  if (['stopped', 'crashed'].includes(server.state)) {
    return <button className="btn btn-primary" onClick={handleStart}>Start</button>;
  }

  if (server.state === 'running') {
    return (
      <div className="flex gap-2">
        <button className="btn btn-secondary" onClick={(e) => requestConfirm(e, 'restart')}>
          {confirming === 'restart' ? 'Confirm restart?' : 'Restart'}
        </button>
        <button className="btn btn-danger" onClick={(e) => requestConfirm(e, 'stop')}>
          {confirming === 'stop' ? 'Confirm stop?' : 'Stop'}
        </button>
      </div>
    );
  }

  return null;
}

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
  const playerCount = server._players ?? 0;

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
        <span className="text-label text-text-muted w-7 flex-shrink-0">CPU</span>
        <MiniBar percent={cpuPercent} color="bg-accent" />
        <span className="text-label text-text-muted w-8 text-right">{Math.round(cpuPercent)}%</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-label text-text-muted w-7 flex-shrink-0">RAM</span>
        <MiniBar percent={ramPercent} color="bg-running" />
        <span className="text-label text-text-muted w-8 text-right">{Math.round(ramPercent)}%</span>
      </div>
      <div className="flex items-center justify-between text-label text-text-muted">
        <span>{playerCount} / {server.maxPlayers ?? '?'} players</span>
        <span>{formatUptime(server)}</span>
        <span>Port {server.port}</span>
      </div>

      <div className="pt-1">
        <QuickActions server={server} />
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
    const onStats = ({ serverId, cpu, ram, players }) => {
      setServers((prev) => prev.map((s) => (s.id === serverId ? { ...s, _cpu: cpu, _ram: ram, _players: players } : s)));
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
