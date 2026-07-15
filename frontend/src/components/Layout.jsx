import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/templates', label: 'Templates' },
  { to: '/users', label: 'Users', adminOnly: true },
  { to: '/settings', label: 'Settings', adminOnly: true }
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-surface border-r border-border flex flex-col">
        <div className="px-4 py-4 border-b border-border">
          <span className="text-lg font-semibold">ForgePanel</span>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {NAV_ITEMS.filter((item) => !item.adminOnly || user?.isAdmin).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm font-medium ${
                  isActive ? 'bg-surface2 text-text-primary' : 'text-text-secondary hover:bg-surface2 hover:text-text-primary'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-border">
          <div className="text-sm text-text-secondary mb-2">{user?.username}</div>
          <button onClick={handleLogout} className="btn btn-secondary w-full">
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
