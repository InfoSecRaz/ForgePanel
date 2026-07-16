import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useToast } from '../../lib/ToastContext';
import { formatUptime, formatDate } from '../../lib/format';

const RANGES = ['30min', '1h', '6h', '24h', '7d', '30d'];

function mergeActivity(events) {
  const byId = new Map();
  for (const e of events) byId.set(e.id, e);
  return [...byId.values()].sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)).slice(0, 50);
}

function BarChartIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="4" y1="20" x2="4" y2="12" />
      <line x1="12" y1="20" x2="12" y2="6" />
      <line x1="20" y1="20" x2="20" y2="15" />
    </svg>
  );
}

function SummaryField({ label, value }) {
  return (
    <div>
      <div className="text-[12px] text-text-muted">{label}</div>
      <div className="text-[14px] text-text-primary" style={{ fontWeight: 590 }}>{value}</div>
    </div>
  );
}

function ServerSummaryCard({ server, template, playerCount }) {
  const diskUsedGb = server.diskUsedMb != null ? (server.diskUsedMb / 1024).toFixed(1) : '-';

  return (
    <div className="card p-4">
      <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: '16px' }}>
        <SummaryField label="Game" value={template ? template.name : server.game_id} />
        <SummaryField label="Port" value={server.port} />
        <SummaryField label="Players" value={`${playerCount} / ${server.maxPlayers ?? '?'}`} />
        <SummaryField label="Uptime" value={formatUptime(server)} />
        <SummaryField label="Installed" value={formatDate(server.created_at)} />
        <SummaryField label="Disk Used" value={`${diskUsedGb} GB / ${server.disk_limit_gb} GB allocated`} />
      </div>
    </div>
  );
}

export default function Overview({ server }) {
  const [range, setRange] = useState('1h');
  const [points, setPoints] = useState([]);
  const [activity, setActivity] = useState([]);
  const [players, setPlayers] = useState([]);
  const [template, setTemplate] = useState(null);
  const [chartColors, setChartColors] = useState({ cpu: '#5e6ad2', ram: '#27a644', disk: '#f59e0b' });
  const toast = useToast();

  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    setChartColors({
      cpu: style.getPropertyValue('--accent').trim() || '#5e6ad2',
      ram: style.getPropertyValue('--status-running').trim() || '#27a644',
      disk: style.getPropertyValue('--status-warning').trim() || '#f59e0b'
    });
  }, []);

  useEffect(() => {
    api.get(`/templates/${server.game_id}`).then(setTemplate).catch(() => setTemplate(null));
  }, [server.game_id]);

  useEffect(() => {
    api.get(`/servers/${server.id}/resources?range=${range}`)
      .then((data) => setPoints(data.points))
      .catch((err) => toast.error(err.message));
  }, [server.id, range]);

  useEffect(() => {
    api.get(`/servers/${server.id}/activity`)
      .then((data) => setActivity(mergeActivity(data.events || [])))
      .catch((err) => toast.error(err.message));
  }, [server.id]);

  useEffect(() => {
    api.get(`/servers/${server.id}/players`).then((data) => setPlayers(data.online)).catch(() => {});

    const socket = getSocket();
    const onActivity = ({ serverId, event }) => {
      if (serverId === server.id) setActivity((prev) => mergeActivity([event, ...prev]));
    };
    const onPlayerJoin = ({ serverId, playerName }) => {
      if (serverId === server.id) setPlayers((prev) => [...new Set([...prev, playerName])]);
    };
    const onPlayerLeave = ({ serverId, playerName }) => {
      if (serverId === server.id) setPlayers((prev) => prev.filter((p) => p !== playerName));
    };
    socket.on('activity:new', onActivity);
    socket.on('player:join', onPlayerJoin);
    socket.on('player:leave', onPlayerLeave);
    return () => {
      socket.off('activity:new', onActivity);
      socket.off('player:join', onPlayerJoin);
      socket.off('player:leave', onPlayerLeave);
    };
  }, [server.id]);

  return (
    <div className="p-lg space-y-lg">
      <ServerSummaryCard server={server} template={template} playerCount={players.length} />

      <div className="card p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="card-title mb-0">Resource Usage</h2>
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2 py-1 rounded-badge text-label transition-colors duration-100 ${range === r ? 'bg-accent text-text-primary' : 'bg-surface3 text-text-secondary'}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        {points.length === 0 ? (
          <div className="h-[220px] flex flex-col items-center justify-center gap-1.5 text-text-muted">
            <BarChartIcon />
            <p className="text-[13px]">No resource data yet</p>
            <p className="text-caption">Start the server to begin collecting stats</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={points}>
              <CartesianGrid stroke="#23252a" strokeWidth={0.5} vertical={false} />
              <XAxis dataKey="recorded_at" tick={false} stroke="#23252a" />
              <YAxis stroke="#62666d" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#18191a', border: '0.5px solid #34343a', borderRadius: 8, fontSize: 13 }} />
              <Line type="monotone" dataKey="cpu_percent" name="CPU %" stroke={chartColors.cpu} strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="ram_mb" name="RAM MB" stroke={chartColors.ram} strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="disk_mb" name="Disk MB" stroke={chartColors.disk} strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-2 gap-lg">
        <div className="card p-4">
          <h2 className="card-title">Players Online ({players.length})</h2>
          {players.length === 0 ? (
            <p className="text-text-muted text-caption">No players online</p>
          ) : (
            <ul className="space-y-1 text-[13px] text-text-primary">
              {players.map((p) => <li key={p}>{p}</li>)}
            </ul>
          )}
        </div>

        <div className="card p-4">
          <h2 className="card-title">Activity</h2>
          <ul className="space-y-2 text-[13px] max-h-64 overflow-y-auto">
            <AnimatePresence initial={false}>
              {activity.map((e) => (
                <motion.li
                  key={e.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  className="text-text-secondary"
                >
                  <span className="text-text-primary">{e.eventType}</span>: {e.description}
                </motion.li>
              ))}
            </AnimatePresence>
            {activity.length === 0 && <li className="text-text-muted text-caption">No recent activity</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
