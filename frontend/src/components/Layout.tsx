import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useServerStore } from '../stores/serverStore';
import { getSocket } from '../lib/socket';
import { api } from '../lib/api';
import type { Server, StateChangePayload, StatsUpdatePayload } from '../types';
import type { ReactNode } from 'react';

const NAV = [
  { to: '/dashboard', icon: '⊞', label: 'Dashboard' },
  { to: '/templates', icon: '📦', label: 'Templates' },
  { to: '/users', icon: '👥', label: 'Users', adminOnly: true },
  { to: '/settings', icon: '⚙️', label: 'Settings', adminOnly: true }
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { servers, setServers, updateState, updateStats } = useServerStore();

  // Bootstrap server list and wire global socket listeners here so
  // Dashboard and other pages read from the store instead of each fetching independently.
  useEffect(() => {
    api.get<Server[]>('/servers').then(setServers).catch(() => {});

    const socket = getSocket();
    const onState = ({ serverId, state, health }: StateChangePayload) => updateState(serverId, state, health);
    const onStats = ({ serverId, cpu, ram, players, health }: StatsUpdatePayload) =>
      updateStats(serverId, cpu, ram, players, health);

    socket.on('state:change', onState);
    socket.on('stats:update', onStats);
    return () => {
      socket.off('state:change', onState);
      socket.off('stats:update', onStats);
    };
  }, []);

  const running = servers.filter((s) => s.state === 'running');
  const totalPlayers = running.reduce((n, s) => n + (s._players ?? 0), 0);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-[220px] flex-shrink-0 flex flex-col" style={{ background: '#0a0b0c', borderRight: '0.5px solid var(--border-hairline)' }}>
        {/* Logo */}
        <div className="px-5 py-5 flex items-center gap-2.5">
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
            ⚒
          </div>
          <span className="text-[14px] text-text-primary" style={{ fontWeight: 700, letterSpacing: '-0.01em' }}>ForgePanel</span>
        </div>

        {/* Fleet pill */}
        <div className="mx-3 mb-4 p-3 rounded-[10px] card">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] text-text-muted uppercase tracking-[0.08em]" style={{ fontWeight: 510 }}>Fleet</span>
            <span className="text-[10px] text-running">● {running.length} online</span>
          </div>
          <div className="flex gap-4">
            <div>
              <div className="text-[20px] text-text-primary" style={{ fontWeight: 700, lineHeight: 1 }}>{servers.length}</div>
              <div className="text-[10px] text-text-muted">servers</div>
            </div>
            <div>
              <div className="text-[20px] text-accent" style={{ fontWeight: 700, lineHeight: 1 }}>{totalPlayers}</div>
              <div className="text-[10px] text-text-muted">players</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2">
          {NAV.map((item) => {
            if (item.adminOnly && !user?.isAdmin) return null;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-tab text-[13px] mb-0.5 transition-colors duration-100 ${
                    isActive
                      ? 'bg-surface3 text-text-primary'
                      : 'text-text-secondary hover:bg-surface2 hover:text-text-primary'
                  }`
                }
                style={({ isActive }) => isActive ? { borderLeft: '2px solid var(--accent)', fontWeight: 590 } : { borderLeft: '2px solid transparent' }}
              >
                <span className="text-[14px] w-5 text-center">{item.icon}</span>
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-4 py-3" style={{ borderTop: '0.5px solid var(--border-hairline)' }}>
          <div className="flex items-center gap-2.5">
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#18191a', border: '0.5px solid var(--border-hairline-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>
              {user?.username?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] text-text-primary truncate" style={{ fontWeight: 590 }}>{user?.username}</div>
              <div className="text-[10px] text-text-muted">{user?.isAdmin ? 'Admin' : 'User'}</div>
            </div>
            <button onClick={handleLogout} className="btn-ghost text-[11px] text-text-muted hover:text-text-primary">→</button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-canvas">{children}</main>
    </div>
  );
}
