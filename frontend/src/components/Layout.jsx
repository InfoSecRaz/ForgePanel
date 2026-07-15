import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

const NAV_SECTIONS = [
  {
    label: 'MANAGEMENT',
    items: [
      { to: '/dashboard', label: 'Dashboard' },
      { to: '/templates', label: 'Templates' }
    ]
  },
  {
    label: 'SYSTEM',
    items: [
      { to: '/users', label: 'Users', adminOnly: true },
      { to: '/settings', label: 'Settings', adminOnly: true }
    ]
  }
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
      <aside className="w-[220px] flex-shrink-0 bg-surface1 border-r border-hairline flex flex-col">
        <div className="px-5 py-5">
          <span className="text-[14px] text-text-primary" style={{ fontWeight: 590 }}>ForgePanel</span>
        </div>
        <nav className="flex-1 px-3">
          {NAV_SECTIONS.map((section) => {
            const items = section.items.filter((item) => !item.adminOnly || user?.isAdmin);
            if (items.length === 0) return null;
            return (
              <div key={section.label} className="mt-5 first:mt-0">
                <div className="text-[10px] text-text-muted uppercase tracking-[0.08em] px-3 mb-1" style={{ fontWeight: 510 }}>
                  {section.label}
                </div>
                <div className="flex flex-col gap-1">
                  {items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `block px-3 py-1.5 rounded-tab text-[13px] transition-colors duration-100 ${
                          isActive
                            ? 'bg-surface3 text-text-primary border-l-2 border-accent'
                            : 'text-text-secondary hover:bg-surface2 hover:text-text-primary'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-hairline">
          <div className="text-[13px] text-text-secondary mb-2">{user?.username}</div>
          <button onClick={handleLogout} className="btn btn-secondary w-full">
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-canvas">{children}</main>
    </div>
  );
}
