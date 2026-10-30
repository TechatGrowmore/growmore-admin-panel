import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useHRAuth } from '../../context/HRAuthContext';
import growmoreLogo from '../../assets/Growmore-logo.jpg';

const NAV_HR = [
  { path: '/hr/dashboard', label: 'Overview', icon: 'home' },
  { path: '/hr/dashboard/employees', label: 'Full-Time Employees', icon: 'users' },
  { path: '/hr/dashboard/parttime', label: 'Part-Time Drivers', icon: 'car' },
  { path: '/hr/dashboard/calendar', label: 'Schedule Calendar', icon: 'calendar' },
];

const NAV_ACCOUNTANT = [
  { path: '/accountant/dashboard', label: 'Overview', icon: 'home' },
  { path: '/accountant/dashboard/verification', label: 'Verification Queue', icon: 'check-circle' },
  { path: '/accountant/dashboard/employees', label: 'Drivers & Supervisors', icon: 'users' },
  { path: '/accountant/dashboard/calendar', label: 'Schedule Calendar', icon: 'calendar' },
  { path: '/accountant/dashboard/attendance', label: 'Attendance', icon: 'clock' },
  { path: '/accountant/dashboard/leaves', label: 'Leave Requests', icon: 'calendar' },
  { path: '/accountant/dashboard/bookings', label: 'Bookings', icon: 'book' },
  { path: '/accountant/dashboard/revenue', label: 'Revenue', icon: 'trending-up' },
  { path: '/accountant/dashboard/transactions', label: 'Transactions', icon: 'credit-card' },
];

function SvgIcon({ name, size = 18 }) {
  const icons = {
    home: <><rect x="3" y="9" width="18" height="13" rx="1" /><polyline points="3 9 12 2 21 9" /></>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    car: <><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
    'check-circle': <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>,
    'trending-up': <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>,
    'credit-card': <><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
    menu: <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
}

export default function HRLayout({ isAccountant = false }) {
  const { user, setUser } = useHRAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const nav = isAccountant ? NAV_ACCOUNTANT : NAV_HR;

  const handleLogout = async () => {
    await fetch('/api/hr/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    navigate('/hr/login');
  };

  return (
    <div className="dashboard-layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #2DB84B, #F5A623)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 800, color: 'white',
            }}>G</div>
            <div>
              <h2>{isAccountant ? 'Accountant' : 'HR Portal'}</h2>
              <span>GrowMore Parking</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">
            {isAccountant ? 'Accountant Menu' : 'HR Menu'}
          </div>
          {nav.map(item => (
            <button
              key={item.path}
              className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => { navigate(item.path); setSidebarOpen(false); }}
            >
              <SvgIcon name={item.icon} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.name}</div>
              <div className="sidebar-user-role">{user?.role?.toUpperCase()}</div>
            </div>
          </div>
          <button className="sidebar-link" onClick={handleLogout} style={{ color: 'var(--danger)', marginTop: 4 }}>
            <SvgIcon name="logout" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        <header className="page-header">
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <SvgIcon name="menu" size={22} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={growmoreLogo} alt="GrowMore" style={{ height: 32, objectFit: 'contain', borderRadius: 6, background: '#fff', padding: '2px 6px' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {isAccountant ? 'Accountant Dashboard' : 'HR Dashboard'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              background: 'var(--accent-glow)', color: 'var(--accent)',
              padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
            }}>
              {user?.name}
            </div>
          </div>
        </header>
        <div className="page-body">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
