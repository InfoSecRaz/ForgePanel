import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [servers, setServers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [permsFor, setPermsFor] = useState(null);
  const [perms, setPerms] = useState({});

  function load() {
    api.get('/users').then(setUsers);
    api.get('/servers').then(setServers);
  }

  useEffect(() => { load(); }, []);

  async function createUser() {
    await api.post('/users', { username, password, isAdmin });
    setShowForm(false);
    setUsername('');
    setPassword('');
    setIsAdmin(false);
    load();
  }

  async function deleteUser(id) {
    if (!confirm('Delete this user?')) return;
    await api.del(`/users/${id}`);
    load();
  }

  async function openPerms(user) {
    setPermsFor(user);
    const data = await api.get(`/users/${user.id}/permissions`);
    const byServer = {};
    data.forEach((p) => (byServer[p.server_id] = p));
    setPerms(byServer);
  }

  async function togglePerm(serverId, field) {
    const current = perms[serverId] || {};
    const updated = { ...current, [field.replace(/_([a-z])/g, (_, c) => c.toUpperCase())]: !current[field] };
    await api.put(`/users/${permsFor.id}/permissions/${serverId}`, updated);
    setPerms((prev) => ({ ...prev, [serverId]: { ...current, [field]: !current[field] } }));
  }

  const PERM_FIELDS = ['view_console', 'send_console', 'start_stop', 'file_read', 'file_write', 'workshop_install', 'config_edit', 'backup_create', 'backup_restore'];

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Users</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>+ New User</button>
      </div>

      {showForm && (
        <div className="card p-4 space-y-3 max-w-sm">
          <input className="input w-full" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input type="password" className="input w-full" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} /> Admin
          </label>
          <button className="btn btn-primary" onClick={createUser} disabled={!username || !password}>Create</button>
        </div>
      )}

      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-secondary border-b border-border">
              <th className="p-2">Username</th>
              <th className="p-2">Admin</th>
              <th className="p-2">2FA</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="p-2">{u.username}</td>
                <td className="p-2 text-text-secondary">{u.isAdmin ? 'Yes' : 'No'}</td>
                <td className="p-2 text-text-secondary">{u.totpEnabled ? 'Enabled' : 'Off'}</td>
                <td className="p-2 text-right space-x-2">
                  {!u.isAdmin && <button className="text-info text-xs" onClick={() => openPerms(u)}>Permissions</button>}
                  <button className="text-stopped text-xs" onClick={() => deleteUser(u.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {permsFor && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-medium">Permissions for {permsFor.username}</h2>
              <button className="btn btn-secondary" onClick={() => setPermsFor(null)}>Close</button>
            </div>
            {servers.map((server) => (
              <div key={server.id} className="mb-4">
                <h3 className="text-sm font-medium mb-2">{server.name}</h3>
                <div className="grid grid-cols-3 gap-2">
                  {PERM_FIELDS.map((field) => (
                    <label key={field} className="flex items-center gap-1.5 text-xs text-text-secondary">
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
    </div>
  );
}
