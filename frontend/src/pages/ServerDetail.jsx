import { useEffect, useState } from 'react';
import { useParams, NavLink, Routes, Route, Navigate } from 'react-router-dom';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import StatusBadge from '../components/StatusBadge';
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
  const [server, setServer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);

  function refresh() {
    return api.get(`/servers/${id}`).then(setServer);
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
      alert(err.message);
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-text-secondary">Loading...</div>;
  if (!server) return <div className="p-6 text-text-secondary">Server not found.</div>;

  return (
    <div className="flex flex-col h-screen">
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">{server.name}</h1>
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
        </div>
      </div>

      <div className="border-b border-border px-6 flex gap-1 overflow-x-auto">
        {TABS.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path === '' ? `/servers/${id}` : `/servers/${id}/${tab.path}`}
            end={tab.path === ''}
            className={({ isActive }) =>
              `px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${
                isActive ? 'border-info text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
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
      </div>
    </div>
  );
}
