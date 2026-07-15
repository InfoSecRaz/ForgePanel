import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';

const RANGES = ['30min', '1h', '6h', '24h', '7d', '30d'];

export default function Overview({ server }) {
  const [range, setRange] = useState('1h');
  const [points, setPoints] = useState([]);
  const [activity, setActivity] = useState([]);
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    api.get(`/servers/${server.id}/resources?range=${range}`).then((data) => setPoints(data.points));
  }, [server.id, range]);

  useEffect(() => {
    api.get(`/servers/${server.id}/players`).then((data) => setPlayers(data.online));

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
    <div className="p-6 space-y-6">
      <div className="card p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-medium">Resource Usage</h2>
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2 py-1 text-xs rounded ${range === r ? 'bg-info text-white' : 'bg-surface2 text-text-secondary'}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={points}>
            <XAxis dataKey="recorded_at" tick={false} stroke="#2a2a2a" />
            <YAxis stroke="#9ca3af" fontSize={12} />
            <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }} />
            <Line type="monotone" dataKey="cpu_percent" name="CPU %" stroke="#3b82f6" dot={false} />
            <Line type="monotone" dataKey="ram_mb" name="RAM MB" stroke="#10b981" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="card p-4">
          <h2 className="font-medium mb-3">Players Online ({players.length})</h2>
          {players.length === 0 ? (
            <p className="text-text-secondary text-sm">No players online</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {players.map((p) => <li key={p}>{p}</li>)}
            </ul>
          )}
        </div>

        <div className="card p-4">
          <h2 className="font-medium mb-3">Activity</h2>
          <ul className="space-y-2 text-sm max-h-64 overflow-y-auto">
            {activity.map((e, i) => (
              <li key={i} className="text-text-secondary">
                <span className="text-text-primary">{e.eventType}</span> — {e.description}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
