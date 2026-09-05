import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isSuperAdmin = user?.role === 'superadmin';

  // Build navigation items based on user role
  const managementItems = [];
  if (isSuperAdmin) {
    managementItems.push(
      { label: 'Clients', path: '/dashboard/clients', icon: '🏢' },
      { label: 'Managers', path: '/dashboard/managers', icon: '👔' },
      { label: 'Activity Logs', path: '/dashboard/logs', icon: '📜' }
    );
  }
  managementItems.push(
    { label: 'Bookings', path: '/dashboard/bookings', icon: '📋' },
    { label: 'Revenue', path: '/dashboard/revenue', icon: '💰' },
    { label: 'Transactions', path: '/dashboard/transactions', icon: '💳' }
  );

  const navItems = [
    {
      section: 'Overview',
      items: [{ label: 'Dashboard', path: '/dashboard', icon: '📊' }],
    },
    {
      section: 'Management',
      items: managementItems,
    },
    {
      section: 'Operations',
      items: [
        { label: 'Team', path: '/dashboard/team', icon: '👥' },
        { label: 'Venues', path: '/dashboard/venues', icon: '📍' },
      ],
    },
  ];

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch { }
    window.location.href = '/';
  };

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #FF6B35, #FF8C42)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 800,
                color: 'white',
              }}
            >
              G
            </div>
            <div>
              <h2>GrowMore</h2>
              <span>Admin Panel</span>
            </div>
          </div>
        </div>

        {/* User Card */}
        {user && (
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.name || user.username}</div>
              <div className="sidebar-user-role">
                {isSuperAdmin ? '🛡️ Super Admin' : '👔 Operations Manager'}
              </div>
            </div>
          </div>
        )}

        <nav className="sidebar-nav">
          {navItems.map((section) => (
            <div key={section.section}>
              <div className="sidebar-section-label">{section.section}</div>
              {section.items.map((item) => (
                <button
                  key={item.path}
                  className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
                  onClick={() => {
                    navigate(item.path);
                    onClose?.();
                  }}
                >
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-link" onClick={handleLogout}>
            <span style={{ fontSize: 16 }}>🚪</span>
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
