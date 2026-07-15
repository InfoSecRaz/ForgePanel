import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';

export default function Players({ server }) {
  const [online, setOnline] = useState([]);

  function load() {
    api.get(`/servers/${server.id}/players`).then((data) => setOnline(data.online));
  }

  useEffect(() => {
    load();
    const socket = getSocket();
    socket.on('player:join', load);
    socket.on('player:leave', load);
    return () => {
      socket.off('player:join', load);
      socket.off('player:leave', load);
    };
  }, [server.id]);

  async function kick(name) {
    await api.post(`/servers/${server.id}/players/${encodeURIComponent(name)}/kick`);
  }

  async function ban(name) {
    if (!confirm(`Ban ${name}?`)) return;
    await api.post(`/servers/${server.id}/players/${encodeURIComponent(name)}/ban`);
  }

  return (
    <div className="p-6">
      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-secondary border-b border-border">
              <th className="p-2">Player</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {online.map((name) => (
              <tr key={name} className="border-b border-border last:border-0">
                <td className="p-2">{name}</td>
                <td className="p-2 text-right space-x-2">
                  <button className="text-warning text-xs" onClick={() => kick(name)}>Kick</button>
                  <button className="text-stopped text-xs" onClick={() => ban(name)}>Ban</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {online.length === 0 && <p className="p-4 text-text-secondary text-sm">No players online.</p>}
      </div>
    </div>
  );
}
