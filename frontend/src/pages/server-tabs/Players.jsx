import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useToast } from '../../lib/ToastContext';
import ConfirmModal from '../../components/ConfirmModal';

export default function Players({ server }) {
  const [online, setOnline] = useState([]);
  const [banTarget, setBanTarget] = useState(null);
  const toast = useToast();

  function load() {
    api.get(`/servers/${server.id}/players`).then((data) => setOnline(data.online)).catch((err) => toast.error(err.message));
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
    try {
      await api.post(`/servers/${server.id}/players/${encodeURIComponent(name)}/kick`);
      toast.success(`Kicked ${name}`);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function confirmBan() {
    try {
      await api.post(`/servers/${server.id}/players/${encodeURIComponent(banTarget)}/ban`);
      toast.success(`Banned ${banTarget}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBanTarget(null);
    }
  }

  return (
    <div className="p-lg">
      <div className="card overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-text-secondary border-b border-hairline">
              <th className="p-3 font-normal">Player</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {online.map((name) => (
              <tr key={name} className="border-b border-hairline last:border-0">
                <td className="p-3 text-text-primary">{name}</td>
                <td className="p-3 text-right space-x-3">
                  <button className="text-warning text-label" onClick={() => kick(name)}>Kick</button>
                  <button className="text-stopped text-label" onClick={() => setBanTarget(name)}>Ban</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {online.length === 0 && <p className="p-6 text-center text-text-muted text-caption">No players online.</p>}
      </div>

      {banTarget && (
        <ConfirmModal
          title="Ban player?"
          message={`This bans "${banTarget}" from the server.`}
          confirmLabel="Ban"
          onConfirm={confirmBan}
          onCancel={() => setBanTarget(null)}
        />
      )}
    </div>
  );
}
