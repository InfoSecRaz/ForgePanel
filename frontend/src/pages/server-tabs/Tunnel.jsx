import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';

export default function Tunnel({ server }) {
  const [tunnel, setTunnel] = useState(null);
  const [busy, setBusy] = useState(false);

  function load() {
    api.get(`/servers/${server.id}/tunnel`).then(setTunnel);
  }

  useEffect(() => {
    load();
    const socket = getSocket();
    const onUpdate = ({ serverId, address }) => {
      if (serverId === server.id) setTunnel((prev) => ({ ...prev, address }));
    };
    socket.on('tunnel:update', onUpdate);
    return () => socket.off('tunnel:update', onUpdate);
  }, [server.id]);

  async function toggle() {
    setBusy(true);
    try {
      if (tunnel.enabled) {
        await api.post(`/servers/${server.id}/tunnel/disable`);
      } else {
        await api.post(`/servers/${server.id}/tunnel/enable`);
      }
      load();
    } finally {
      setBusy(false);
    }
  }

  if (!tunnel) return <div className="p-6 text-text-secondary">Loading...</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">playit.gg Tunnel</h2>
          <button className="btn btn-primary" disabled={busy} onClick={toggle}>
            {tunnel.enabled ? 'Disable' : 'Enable'}
          </button>
        </div>

        {tunnel.enabled && (
          <div className="space-y-2">
            {tunnel.address ? (
              <div className="flex items-center gap-2">
                <code className="bg-surface2 px-3 py-1.5 rounded text-sm">{tunnel.address}</code>
                <button className="btn btn-secondary text-xs" onClick={() => navigator.clipboard.writeText(tunnel.address)}>Copy</button>
              </div>
            ) : (
              <p className="text-text-secondary text-sm">
                Tunnel enabled. Assign a tunnel to this server's port on the{' '}
                <a href="https://playit.gg/account/tunnels" target="_blank" rel="noreferrer" className="text-info">playit.gg dashboard</a>{' '}
                — ForgePanel will pick up the public address automatically once it's live.
              </p>
            )}
            <p className="text-xs text-text-secondary">
              Free tier addresses may change over time. See{' '}
              <a href="https://playit.gg/pricing" target="_blank" rel="noreferrer" className="text-info">playit.gg premium</a> for a stable address.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
