import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../lib/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import type { User, Server } from '../types';

interface UserRow extends User {
  totpEnabled?: boolean;
}

type PermSet = Record<string, boolean>;
type PermsState = Record<string, PermSet>;

interface PermCategoryItem {
  field: string;
  label: string;
  description: string;
}

interface PermCategory {
  label: string;
  items: PermCategoryItem[];
}

const PERM_CATEGORIES: PermCategory[] = [
  {
    label: 'Console Access',
    items: [
      { field: 'view_console', label: 'View console output', description: 'Can see live server console output' },
      { field: 'send_console', label: 'Send console commands', description: 'Can type commands directly into the server console' }
    ]
  },
  {
    label: 'File Management',
    items: [
      { field: 'file_read', label: 'Read files', description: 'Can browse and download server files' },
      { field: 'file_write', label: 'Write / upload files', description: 'Can edit, upload, and delete server files' }
    ]
  },
  {
    label: 'Server Control',
    items: [
      { field: 'start_stop', label: 'Start / stop / restart server', description: 'Can start, stop, and restart the server' },
      { field: 'config_edit', label: 'Edit configuration', description: 'Can change server settings like max players, PVP, etc.' }
    ]
  },
  {
    label: 'Mods & Backups',
    items: [
      { field: 'workshop_install', label: 'Install Workshop mods', description: 'Can search, install, and remove Workshop mods' },
      { field: 'backup_create', label: 'Create backups', description: 'Can manually trigger a new backup' },
      { field: 'backup_restore', label: 'Restore backups', description: 'Can restore the server to a previous backup (requires server stopped)' }
    ]
  }
];

const PERM_FIELDS = PERM_CATEGORIES.flatMap((c) => c.items.map((i) => i.field));

const PRESETS: Record<string, string[]> = {
  viewer: ['view_console'],
  moderator: ['view_console', 'send_console', 'start_stop', 'file_read'],
  full: PERM_FIELDS
};

