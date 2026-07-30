import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useToast } from '../lib/ToastContext';
import { useServerStore } from '../stores/serverStore';
import { getSocket } from '../lib/socket';
import { formatUptime } from '../lib/format';
import StatusBadge from '../components/StatusBadge';
import HealthIndicator from '../components/HealthIndicator';
import type { Server, HostStats, ActivityEvent, ActivityNewPayload, ServerState } from '../types';

const BUSY: ServerState[] = ['starting', 'stopping', 'installing', 'restarting'];
const NEEDS_ATTENTION = ['warning', 'critical'];

function isUnhealthy(server: Server): boolean {
  return !!server.health && NEEDS_ATTENTION.includes(server.health.status);
}

// ─── Game icons ──────────────────────────────────────────────────────────────
const GAME_ICONS: Record<string, string> = {
  projectzomboid: '🧟',
  satisfactory: '🏭',
  helldivers2: '🪖',
  minecraft: '⛏️',
  valheim: '🪓',
  terraria: '🌳',
  rust: '🔧',
  ark: '🦕',
  palworld: '🎮',
  sevendays: '🏚️',
};

function gameIcon(gameId: string): string {
  return GAME_ICONS[gameId.toLowerCase()] ?? '🎮';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function stateColor(state: ServerState): string {
  const map: Record<string, string> = {
    running: '#27a644', stopped: '#62666d', crashed: '#eb5757',
    starting: '#f59e0b', stopping: '#f59e0b', restarting: '#f59e0b', installing: '#5e6ad2'
  };
  return map[state] ?? '#62666d';
}

// ─── MiniBar ─────────────────────────────────────────────────────────────────
function MiniBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div style={{ height: 3, background: 'var(--border-hairline)', borderRadius: 9999, overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${Math.min(100, percent)}%`, background: color, transition: 'width 0.3s' }} />
    </div>
  );
}

// ─── Ring gauge ──────────────────────────────────────────────────────────────
function Ring({ percent, color, label, sub }: { percent: number; color: string; label: string; sub: string }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, percent) / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: 68, height: 68 }}>
        <svg width={68} height={68} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={34} cy={34} r={r} fill="none" stroke="var(--border-hairline)" strokeWidth={5} />
          <circle cx={34} cy={34} r={r} fill="none" stroke={color} strokeWidth={5}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.5s' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
          {Math.round(percent)}%
        </div>
      </div>
      <div className="text-[11px] text-text-muted text-center">{label}</div>
      <div className="text-[10px] text-text-muted text-center">{sub}</div>
    </div>
  );
}

// ─── QuickActions ─────────────────────────────────────────────────────────────
function QuickActions({ server }: { server: Server }) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useToast();

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  async function run(action: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setConfirming(null);
    try { await api.post(`/servers/${server.id}/${action}`); }
    catch (err) { toast.error((err as Error).message); }
  }

  function confirm(e: React.MouseEvent, action: string) {
    e.preventDefault(); e.stopPropagation();
    if (confirming === action) { run(action); return; }
    setConfirming(action);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setConfirming(null), 2000);
  }

  if (BUSY.includes(server.state)) {
    return (
      <button className="btn btn-secondary" disabled onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
        <span className="inline-block w-3 h-3 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
      </button>
    );
  }
  if (server.state === 'stopped' || server.state === 'crashed') {
    return (
      <button className="btn btn-primary" onClick={(e) => { e.preventDefault(); e.stopPropagation(); toast.success(`Starting ${server.name}...`); run('start'); }}>
        Start
      </button>
    );
  }
  if (server.state === 'running') {
    return (
      <div className="flex gap-2">
        <button className="btn btn-secondary" onClick={(e) => confirm(e, 'restart')}>
          {confirming === 'restart' ? 'Confirm?' : 'Restart'}
        </button>
        <button className="btn btn-danger" onClick={(e) => confirm(e, 'stop')}>
          {confirming === 'stop' ? 'Confirm?' : 'Stop'}
        </button>
      </div>
    );
  }
  return null;
}

// ─── ServerCard ───────────────────────────────────────────────────────────────
function ServerCard({ server }: { server: Server }) {
  const [hovered, setHovered] = useState(false);
  const cpuPct = server._cpu ?? 0;
  const ramPct = server.ram_limit_mb ? Math.min(100, ((server._ram ?? 0) / server.ram_limit_mb) * 100) : 0;
  const playerPct = server.maxPlayers ? Math.min(100, ((server._players ?? 0) / server.maxPlayers) * 100) : 0;
  const isRunning = server.state === 'running';
  const accentColor = server.custom_color ?? 'var(--accent)';

  return (
    <Link
      to={`/servers/${server.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex flex-col gap-3"
      style={{
        background: hovered ? 'var(--surface-2)' : 'var(--surface-1)',
        border: `0.5px solid ${hovered ? 'var(--border-hairline-strong)' : 'var(--border-hairline)'}`,
        borderRadius: 12, padding: 16,
        textDecoration: 'none', transition: 'all 0.15s', position: 'relative', overflow: 'hidden'
      }}
    >
      {/* Amber glow on top edge when running */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: isRunning ? `linear-gradient(90deg, transparent, ${accentColor}55, transparent)` : 'transparent', transition: 'all 0.3s' }} />

      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface-3)', border: '0.5px solid var(--border-hairline)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
          {server.custom_icon ?? gameIcon(server.game_id)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] text-text-primary truncate" style={{ fontWeight: 590 }}>{server.name}</div>
          {server.custom_tagline
            ? <div className="text-[11px] text-text-muted truncate italic">{server.custom_tagline}</div>
            : <div className="text-[11px] text-text-muted">:{server.port}</div>
          }
        </div>
        <HealthIndicator health={server.health} />
        <StatusBadge state={server.state} />
      </div>

      {/* Resource bars */}
      <div className="flex flex-col gap-2">
        {[
          { label: 'CPU', pct: cpuPct, color: cpuPct > 80 ? 'var(--status-stopped)' : 'var(--accent)' },
          { label: 'RAM', pct: ramPct, color: ramPct > 80 ? 'var(--status-stopped)' : '#5e6ad2' },
          { label: 'PLYR', pct: playerPct, color: 'var(--status-running)' }
        ].map(({ label, pct, color }) => (
          <div key={label} className="flex items-center gap-2">
            <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 28, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>{label}</span>
            <MiniBar percent={pct} color={color} />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 36, textAlign: 'right', flexShrink: 0 }}>
              {label === 'PLYR' ? `${server._players ?? 0}/${server.maxPlayers ?? '?'}` : `${Math.round(pct)}%`}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatUptime(server)}</span>
        <QuickActions server={server} />
      </div>
    </Link>
  );
}

