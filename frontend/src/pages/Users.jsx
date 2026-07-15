import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../lib/ToastContext';
import ConfirmModal from '../components/ConfirmModal';

function passwordStrength(pw) {
  if (!pw) return { label: '', color: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: 'Weak', color: 'bg-stopped', width: '25%' };
  if (score <= 3) return { label: 'Okay', color: 'bg-warning', width: '60%' };
  return { label: 'Strong', color: 'bg-running', width: '100%' };
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [servers, setServers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [permsFor, setPermsFor] = useState(null);
  const [perms, setPerms] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const toast = useToast();

  function load() {
    api.get('/users').then(setUsers).catch((err) => toast.error(`Failed to load users: ${err.message}`));
    api.get('/servers').then(setServers).catch(() => {});
  }

  useEffect(() => { load(); }, []);

  function resetForm() {
    setShowForm(false);
    setUsername('');
    setPassword('');
    setPasswordConfirm('');
    setIsAdmin(false);
  }

  async function createUser() {
    if (password !== passwordConfirm) {
      toast.error('Passwords do not match');
      return;
    }
    try {
      await api.post('/users', { username, password, isAdmin });
      resetForm();
      load();
      toast.success(`User "${username}" created`);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function confirmDeleteUser() {
    try {
      await api.del(`/users/${deleteTarget.id}`);
      toast.success(`User "${deleteTarget.username}" deleted`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function openPerms(user) {
    setPermsFor(user);
    try {
      const data = await api.get(`/users/${user.id}/permissions`);
      const byServer = {};
      data.forEach((p) => (byServer[p.server_id] = p));
      setPerms(byServer);
    } catch (err) {
      toast.error(`Failed to load permissions: ${err.message}`);
    }
  }

  async function togglePerm(serverId, field) {
    const current = perms[serverId] || {};
    const updated = { ...current, [field.replace(/_([a-z])/g, (_, c) => c.toUpperCase())]: !current[field] };
    try {
      await api.put(`/users/${permsFor.id}/permissions/${serverId}`, updated);
      setPerms((prev) => ({ ...prev, [serverId]: { ...current, [field]: !current[field] } }));
    } catch (err) {
      toast.error(err.message);
    }
  }

  const PERM_FIELDS = ['view_console', 'send_console', 'start_stop', 'file_read', 'file_write', 'workshop_install', 'config_edit', 'backup_create', 'backup_restore'];
  const strength = passwordStrength(password);
  const passwordsMismatch = passwordConfirm.length > 0 && password !== passwordConfirm;

  return (
    <div className="p-lg space-y-lg">
      <div className="flex justify-between items-center">
        <h1 className="text-page-title text-text-primary">Users</h1>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New User</button>}
      </div>

      {showForm && (
        <div className="card p-4 space-y-3 max-w-sm">
          <div>
            <label className="field-label">Username</label>
            <input className="input" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Password</label>
            <input type="password" className="input" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
            {password && (
              <div className="mt-1.5">
                <div className="h-1 bg-hairline rounded-full overflow-hidden">
                  <div className={`h-full ${strength.color} transition-all duration-100`} style={{ width: strength.width }} />
                </div>
                <span className="text-label text-text-muted">{strength.label}</span>
              </div>
            )}
          </div>
          <div>
            <label className="field-label">Confirm Password</label>
            <input type="password" className="input" autoComplete="off" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} />
            {passwordsMismatch && <span className="text-label text-stopped">Passwords don't match</span>}
          </div>
          <label className="flex items-center gap-2 text-caption text-text-secondary">
            <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} /> Admin
          </label>
          <div className="flex gap-2 pt-1">
            <button className="btn btn-secondary" onClick={resetForm}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={createUser}
              disabled={!username || !password || password !== passwordConfirm}
            >
              Create
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-text-secondary border-b border-hairline">
              <th className="p-3 font-normal">Username</th>
              <th className="p-3 font-normal">Admin</th>
              <th className="p-3 font-normal">2FA</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-hairline last:border-0">
                <td className="p-3 text-text-primary">{u.username}</td>
                <td className="p-3 text-text-secondary">{u.isAdmin ? 'Yes' : 'No'}</td>
                <td className="p-3 text-text-secondary">{u.totpEnabled ? 'Enabled' : 'Off'}</td>
                <td className="p-3 text-right space-x-3">
                  {!u.isAdmin && <button className="text-accent text-caption" onClick={() => openPerms(u)}>Permissions</button>}
                  <button className="text-stopped text-caption" onClick={() => setDeleteTarget(u)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {permsFor && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface1 border border-hairline-strong rounded-modal p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[15px] text-text-primary" style={{ fontWeight: 590 }}>Permissions for {permsFor.username}</h2>
              <button className="btn btn-ghost" onClick={() => setPermsFor(null)}>Close</button>
            </div>
            {servers.map((server) => (
              <div key={server.id} className="mb-4">
                <h3 className="text-[13px] text-text-primary mb-2" style={{ fontWeight: 590 }}>{server.name}</h3>
                <div className="grid grid-cols-3 gap-2">
                  {PERM_FIELDS.map((field) => (
                    <label key={field} className="flex items-center gap-1.5 text-label text-text-secondary">
                      <input
                        type="checkbox"
                        checked={!!(perms[server.id] || {})[field]}
                        onChange={() => togglePerm(server.id, field)}
                      />
                      {field.replace(/_/g, ' ')}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete user?"
          message={`This permanently deletes "${deleteTarget.username}" and their permissions. This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={confirmDeleteUser}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