function toCamel(snake: string): string {
  return snake.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function passwordStrength(pw: string): { label: string; color: string; width?: string } {
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

interface PermissionsModalProps {
  user: UserRow;
  servers: Server[];
  onClose: () => void;
  toast: ReturnType<typeof useToast>;
}

function PermissionsModal({ user, servers, onClose, toast }: PermissionsModalProps) {
  const [perms, setPerms] = useState<PermsState>({});
  const [grantedServerIds, setGrantedServerIds] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [addingServerId, setAddingServerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Array<PermSet & { server_id: string }>>(`/users/${user.id}/permissions`)
      .then((data) => {
        const byServer: PermsState = {};
        data.forEach((p) => { byServer[p.server_id] = p; });
        setPerms(byServer);
        const ids = data.map((p) => p.server_id);
        setGrantedServerIds(ids);
        setExpandedIds(new Set(ids.length === 1 ? ids : []));
      })
      .catch((err) => toast.error(`Failed to load permissions: ${(err as Error).message}`))
      .finally(() => setLoading(false));
  }, [user.id]);

  function togglePerm(serverId: string, field: string) {
    setPerms((prev) => ({
      ...prev,
      [serverId]: { ...(prev[serverId] || {}), [field]: !(prev[serverId] || {})[field] }
    }));
  }

  function applyToAllGranted(fields: string[]) {
    const active = new Set(fields);
    setPerms((prev) => {
      const next = { ...prev };
      for (const sid of grantedServerIds) {
        const filled: PermSet = {};
        for (const f of PERM_FIELDS) filled[f] = active.has(f);
        next[sid] = filled;
      }
      return next;
    });
  }

  function toggleExpanded(serverId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(serverId)) next.delete(serverId); else next.add(serverId);
      return next;
    });
  }

  function grantServerAccess(serverId: string) {
    if (!serverId) return;
    setGrantedServerIds((prev) => [...prev, serverId]);
    setPerms((prev) => ({ ...prev, [serverId]: {} }));
    setExpandedIds((prev) => new Set([...prev, serverId]));
    setAddingServerId('');
  }

  async function savePermissions() {
    setSaving(true);
    try {
      await Promise.all(grantedServerIds.map((serverId) => {
        const p = perms[serverId] || {};
        const body: Record<string, boolean> = {};
        for (const f of PERM_FIELDS) body[toCamel(f)] = !!p[f];
        return api.put(`/users/${user.id}/permissions/${serverId}`, body);
      }));
      toast.success(`Permissions updated for ${user.username}`);
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const ungranted = servers.filter((s) => !grantedServerIds.includes(s.id));

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-surface1 border border-hairline-strong rounded-modal p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[15px] text-text-primary" style={{ fontWeight: 590 }}>Permissions for {user.username}</h2>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>

        {loading ? (
          <p className="text-text-secondary text-[13px]">Loading...</p>
        ) : (
          <>
            {grantedServerIds.length > 0 && (
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <button className="btn btn-secondary" onClick={() => applyToAllGranted(PERM_FIELDS)}>Select All</button>
                <button className="btn btn-secondary" onClick={() => applyToAllGranted([])}>Clear All</button>
                <select
                  className="input"
                  style={{ width: 180 }}
                  value=""
                  onChange={(e) => { if (e.target.value) applyToAllGranted(PRESETS[e.target.value]); }}
                >
                  <option value="">Apply preset...</option>
                  <option value="viewer">Viewer only</option>
                  <option value="moderator">Moderator</option>
                  <option value="full">Full access</option>
                </select>
              </div>
            )}

            {grantedServerIds.length === 0 ? (
              <div className="text-center py-8 space-y-3">
                <p className="text-caption text-text-muted">This user doesn't have access to any servers yet.</p>
                {servers.length > 0 && (
                  <div className="flex items-center justify-center gap-2">
                    <select className="input" style={{ width: 220 }} value={addingServerId} onChange={(e) => setAddingServerId(e.target.value)}>
                      <option value="">Select a server...</option>
                      {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <button
                      className="btn btn-primary"
                      disabled={!addingServerId}
                      onClick={() => grantServerAccess(addingServerId)}
                    >
                      + Grant server access
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {grantedServerIds.map((serverId) => {
                  const server = servers.find((s) => s.id === serverId);
                  const expanded = expandedIds.has(serverId);
                  return (
                    <div key={serverId} className="card p-0 overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface2 transition-colors duration-100"
                        onClick={() => toggleExpanded(serverId)}
                      >
                        <span className="text-[13px] text-text-primary" style={{ fontWeight: 590 }}>
                          {server ? server.name : 'Unknown server'}
                        </span>
                        <span className="text-text-muted text-caption">{expanded ? 'Hide' : 'Show'}</span>
                      </button>
                      {expanded && (
                        <div className="px-4 pb-4 space-y-4 border-t border-hairline pt-4">
                          {PERM_CATEGORIES.map((cat) => (
                            <div key={cat.label}>
                              <div
                                className="text-[12px] text-text-secondary uppercase tracking-[0.08em] mb-2"
                                style={{ fontWeight: 590 }}
                              >
                                {cat.label}
                              </div>
                              <div className="space-y-2">
                                {cat.items.map((item) => (
                                  <label key={item.field} className="flex items-start gap-2.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="checkbox mt-0.5"
                                      checked={!!(perms[serverId] || {})[item.field]}
                                      onChange={() => togglePerm(serverId, item.field)}
                                    />
                                    <span>
                                      <span className="block text-[13px] text-text-primary">{item.label}</span>
                                      <span className="block text-label text-text-muted">{item.description}</span>
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {ungranted.length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <select className="input" style={{ width: 200 }} value={addingServerId} onChange={(e) => setAddingServerId(e.target.value)}>
                      <option value="">Select a server...</option>
                      {ungranted.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <button
                      className="btn btn-secondary"
                      disabled={!addingServerId}
                      onClick={() => grantServerAccess(addingServerId)}
                    >
                      + Grant server access
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-hairline">
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={saving || grantedServerIds.length === 0}
                onClick={savePermissions}
              >
                {saving ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Users() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [permsFor, setPermsFor] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const toast = useToast();

  function load() {
    api.get<UserRow[]>('/users').then(setUsers).catch((err) => toast.error(`Failed to load users: ${(err as Error).message}`));
    api.get<Server[]>('/servers').then(setServers).catch(() => {});
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
      toast.error((err as Error).message);
    }
  }

  async function confirmDeleteUser() {
    if (!deleteTarget) return;
    try {
      await api.del(`/users/${deleteTarget.id}`);
      toast.success(`User "${deleteTarget.username}" deleted`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const strength = passwordStrength(password);
  const passwordsMismatch = passwordConfirm.length > 0 && password !== passwordConfirm;

  return (
    <div className="p-lg space-y-lg">
      <div className="flex justify-between items-center">
        <h1 className="text-page-title text-text-primary">Users</h1>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New User</button>}
      </div>

      {users.length === 1 && !showForm && (
        <p className="text-caption text-text-muted">Just you for now. Add users to share access to specific servers.</p>
      )}

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
            <input type="checkbox" className="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} /> Admin
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
                  {!u.isAdmin && <button className="text-accent text-caption" onClick={() => setPermsFor(u)}>Permissions</button>}
                  <button className="text-stopped text-caption" onClick={() => setDeleteTarget(u)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {permsFor && (
        <PermissionsModal
          user={permsFor}
          servers={servers}
          toast={toast}
          onClose={() => setPermsFor(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete user"
          message={`This will permanently remove ${deleteTarget.username}. This cannot be undone.`}
          warning={deleteTarget.isAdmin ? 'Warning: this is an admin account.' : undefined}
          confirmLabel="Delete"
          confirmText={deleteTarget.username}
          onConfirm={confirmDeleteUser}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
