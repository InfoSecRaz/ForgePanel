import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../lib/ToastContext';
import ConfirmModal from '../../components/ConfirmModal';

export default function Backups({ server }) {
  const [backups, setBackups] = useState([]);
  const [busy, setBusy] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const toast = useToast();

  function load() {
    api.get(`/servers/${server.id}/backups`).then(setBackups).catch((err) => toast.error(err.message));
  }

  useEffect(() => { load(); }, [server.id]);

  async function createBackup() {
    setBusy(true);
    try {
      await api.post(`/servers/${server.id}/backups`);
      toast.success('Backup created');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmRestore() {
    if (server.state !== 'stopped') {
      toast.error('Server must be stopped before restoring a backup.');
      setRestoreTarget(null);
      return;
    }
    try {
      await api.post(`/servers/${server.id}/backups/${restoreTarget.id}/restore`);
      toast.success('Backup restored');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRestoreTarget(null);
    }
  }

  async function confirmDelete() {
    try {
      await api.del(`/servers/${server.id}/backups/${deleteTarget.id}`);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="p-lg space-y-lg">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-section-head text-text-primary">Backups</h2>
          <p className="text-label text-text-muted mt-1">Free tier: last 10 backups retained.</p>
          <p className="text-label text-text-muted mt-1">
            Backups are created while the server is running. A save command is sent before each backup starts to ensure data consistency.
          </p>
        </div>
        <button className="btn btn-primary" disabled={busy} onClick={createBackup}>
          {busy ? 'Backing up...' : 'Create Backup'}
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-text-secondary border-b border-hairline">
              <th className="p-3 font-normal">Filename</th>
              <th className="p-3 font-normal">Size</th>
              <th className="p-3 font-normal">Created</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {backups.map((b) => (
              <tr key={b.id} className="border-b border-hairline last:border-0">
                <td className="p-3 text-text-primary">{b.filename}</td>
                <td className="p-3 text-text-secondary">{(b.size_bytes / (1024 * 1024)).toFixed(1)} MB</td>
                <td className="p-3 text-text-secondary">{new Date(b.created_at).toLocaleString()}</td>
                <td className="p-3 text-right space-x-3">
                  <button className="text-accent text-label" onClick={() => setRestoreTarget(b)}>Restore</button>
                  <button className="text-stopped text-label" onClick={() => setDeleteTarget(b)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {backups.length === 0 && <p className="p-6 text-center text-text-muted text-caption">No backups yet.</p>}
      </div>

      {restoreTarget && (
        <ConfirmModal
          title="Restore backup?"
          message={`This overwrites the current server data with "${restoreTarget.filename}". The server must be stopped, and this cannot be undone.`}
          confirmLabel="Restore"
          onConfirm={confirmRestore}
          onCancel={() => setRestoreTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete backup?"
          message={`This permanently deletes "${deleteTarget.filename}".`}
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
