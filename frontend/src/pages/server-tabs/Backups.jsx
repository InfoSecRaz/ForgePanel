import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function Backups({ server }) {
  const [backups, setBackups] = useState([]);
  const [busy, setBusy] = useState(false);

  function load() {
    api.get(`/servers/${server.id}/backups`).then(setBackups);
  }

  useEffect(() => { load(); }, [server.id]);

  async function createBackup() {
    setBusy(true);
    try {
      await api.post(`/servers/${server.id}/backups`);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function restore(backupId) {
    if (server.state !== 'stopped') return alert('Server must be stopped before restoring a backup.');
    if (!confirm('Restore this backup? Current server data will be overwritten.')) return;
    await api.post(`/servers/${server.id}/backups/${backupId}/restore`);
    alert('Backup restored.');
  }

  async function remove(backupId) {
    if (!confirm('Delete this backup?')) return;
    await api.del(`/servers/${server.id}/backups/${backupId}`);
    load();
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-medium">Backups</h2>
        <button className="btn btn-primary" disabled={busy} onClick={createBackup}>
          {busy ? 'Backing up...' : 'Create Backup'}
        </button>
      </div>

      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-secondary border-b border-border">
              <th className="p-2">Filename</th>
              <th className="p-2">Size</th>
              <th className="p-2">Created</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {backups.map((b) => (
              <tr key={b.id} className="border-b border-border last:border-0">
                <td className="p-2">{b.filename}</td>
                <td className="p-2 text-text-secondary">{(b.size_bytes / (1024 * 1024)).toFixed(1)} MB</td>
                <td className="p-2 text-text-secondary">{new Date(b.created_at).toLocaleString()}</td>
                <td className="p-2 text-right space-x-2">
                  <button className="text-info text-xs" onClick={() => restore(b.id)}>Restore</button>
                  <button className="text-stopped text-xs" onClick={() => remove(b.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {backups.length === 0 && <p className="p-4 text-text-secondary text-sm">No backups yet.</p>}
      </div>
    </div>
  );
}
