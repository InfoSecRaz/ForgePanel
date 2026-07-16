import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useToast } from '../../lib/ToastContext';

export default function Tunnel({ server }) {
  const [tunnel, setTunnel] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  function load() {
    api.get(`/servers/${server.id}/tunnel`).then(setTunnel).catch((err) => toast.error(err.message));
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
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!tunnel) return <div className="p-lg text-text-secondary text-[13px]">Loading...</div>;

  return (
    <div className="p-lg space-y-lg">
      <div className="card p-4">
        <p className="text-caption text-text-secondary mb-4">
          playit.gg creates a public address for your server so players can connect without port forwarding. Free. Requires one-time setup in Settings.
          Players do not need to install anything to connect through a playit.gg tunnel.
        </p>

        <div className="flex items-center justify-between mb-3">
          <h2 className="card-title mb-0">playit.gg Tunnel</h2>
          <button className="btn btn-primary" disabled={busy} onClick={toggle}>
            {tunnel.enabled ? 'Disable' : 'Enable'}
          </button>
        </div>

        {tunnel.enabled && (
          <div className="space-y-2">
            {tunnel.address ? (
              <div className="flex items-center gap-2">
                <code className="bg-surface3 px-3 py-1.5 rounded-button text-[13px] text-text-primary">{tunnel.address}</code>
                <button className="btn btn-secondary text-label" onClick={() => { navigator.clipboard.writeText(tunnel.address); toast.success('Copied'); }}>Copy</button>
              </div>
            ) : (
              <p className="text-text-secondary text-caption">
                Tunnel enabled. Assign a tunnel to this server's port on the{' '}
                <a href="https://playit.gg/account/tunnels" target="_blank" rel="noreferrer" className="text-accent">playit.gg dashboard</a>.{' '}
                ForgePanel will pick up the public address automatically once it's live.
              </p>
            )}
            <p className="text-label text-text-muted">
              Free tier addresses may change over time. See{' '}
              <a href="https://playit.gg/pricing" target="_blank" rel="noreferrer" className="text-accent">playit.gg premium</a> for a stable address.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
