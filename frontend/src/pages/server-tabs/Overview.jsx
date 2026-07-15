import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useToast } from '../../lib/ToastContext';

const RANGES = ['30min', '1h', '6h', '24h', '7d', '30d'];

export default function Overview({ server }) {
  const [range, setRange] = useState('1h');
  const [points, setPoints] = useState([]);
  const [activity, setActivity] = useState([]);
  const [players, setPlayers] = useState([]);
  const toast = useToast();

  useEffect(() => {
    api.get(`/servers/${server.id}/resources?range=${range}`)
      .then((data) => setPoints(data.points))
      .catch((err) => toast.error(err.message));
  }, [server.id, range]);

  useEffect(() => {
    api.get(`/servers/${server.id}/players`).then((data) => setPlayers(data.online)).catch(() => {});

    const socket = getSocket();
    const onActivity = ({ serverId, event }) => {
      if (serverId === server.id) setActivity((prev) => [event, ...prev].slice(0, 50));
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
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={points}>
            <CartesianGrid stroke="#23252a" strokeWidth={0.5} vertical={false} />
            <XAxis dataKey="recorded_at" tick={false} stroke="#23252a" />
            <YAxis stroke="#62666d" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: '#18191a', border: '0.5px solid #34343a', borderRadius: 8, fontSize: 13 }} />
            <Line type="monotone" dataKey="cpu_percent" name="CPU %" stroke="#5e6ad2" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="ram_mb" name="RAM MB" stroke="#27a644" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="disk_mb" name="Disk MB" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
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
            {activity.map((e, i) => (
              <li key={i} className="text-text-secondary">
                <span className="text-text-primary">{e.eventType}</span> — {e.description}
              </li>
            ))}
            {activity.length === 0 && <li className="text-text-muted text-caption">No recent activity</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
