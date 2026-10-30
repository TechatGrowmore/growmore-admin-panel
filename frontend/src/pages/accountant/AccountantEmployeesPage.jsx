import { useState, useEffect } from 'react';

export default function AccountantEmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [partTime, setPartTime] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('fulltime'); // 'fulltime' | 'parttime' | 'supervisors'
  const [search, setSearch] = useState('');
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [empPunches, setEmpPunches] = useState([]);
  const [empLeaves, setEmpLeaves] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [ftRes, ptRes, supRes] = await Promise.all([
        fetch('/api/employees/fulltime', { credentials: 'include' }),
        fetch('/api/employees/parttime', { credentials: 'include' }),
        fetch('/api/employees/supervisors', { credentials: 'include' }),
      ]);
      if (ftRes.ok) { const d = await ftRes.json(); setEmployees(d.employees || []); }
      if (ptRes.ok) { const d = await ptRes.json(); setPartTime(d.drivers || []); }
      if (supRes.ok) { const d = await supRes.json(); setSupervisors(d.supervisors || []); }
      setLoading(false);
    };
    load();
  }, []);

  const viewEmployee = async (emp) => {
    setSelectedEmp(emp); setDetailLoading(true);
    const [pRes, lRes] = await Promise.all([
      fetch(`/api/employees/punches/fulltime/${emp.id}`, { credentials: 'include' }),
      fetch(`/api/employees/leaves?employeeId=${emp.id}`, { credentials: 'include' }),
    ]);
    if (pRes.ok) { const d = await pRes.json(); setEmpPunches(d.punches || []); }
    if (lRes.ok) { const d = await lRes.json(); setEmpLeaves(d.leaves || []); }
    setDetailLoading(false);
  };

  const filter = (arr, nameKey = 'firstName') => {
    if (!search) return arr;
    return arr.filter(e => {
      const name = nameKey === 'name' ? (e.name || '').toLowerCase() : `${e[nameKey] || ''} ${e.lastName || ''}`.toLowerCase();
      return name.includes(search.toLowerCase()) || (e.phone || '').includes(search) || (e.username || '').toLowerCase().includes(search.toLowerCase());
    });
  };

  const statusBadge = (s) => {
    const m = { pending: ['badge-warning','Pending'], hr_approved: ['badge-info','Sent for Verification'], verified: ['badge-success','Verified'], rejected: ['badge-danger','Rejected'], approved: ['badge-success','Approved'] };
    const [cls, label] = m[s] || ['badge-neutral', s];
    return <span className={`badge ${cls}`}>{label}</span>;
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Registered Drivers &amp; Supervisors</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>View-only: drivers and operational supervisors directory</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { key: 'fulltime', label: `👤 Full-Time Drivers (${employees.length})` },
          { key: 'parttime', label: `🚗 Part-Time Drivers (${partTime.length})` },
          { key: 'supervisors', label: `👔 Supervisors (${supervisors.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={tab === t.key ? 'btn-primary' : 'btn-secondary'}
            style={{ width: 'auto', padding: '8px 20px' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="data-table-container">
        <div className="data-table-header">
          <input className="filter-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search by name, phone, or username..." style={{ minWidth: 260 }} />
        </div>
        <table className="data-table">
          <thead>
            {tab === 'fulltime' && (
              <tr><th>#</th><th>Name</th><th>Phone</th><th>Designation</th><th>Status</th><th>Action</th></tr>
            )}
            {tab === 'parttime' && (
              <tr><th>#</th><th>Name</th><th>Phone</th><th>Aadhar Doc</th><th>Status</th></tr>
            )}
            {tab === 'supervisors' && (
              <tr><th>#</th><th>Name</th><th>Username</th><th>Phone</th><th>Assigned Sites</th><th>Status</th></tr>
            )}
          </thead>
          <tbody>
            {tab === 'fulltime' && filter(employees).map((emp, i) => (
              <tr key={emp.id}>
                <td>{i + 1}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {emp.photoUrl ? (
                      <img src={emp.photoUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-glow)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                        {emp.firstName?.[0]}
                      </div>
                    )}
                    <strong>{emp.firstName} {emp.lastName}</strong>
                  </div>
                </td>
                <td>{emp.phone}</td>
                <td>{emp.designation || 'Driver'}</td>
                <td>{statusBadge(emp.status)}</td>
                <td><button className="btn-secondary btn-small" onClick={() => viewEmployee(emp)}>View History</button></td>
              </tr>
            ))}
            {tab === 'parttime' && filter(partTime).map((d, i) => (
              <tr key={d.id}>
                <td>{i + 1}</td>
                <td><strong>{d.firstName} {d.lastName}</strong></td>
                <td>{d.phone}</td>
                <td>{d.aadharDocUrl ? <a href={d.aadharDocUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: '0.8rem' }}>View ↗</a> : '—'}</td>
                <td>{statusBadge(d.status)}</td>
              </tr>
            ))}
            {tab === 'supervisors' && filter(supervisors, 'name').map((s, i) => (
              <tr key={s.id || s._id}>
                <td>{i + 1}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--purple)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                      {s.name?.[0]?.toUpperCase()}
                    </div>
                    <strong>{s.name}</strong>
                  </div>
                </td>
                <td><code style={{ fontSize: '0.85rem' }}>{s.username}</code></td>
                <td>{s.phone || '—'}</td>
                <td>
                  {s.allSites ? (
                    <span className="badge badge-info">All Sites</span>
                  ) : s.assignedClients && s.assignedClients.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {s.assignedClients.map(c => (
                        <span key={c._id || c.id} className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                          {c.name || c.code}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>None assigned</span>
                  )}
                </td>
                <td>
                  <span className={`badge ${s.isActive ? 'badge-success' : 'badge-danger'}`}>
                    {s.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedEmp && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedEmp(null)}>
          <div className="modal-content" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h2>{selectedEmp.firstName} {selectedEmp.lastName} — History</h2>
              <button className="modal-close" onClick={() => setSelectedEmp(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {detailLoading ? <div className="page-loading"><div className="spinner" /></div> : (
                <>
                  <div style={{ fontWeight: 700, marginBottom: 12 }}>📍 Punch Records ({empPunches.length})</div>
                  {empPunches.slice(0, 20).map(p => (
                    <div key={p.id} style={{ display: 'flex', gap: 14, padding: '10px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                      {p.photoUrl && <img src={p.photoUrl} alt="" onClick={() => window.open(p.photoUrl, '_blank')} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', cursor: 'pointer', flexShrink: 0 }} />}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                          {new Date(p.date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          {p.punchInTime ? new Date(p.punchInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''} · {p.location?.address || ''}
                        </div>
                      </div>
                      <span className={`badge badge-${p.status === 'present' ? 'success' : p.status === 'leave' ? 'info' : 'danger'}`}>{p.status}</span>
                    </div>
                  ))}
                  {empPunches.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No punch records</p>}
                  <div style={{ fontWeight: 700, marginTop: 20, marginBottom: 12 }}>📋 Leave Records ({empLeaves.length})</div>
                  {empLeaves.slice(0, 15).map(l => (
                    <div key={l.id} style={{ display: 'flex', gap: 14, padding: '10px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                          {new Date(l.date + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{l.reason || '—'}</div>
                      </div>
                      <span className={`badge badge-${l.status === 'approved' ? 'success' : l.status === 'rejected' ? 'danger' : 'warning'}`}>{l.status}</span>
                    </div>
                  ))}
                  {empLeaves.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No leave records</p>}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
