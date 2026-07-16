import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation, NavLink, Routes, Route, Navigate } from 'react-router-dom';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useToast } from '../lib/ToastContext';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';
import PageTransition from '../components/PageTransition';
import Overview from './server-tabs/Overview';
import Console from './server-tabs/Console';
import Files from './server-tabs/Files';
import Workshop from './server-tabs/Workshop';
import Config from './server-tabs/Config';
import Tunnel from './server-tabs/Tunnel';
import Backups from './server-tabs/Backups';
import Discord from './server-tabs/Discord';
import Players from './server-tabs/Players';
import Tasks from './server-tabs/Tasks';

const TABS = [
  { path: '', label: 'Overview', component: Overview },
  { path: 'console', label: 'Console', component: Console },
  { path: 'files', label: 'Files', component: Files },
  { path: 'workshop', label: 'Workshop', component: Workshop },
  { path: 'config', label: 'Config', component: Config },
  { path: 'tunnel', label: 'Tunnel', component: Tunnel },
  { path: 'backups', label: 'Backups', component: Backups },
  { path: 'discord', label: 'Discord', component: Discord },
  { path: 'players', label: 'Players', component: Players },
  { path: 'tasks', label: 'Tasks', component: Tasks }
];

export default function ServerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [server, setServer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const toast = useToast();

  function refresh() {
    return api.get(`/servers/${id}`).then(setServer).catch((err) => toast.error(err.message));
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));

    const socket = getSocket();
    const onStateChange = ({ serverId, state }) => {
      if (serverId === id) setServer((prev) => (prev ? { ...prev, state } : prev));
    };
    socket.on('state:change', onStateChange);
    return () => socket.off('state:change', onStateChange);
  }, [id]);

  async function handleAction(action) {
    setActionBusy(true);
    try {
      await api.post(`/servers/${id}/${action}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionBusy(false);
    }
  }

  async function confirmDelete() {
    try {
      await api.del(`/servers/${id}`);
      toast.success(`"${server.name}" deleted`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message);
      setDeleteOpen(false);
    }
  }

  if (loading) return <div className="p-lg text-text-secondary text-[13px]">Loading...</div>;
  if (!server) return <div className="p-lg text-text-secondary text-[13px]">Server not found.</div>;

  return (
    <div className="flex flex-col h-screen">
      <div className="border-b border-hairline px-6 h-[52px] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] text-text-primary" style={{ fontWeight: 590 }}>{server.name}</h1>
          <StatusBadge state={server.state} />
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-primary"
            disabled={actionBusy || !['stopped', 'crashed'].includes(server.state)}
            onClick={() => handleAction('start')}
          >
            Start
          </button>
          <button
            className="btn btn-secondary"
            disabled={actionBusy || server.state !== 'running'}
            onClick={() => handleAction('restart')}
          >
            Restart
          </button>
          <button
            className="btn btn-danger"
            disabled={actionBusy || !['running', 'starting'].includes(server.state)}
            onClick={() => handleAction('stop')}
          >
            Stop
          </button>
          <button className="btn btn-ghost text-stopped" onClick={() => setDeleteOpen(true)}>Delete</button>
        </div>
      </div>

      <div className="border-b border-hairline px-6 flex gap-1 overflow-x-auto flex-shrink-0">
        {TABS.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path === '' ? `/servers/${id}` : `/servers/${id}/${tab.path}`}
            end={tab.path === ''}
            className={({ isActive }) =>
              `px-3.5 py-2.5 text-[13px] border-b-2 whitespace-nowrap transition-colors duration-100 ${
                isActive ? 'border-accent text-text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'
              }`
            }
            style={({ isActive }) => (isActive ? { fontWeight: 590 } : undefined)}
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <PageTransition key={location.pathname}>
          <Routes>
            {TABS.map((tab) => (
              <Route
                key={tab.path}
                path={tab.path}
                element={<tab.component server={server} onServerUpdate={refresh} />}
              />
            ))}
            <Route path="*" element={<Navigate to={`/servers/${id}`} replace />} />
          </Routes>
        </PageTransition>
      </div>

      {deleteOpen && (
        <ConfirmModal
          title="Delete server?"
          message={`This removes the "${server.name}" container. Server data on disk is kept. This cannot be undone from the panel.`}
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteOpen(false)}
        />
      )}
    </div>
  );
}