// ─── ActivityFeed ─────────────────────────────────────────────────────────────
function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  const colorFor = (type: string) => {
    if (type.includes('start') || type.includes('join')) return 'var(--status-running)';
    if (type.includes('crash') || type.includes('stop') || type.includes('error')) return 'var(--status-stopped)';
    if (type.includes('backup')) return '#5e6ad2';
    return 'var(--accent)';
  };

  if (events.length === 0) {
    return <p className="text-caption text-text-muted">No recent activity. Start a server to begin.</p>;
  }

  return (
    <div className="flex flex-col">
      {events.slice(0, 20).map((e, i) => (
        <div key={e.id} className="flex gap-2.5 py-2.5" style={{ borderBottom: i < Math.min(events.length, 20) - 1 ? '0.5px solid var(--border-hairline)' : 'none' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: colorFor(e.eventType), flexShrink: 0, marginTop: 4 }} />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] text-text-secondary">
              <span className="text-text-primary" style={{ fontWeight: 510 }}>{e.username ?? 'System'}</span>
              {' — '}{e.description}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{e.eventType}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const toast = useToast();
  const { servers } = useServerStore();
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  // Host stats via React Query
  const { data: host } = useQuery<HostStats>({
    queryKey: ['host'],
    queryFn: () => api.get<HostStats>('/settings/host'),
    staleTime: 60_000
  });

  // Global activity feed via React Query + socket
  const { data: activityData } = useQuery<{ events: ActivityEvent[] }>({
    queryKey: ['activity-global'],
    queryFn: () => api.get('/activity'),
    staleTime: 30_000,
    // If the endpoint doesn't exist yet, fail silently
    retry: false
  });

  useEffect(() => {
    if (activityData?.events) setActivity(activityData.events);
  }, [activityData]);

  useEffect(() => {
    const socket = getSocket();
    const onActivity = ({ event }: ActivityNewPayload) => {
      setActivity((prev) => [event, ...prev].slice(0, 50));
    };
    socket.on('activity:new', onActivity);
    return () => { socket.off('activity:new', onActivity); };
  }, []);

  // Derived stats
  const running = servers.filter((s) => s.state === 'running');
  const totalPlayers = running.reduce((n, s) => n + (s._players ?? 0), 0);
  const totalRamUsedMb = running.reduce((n, s) => n + (s._ram ?? 0), 0);
  const totalRamAllocMb = servers.reduce((n, s) => n + s.ram_limit_mb, 0);
  const avgCpu = running.length ? Math.round(running.reduce((n, s) => n + (s._cpu ?? 0), 0) / running.length) : 0;
  const ramUsedGb = (totalRamUsedMb / 1024).toFixed(1);
  const ramAllocGb = (totalRamAllocMb / 1024).toFixed(1);
  const ramPct = totalRamAllocMb ? Math.round((totalRamUsedMb / totalRamAllocMb) * 100) : 0;

  // Host-level disk
  const diskAllocGb = servers.reduce((n, s) => n + s.disk_limit_gb, 0);
  const diskTotalGb = host?.totalDiskGb ?? 0;
  const diskPct = diskTotalGb ? Math.round((diskAllocGb / diskTotalGb) * 100) : 0;

  const filtered = servers.filter((s) => {
    const q = query.toLowerCase();
    const matchQ = !q || s.name.toLowerCase().includes(q) || s.game_id.toLowerCase().includes(q);
    const matchF = filter === 'all' || (filter === 'attention' ? isUnhealthy(s) : s.state === filter);
    return matchQ && matchF;
  });

  const stopped = servers.filter((s) => s.state === 'stopped' || s.state === 'crashed');
  const attentionCount = servers.filter(isUnhealthy).length;

  return (
    <div className="p-lg" style={{ display: 'grid', gridTemplateColumns: '1fr 288px', gap: 20, alignItems: 'start' }}>

      {/* ── Left column ── */}
      <div className="flex flex-col" style={{ gap: 20 }}>

        {/* Top bar */}
        <div className="flex items-center justify-between">
          <h1 className="text-page-title text-text-primary">Dashboard</h1>
          <Link to="/templates" className="btn btn-primary">+ New Server</Link>
        </div>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: 'Running', value: `${running.length}/${servers.length}`, color: 'var(--status-running)' },
            { label: 'Players Online', value: String(totalPlayers), color: 'var(--accent)' },
            { label: 'RAM Used', value: `${ramUsedGb} GB`, sub: `of ${ramAllocGb} GB alloc`, color: '#5e6ad2' },
            { label: 'Avg CPU', value: `${avgCpu}%`, color: avgCpu > 70 ? 'var(--status-stopped)' : 'var(--text-primary)' }
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="card p-4">
              <div className="text-[10px] text-text-muted uppercase tracking-[0.08em] mb-1" style={{ fontWeight: 510 }}>{label}</div>
              <div className="text-[26px]" style={{ fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
              {sub && <div className="text-[11px] text-text-muted mt-1">{sub}</div>}
            </div>
          ))}
        </div>

        {/* Host resource rings */}
        {host && (
          <div className="card p-5">
            <div className="text-[11px] text-text-muted uppercase tracking-[0.08em] mb-5" style={{ fontWeight: 510 }}>Host Resources</div>
            <div className="flex gap-8 justify-center">
              <Ring percent={avgCpu} color="var(--accent)" label="CPU" sub={`${avgCpu}% avg`} />
              <Ring percent={ramPct} color="#5e6ad2" label="RAM" sub={`${ramUsedGb}/${ramAllocGb}GB`} />
              <Ring percent={diskPct} color="var(--status-running)" label="Disk" sub={`${diskAllocGb}/${diskTotalGb}GB`} />
              <Ring percent={servers.length ? Math.round((running.length / servers.length) * 100) : 0} color="var(--status-info)" label="Fleet" sub={`${running.length}/${servers.length} alive`} />
            </div>
          </div>
        )}

        {/* Filter bar */}
        {servers.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              className="input"
              style={{ maxWidth: 220 }}
              placeholder="Search servers..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {(['all', 'running', 'stopped', 'crashed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="text-[11px] capitalize transition-colors duration-100"
                style={{
                  padding: '4px 12px', borderRadius: 6,
                  background: filter === f ? 'var(--surface-3)' : 'transparent',
                  color: filter === f ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: filter === f ? '0.5px solid var(--border-hairline-strong)' : '0.5px solid transparent',
                  fontWeight: filter === f ? 590 : 400, cursor: 'pointer'
                }}
              >{f}</button>
            ))}
            {attentionCount > 0 && (
              <button
                onClick={() => setFilter((f) => (f === 'attention' ? 'all' : 'attention'))}
                className="text-[11px] transition-colors duration-100"
                style={{
                  padding: '4px 12px', borderRadius: 6,
                  background: filter === 'attention' ? 'var(--surface-3)' : 'transparent',
                  color: filter === 'attention' ? 'var(--status-stopped)' : 'var(--text-muted)',
                  border: filter === 'attention' ? '0.5px solid var(--border-hairline-strong)' : '0.5px solid transparent',
                  fontWeight: filter === 'attention' ? 590 : 400, cursor: 'pointer'
                }}
              >⚠ needs attention ({attentionCount})</button>
            )}
            <span className="text-[11px] text-text-muted ml-auto">{filtered.length} servers</span>
          </div>
        )}

        {/* Server grid */}
        {servers.length === 0 ? (
          <div className="card p-xl text-center flex flex-col items-center gap-3">
            <span className="text-text-muted text-[32px] leading-none">▢</span>
            <div className="text-section-head text-text-secondary">No servers yet</div>
            <div className="text-caption text-text-muted">Create your first game server from a template.</div>
            <Link to="/templates" className="btn btn-primary">Browse Templates</Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-xl text-center text-text-muted text-caption">
            {filter === 'attention' ? 'No servers need attention right now.' : `No servers match "${query}"`}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {filtered.map((s) => <ServerCard key={s.id} server={s} />)}
          </div>
        )}
      </div>

      {/* ── Right column ── */}
      <div className="flex flex-col" style={{ gap: 16 }}>

        {/* Activity feed */}
        <div className="card p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[11px] text-text-muted uppercase tracking-[0.08em]" style={{ fontWeight: 510 }}>Activity</span>
          </div>
          <ActivityFeed events={activity} />
        </div>

        {/* Quick launch — stopped/crashed servers */}
        {stopped.length > 0 && (
          <div className="card p-4">
            <div className="text-[11px] text-text-muted uppercase tracking-[0.08em] mb-3" style={{ fontWeight: 510 }}>Quick Launch</div>
            <div className="flex flex-col gap-2">
              {stopped.map((s) => (
                <div key={s.id} className="flex justify-between items-center p-2 rounded-tab" style={{ background: 'var(--surface-2)', border: '0.5px solid var(--border-hairline)' }}>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 14 }}>{s.custom_icon ?? gameIcon(s.game_id)}</span>
                    <span className="text-[12px] text-text-secondary truncate" style={{ maxWidth: 120 }}>{s.name}</span>
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 10, padding: '3px 8px' }}
                    onClick={() => api.post(`/servers/${s.id}/start`).catch(() => {})}
                  >
                    Start
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status summary */}
        <div className="card p-4">
          <div className="text-[11px] text-text-muted uppercase tracking-[0.08em] mb-3" style={{ fontWeight: 510 }}>Status</div>
          {attentionCount > 0 && (
            <div className="flex items-center gap-2 mb-2">
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--status-stopped)', display: 'block', flexShrink: 0 }} />
              <span className="text-[12px] text-stopped flex-1">Needs attention</span>
              <span className="text-[12px] text-stopped" style={{ fontWeight: 700 }}>{attentionCount}</span>
            </div>
          )}
          {(['running', 'stopped', 'starting', 'crashed', 'installing'] as const).map((state) => {
            const count = servers.filter((s) => s.state === state).length;
            if (count === 0) return null;
            return (
              <div key={state} className="flex items-center gap-2 mb-2">
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: stateColor(state), display: 'block', flexShrink: 0 }} />
                <span className="text-[12px] text-text-secondary flex-1 capitalize">{state}</span>
                <span className="text-[12px] text-text-primary" style={{ fontWeight: 700 }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
