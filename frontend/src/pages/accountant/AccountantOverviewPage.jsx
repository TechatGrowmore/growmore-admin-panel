import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AccountantOverviewPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ pendingVerification: 0, verified: 0, parttime: 0, pendingLeaves: 0 });
  const [pendingVerification, setPendingVerification] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [ftRes, ptRes, leavesRes] = await Promise.all([
          fetch('/api/employees/fulltime', { credentials: 'include' }),
          fetch('/api/employees/parttime', { credentials: 'include' }),
          fetch('/api/employees/leaves?status=pending', { credentials: 'include' }),
        ]);
        const ftData = ftRes.ok ? await ftRes.json() : { employees: [] };
        const ptData = ptRes.ok ? await ptRes.json() : { drivers: [] };
        const leavesData = leavesRes.ok ? await leavesRes.json() : { leaves: [] };
        const emps = ftData.employees || [];
        const pending = emps.filter(e => e.status === 'hr_approved');
        setPendingVerification(pending.slice(0, 5));
        setStats({
          pendingVerification: pending.length,
          verified: emps.filter(e => e.status === 'verified').length,
          parttime: (ptData.drivers || []).filter(d => d.status === 'approved').length,
          pendingLeaves: (leavesData.leaves || []).length,
        });
      } catch { } finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="page-loading"><div className="spinner" /><span>Loading...</span></div>;

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Accountant Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>Verify employees, review attendance and leaves</p>
      </div>

      <div className="stats-grid" style={{ marginBottom: 28 }}>
        {[
          { label: 'Pending Verification', value: stats.pendingVerification, color: 'var(--amber)', icon: '⏳', path: '/accountant/dashboard/verification' },
          { label: 'Verified Employees', value: stats.verified, color: 'var(--accent)', icon: '✅', path: '/accountant/dashboard/employees' },
          { label: 'Active PT Drivers', value: stats.parttime, color: 'var(--purple)', icon: '🚗', path: '/accountant/dashboard/employees' },
          { label: 'Pending Leaves', value: stats.pendingLeaves, color: 'var(--info)', icon: '📋', path: '/accountant/dashboard/leaves' },
        ].map(({ label, value, color, icon, path }) => (
          <div key={label} className="stat-card" style={{ '--card-accent': color, cursor: 'pointer' }} onClick={() => navigate(path)}>
            <div className="stat-card-header">
              <span className="stat-card-label">{label}</span>
              <div className="stat-card-icon" style={{ background: `${color}18`, color }}>{icon}</div>
            </div>
            <div className="stat-card-value">{value}</div>
          </div>
        ))}
      </div>

      {/* Pending verification queue */}
      {pendingVerification.length > 0 && (
        <div className="data-table-container" style={{ marginBottom: 24 }}>
          <div className="data-table-header">
            <h3>⚡ Pending Verification</h3>
            <button className="btn-secondary btn-small" onClick={() => navigate('/accountant/dashboard/verification')}>
              View All →
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Phone</th><th>Aadhar</th><th>PAN</th><th>Submitted</th><th>Action</th></tr>
            </thead>
            <tbody>
              {pendingVerification.map(emp => (
                <tr key={emp.id}>
                  <td><strong>{emp.firstName} {emp.lastName}</strong></td>
                  <td>{emp.phone}</td>
                  <td>{emp.aadharNumber || '—'}</td>
                  <td>{emp.panNumber || '—'}</td>
                  <td style={{ fontSize: '0.78rem' }}>{new Date(emp.createdAt).toLocaleDateString('en-IN')}</td>
                  <td>
                    <button className="btn-secondary btn-small" onClick={() => navigate('/accountant/dashboard/verification')}>
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        {[
          { label: '📊 View Revenue', path: '/accountant/dashboard/revenue' },
          { label: '📋 View Bookings', path: '/accountant/dashboard/bookings' },
          { label: '💳 Transactions', path: '/accountant/dashboard/transactions' },
          { label: '🕐 Attendance Log', path: '/accountant/dashboard/attendance' },
        ].map(({ label, path }) => (
          <button key={path} onClick={() => navigate(path)} className="btn-secondary" style={{ padding: 20, height: 'auto', textAlign: 'center', fontWeight: 600 }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
