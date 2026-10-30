import { useState, useEffect } from 'react';
import LazyPhoto from '../../components/LazyPhoto';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function DriverDetailModal({ emp, onClose }) {
  const [punches, setPunches] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('punches');

  useEffect(() => {
    const load = async () => {
      const [pRes, lRes] = await Promise.all([
        fetch(`/api/employees/punches/fulltime/${emp.id}`, { credentials: 'include' }),
        fetch(`/api/employees/leaves?employeeId=${emp.id}`, { credentials: 'include' }),
      ]);
      if (pRes.ok) { const d = await pRes.json(); setPunches(d.punches || []); }
      if (lRes.ok) { const d = await lRes.json(); setLeaves(d.leaves || []); }
      setLoading(false);
    };
    load();
  }, [emp.id]);

  const statusBadge = (s) => {
    const m = { present: ['badge-success','Present'], absent: ['badge-danger','Absent'], leave: ['badge-info','Leave'],
      pending: ['badge-warning','Pending'], approved: ['badge-success','Approved'], rejected: ['badge-danger','Rejected'] };
    const [cls, label] = m[s] || ['badge-neutral', s];
    return <span className={`badge ${cls}`}>{label}</span>;
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 700 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {emp.photoUrl && <img src={emp.photoUrl} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />}
            <div>
              <h2>{emp.firstName} {emp.lastName}</h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{emp.phone} · {emp.designation}</span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
          {['punches', 'leaves'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: '0.82rem', fontWeight: 600, textTransform: 'capitalize',
              borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`,
              color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
            }}>
              {t === 'punches' ? `📍 Punch History (${punches.length})` : `📋 Leaves (${leaves.length})`}
            </button>
          ))}
        </div>

        <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          {loading ? <div className="page-loading"><div className="spinner" /></div> : (
            tab === 'punches' ? (
              punches.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>No punch records yet</div>
              ) : punches.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                      {new Date(p.date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 3 }}>
                      {p.punchInTime ? `In: ${new Date(p.punchInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}
                      {p.location?.address && ` · 📍 ${p.location.address}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    {statusBadge(p.status)}
                    <LazyPhoto src={p.photoUrl} />
                  </div>
                </div>
              ))
            ) : (
              leaves.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>No leave records</div>
              ) : leaves.map(l => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                      {new Date(l.date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    {l.reason && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 3 }}>Reason: {l.reason}</div>}
                    {l.accountantRemarks && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>Remarks: {l.accountantRemarks}</div>}
                  </div>
                  <div>{statusBadge(l.status)}</div>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default function AccountantAttendancePage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(today.toISOString().split('T')[0]);
  const [punches, setPunches] = useState([]);
  const [ptPunches, setPtPunches] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);

  const loadDatePunches = async (date) => {
    setLoading(true);
    try {
      const [pRes, ptRes] = await Promise.all([
        fetch(`/api/employees/punches/date/${date}`, { credentials: 'include' }),
        fetch(`/api/employees/punches/parttime/date/${date}`, { credentials: 'include' }),
      ]);
      if (pRes.ok) { const d = await pRes.json(); setPunches(d.punches || []); }
      if (ptRes.ok) { const d = await ptRes.json(); setPtPunches(d.punches || []); }
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => {
    fetch('/api/employees/fulltime?status=verified', { credentials: 'include' })
      .then(r => r.json()).then(d => setAllEmployees(d.employees || []));
  }, []);

  useEffect(() => { loadDatePunches(selectedDate); }, [selectedDate]);

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayStr = today.toISOString().split('T')[0];
  const punchedIds = new Set(punches.map(p => p.employee?.id || p.employee));
  const absentFT = allEmployees.filter(e => !punchedIds.has(e.id));

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Attendance</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>View daily punch-in records and attendance</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 24, alignItems: 'flex-start' }}>
        {/* Mini calendar */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button className="btn-secondary btn-small" onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }}>‹</button>
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{MONTHS[month-1]} {year}</span>
            <button className="btn-secondary btn-small" onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }}>›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {DAYS.map(d => <div key={d} style={{ padding: '6px 2px', textAlign: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>{d}</div>)}
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} style={{ padding: '8px 2px' }} />;
              const ds = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const isSelected = ds === selectedDate;
              const isToday = ds === todayStr;
              return (
                <div key={day} onClick={() => setSelectedDate(ds)}
                  style={{
                    padding: '8px 2px', textAlign: 'center', cursor: 'pointer', fontSize: '0.82rem', fontWeight: isSelected || isToday ? 700 : 400,
                    background: isSelected ? 'var(--accent)' : isToday ? 'var(--accent-glow)' : 'transparent',
                    color: isSelected ? 'white' : isToday ? 'var(--accent)' : 'var(--text-primary)',
                    borderRadius: 6, margin: 2,
                  }}>
                  {day}
                </div>
              );
            })}
          </div>
        </div>

        {/* Day attendance */}
        <div>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 16 }}>
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>

          {loading ? <div className="page-loading"><div className="spinner" /></div> : (
            <>
              {/* Full-time punches */}
              <div className="data-table-container" style={{ marginBottom: 16 }}>
                <div className="data-table-header">
                  <h3>👤 Full-Time — {punches.length} Punched In</h3>
                </div>
                <table className="data-table">
                  <thead><tr><th>Employee</th><th>Punch-in</th><th>Photo</th><th>Location</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {punches.length === 0 ? (
                      <tr><td colSpan="6" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No punch-ins</td></tr>
                    ) : punches.map(p => (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.employee?.firstName} {p.employee?.lastName}</strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.employee?.phone}</div>
                        </td>
                        <td style={{ fontSize: '0.82rem' }}>{p.punchInTime ? new Date(p.punchInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td><LazyPhoto src={p.photoUrl} size={90} /></td>
                        <td style={{ fontSize: '0.75rem', maxWidth: 180 }}>{p.location?.address || (p.location?.lat ? `${p.location.lat.toFixed(4)}, ${p.location.lng.toFixed(4)}` : '—')}</td>
                        <td><span className="badge badge-success">Present</span></td>
                        <td><button className="btn-secondary btn-small" onClick={() => setSelectedEmp(p.employee)}>History</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Absent FT */}
              {absentFT.length > 0 && (
                <div className="data-table-container" style={{ marginBottom: 16 }}>
                  <div className="data-table-header"><h3>❌ Absent / No Punch — {absentFT.length}</h3></div>
                  <table className="data-table">
                    <thead><tr><th>Employee</th><th>Phone</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>
                      {absentFT.map(e => (
                        <tr key={e.id}>
                          <td><strong>{e.firstName} {e.lastName}</strong></td>
                          <td>{e.phone}</td>
                          <td><span className="badge badge-danger">Absent</span></td>
                          <td><button className="btn-secondary btn-small" onClick={() => setSelectedEmp(e)}>History</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Part-time punches */}
              {ptPunches.length > 0 && (
                <div className="data-table-container">
                  <div className="data-table-header"><h3>🚗 Part-Time — {ptPunches.length} Punched</h3></div>
                  <table className="data-table">
                    <thead><tr><th>Driver</th><th>Punch In</th><th>Punch Out</th><th>In Photo</th><th>Out Photo</th><th>Location</th></tr></thead>
                    <tbody>
                      {ptPunches.map(p => (
                        <tr key={p.id}>
                          <td><strong>{p.driver?.firstName} {p.driver?.lastName}</strong><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.driver?.phone}</div></td>
                          <td>{p.punchInTime ? new Date(p.punchInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                          <td>{p.punchOutTime ? new Date(p.punchOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : <span style={{ color: 'var(--text-muted)' }}>Not out yet</span>}</td>
                          <td><LazyPhoto src={p.punchInPhotoUrl} size={90} /></td>
                          <td><LazyPhoto src={p.punchOutPhotoUrl} size={90} /></td>
                          <td style={{ fontSize: '0.75rem' }}>
                            <div>In: {p.location?.address || '—'}</div>
                            {p.punchOutLocation?.address && <div>Out: {p.punchOutLocation.address}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selectedEmp && <DriverDetailModal emp={selectedEmp} onClose={() => setSelectedEmp(null)} />}
    </div>
  );
}
