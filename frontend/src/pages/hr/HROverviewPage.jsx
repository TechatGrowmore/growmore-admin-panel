import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function StatCard({ label, value, sub, color = 'var(--accent)', icon }) {
  return (
    <div className="stat-card" style={{ '--card-accent': color }}>
      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        <div className="stat-card-icon" style={{ background: `${color}18`, color }}>{icon}</div>
      </div>
      <div className="stat-card-value">{value}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  );
}

export default function HROverviewPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, pending: 0, verified: 0, rejected: 0, parttime: 0, ptApproved: 0 });
  const [recentEmployees, setRecentEmployees] = useState([]);
  const [recentPartTime, setRecentPartTime] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [ftRes, ptRes] = await Promise.all([
          fetch('/api/employees/fulltime', { credentials: 'include' }),
          fetch('/api/employees/parttime', { credentials: 'include' }),
        ]);
        const ftData = ftRes.ok ? await ftRes.json() : { employees: [] };
        const ptData = ptRes.ok ? await ptRes.json() : { drivers: [] };
        const emps = ftData.employees || [];
        const pts = ptData.drivers || [];
        setStats({
          total: emps.length,
          pending: emps.filter(e => e.status === 'pending' || e.status === 'hr_approved').length,
          verified: emps.filter(e => e.status === 'verified').length,
          rejected: emps.filter(e => e.status === 'rejected').length,
          parttime: pts.length,
          ptApproved: pts.filter(p => p.status === 'approved').length,
        });
        setRecentEmployees(emps.slice(0, 5));
        setRecentPartTime(pts.slice(0, 5));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const statusBadge = (s) => {
    const map = {
      pending: ['badge-warning', 'Pending'],
      hr_approved: ['badge-info', 'Sent for Verification'],
      verified: ['badge-success', 'Verified'],
      rejected: ['badge-danger', 'Rejected'],
      approved: ['badge-success', 'Approved'],
    };
    const [cls, label] = map[s] || ['badge-neutral', s];
    return <span className={`badge ${cls}`}>{label}</span>;
  };

  const today = new Date().toISOString().split('T')[0];
  const publicFTLink = `${window.location.origin}/register/fulltime`;
  const publicPTLink = `${window.location.origin}/register/parttime`;

  const copyLink = (url) => {
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  if (loading) return <div className="page-loading"><div className="spinner" /><span>Loading...</span></div>;

  return (
    <div>
      <div className="page-header" style={{ position: 'static', padding: '0 0 24px', borderBottom: 'none', background: 'transparent' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>HR Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
            Manage employees, registrations and schedules
          </p>
        </div>
        <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }}
          onClick={() => navigate('/hr/dashboard/employees')}>
          + Add Employee
        </button>
      </div>

      {/* Public registration links */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Full-Time Registration Form', link: publicFTLink, color: 'var(--accent)', desc: 'Share with full-time driver applicants' },
          { label: 'Part-Time Registration Form', link: publicPTLink, color: 'var(--amber)', desc: 'Share with part-time driver applicants' },
        ].map(({ label, link, color, desc }) => (
          <div key={label} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
            padding: 20, borderLeft: `4px solid ${color}`,
          }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4, color: 'var(--text-primary)' }}>{label}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>{desc}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input readOnly value={link} style={{
                flex: 1, padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: 'var(--text-secondary)', outline: 'none',
              }} />
              <button onClick={() => copyLink(link)} style={{
                padding: '6px 14px', background: color, color: 'white', border: 'none',
                borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
              }}>Copy</button>
            </div>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 28 }}>
        <StatCard label="Total FT Employees" value={stats.total} sub="full-time registered" color="var(--info)" icon="👥" />
        <StatCard label="Pending Verification" value={stats.pending} sub="awaiting accountant" color="var(--amber)" icon="⏳" />
        <StatCard label="Verified Employees" value={stats.verified} sub="active employees" color="var(--accent)" icon="✅" />
        <StatCard label="Part-Time Drivers" value={stats.ptApproved} sub={`${stats.parttime} total registered`} color="var(--purple)" icon="🚗" />
      </div>

      {/* Recent Full-Time */}
      <div className="data-table-container" style={{ marginBottom: 24 }}>
        <div className="data-table-header">
          <h3>Recent Full-Time Registrations</h3>
          <button className="btn-secondary btn-small" onClick={() => navigate('/hr/dashboard/employees')}>
            View All →
          </button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th><th>Phone</th><th>Designation</th><th>Submitted</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recentEmployees.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No employees yet</td></tr>
            ) : recentEmployees.map(emp => (
              <tr key={emp.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/hr/dashboard/employees?id=${emp.id}`)}>
                <td><strong>{emp.firstName} {emp.lastName}</strong></td>
                <td>{emp.phone}</td>
                <td>{emp.designation || 'Driver'}</td>
                <td style={{ fontSize: '0.78rem' }}>{new Date(emp.createdAt).toLocaleDateString('en-IN')}</td>
                <td>{statusBadge(emp.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent Part-Time */}
      <div className="data-table-container">
        <div className="data-table-header">
          <h3>Recent Part-Time Driver Registrations</h3>
          <button className="btn-secondary btn-small" onClick={() => navigate('/hr/dashboard/parttime')}>
            View All →
          </button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th><th>Phone</th><th>Submitted</th><th>Status</th><th>Punch Link</th>
            </tr>
          </thead>
          <tbody>
            {recentPartTime.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No part-time drivers yet</td></tr>
            ) : recentPartTime.map(d => (
              <tr key={d.id}>
                <td><strong>{d.firstName} {d.lastName}</strong></td>
                <td>{d.phone}</td>
                <td style={{ fontSize: '0.78rem' }}>{new Date(d.createdAt).toLocaleDateString('en-IN')}</td>
                <td>{statusBadge(d.status)}</td>
                <td>
                  {d.punchToken ? (
                    <button onClick={() => copyLink(`${window.location.origin}/punchin/${d.punchToken}`)}
                      style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'var(--accent-glow)', color: 'var(--accent)',
                        border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                      Copy Link
                    </button>
                  ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
