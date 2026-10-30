import { useState, useEffect } from 'react';

export default function AccountantVerificationPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [rejectModal, setRejectModal] = useState(null);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState('success');

  const showToast = (msg, type = 'success') => { setToast(msg); setToastType(type); setTimeout(() => setToast(''), 4000); };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/employees/fulltime?status=hr_approved', { credentials: 'include' });
      const data = res.ok ? await res.json() : { employees: [] };
      setEmployees(data.employees || []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleVerify = async (id) => {
    const res = await fetch(`/api/employees/fulltime/${id}/verify`, { method: 'POST', credentials: 'include' });
    if (res.ok) { showToast('✅ Employee verified successfully! Login credentials enabled.'); setSelectedEmp(null); load(); }
    else { const d = await res.json(); showToast(d.message || 'Failed', 'error'); }
  };

  const handleReject = async () => {
    if (!remarks.trim()) { showToast('Please provide rejection remarks', 'error'); return; }
    const res = await fetch(`/api/employees/fulltime/${rejectModal}/reject`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks }),
    });
    if (res.ok) { showToast('Employee registration rejected'); setRejectModal(null); setRemarks(''); load(); }
  };

  if (loading) return <div className="page-loading"><div className="spinner" /><span>Loading...</span></div>;

  return (
    <div>
      {toast && <div className="toast-container"><div className={`toast toast-${toastType}`}>{toast}</div></div>}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Verification Queue</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Review and verify full-time employee registrations submitted by HR</p>
      </div>

      {employees.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h3>All clear!</h3>
          <p>No employee registrations pending verification.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {employees.map(emp => (
            <div key={emp.id} className="chart-card" style={{ borderLeft: '4px solid var(--amber)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
                {emp.photoUrl ? (
                  <img src={emp.photoUrl} alt="profile" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: 12, background: 'var(--accent-glow)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, flexShrink: 0 }}>
                    {emp.firstName?.[0]}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{emp.firstName} {emp.lastName}</h3>
                    <span className="badge badge-warning">Pending Verification</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                    {[
                      ['📱 Phone', emp.phone],
                      ['📧 Email', emp.email || '—'],
                      ['🏠 Address', [emp.city, emp.state].filter(Boolean).join(', ') || '—'],
                      ['🪪 Aadhar', emp.aadharNumber || '—'],
                      ['📄 PAN', emp.panNumber || '—'],
                      ['💼 Designation', emp.designation || 'Driver'],
                      ['🏢 Dept', emp.department || '—'],
                      ['💰 Salary', emp.salary ? `₹${emp.salary.toLocaleString('en-IN')}` : '—'],
                      ['📅 Joining', emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString('en-IN') : '—'],
                      ['📝 Declaration', emp.declarationAccepted ? '✅ Accepted' : '❌ Not accepted'],
                    ].map(([label, val]) => (
                      <div key={label} style={{ background: 'var(--bg-input)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: 2 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  {/* Document links */}
                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    {emp.aadharDocUrl && <a href={emp.aadharDocUrl} target="_blank" rel="noreferrer" className="btn-secondary btn-small">View Aadhar Doc ↗</a>}
                    {emp.panDocUrl && <a href={emp.panDocUrl} target="_blank" rel="noreferrer" className="btn-secondary btn-small">View PAN Doc ↗</a>}
                    <button className="btn-secondary btn-small" onClick={() => setSelectedEmp(emp)}>View Full Details</button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => handleVerify(emp.id)} style={{
                    padding: '10px 20px', background: 'var(--accent)', color: 'white', border: 'none',
                    borderRadius: 'var(--radius-md)', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem',
                  }}>✅ Verify</button>
                  <button onClick={() => { setRejectModal(emp.id); setRemarks(''); }} style={{
                    padding: '10px 20px', background: 'var(--danger-bg)', color: 'var(--danger)',
                    border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem',
                  }}>❌ Reject</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 420 }}>
            <div className="modal-header"><h2>Reject Employee</h2><button className="modal-close" onClick={() => setRejectModal(null)}>✕</button></div>
            <div className="modal-body">
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                Please provide clear remarks explaining the reason for rejection. The HR team will be able to see this.
              </p>
              <div className="form-group">
                <label>Rejection Remarks *</label>
                <textarea className="form-input" rows={4} value={remarks} onChange={e => setRemarks(e.target.value)}
                  placeholder="e.g. Aadhar document is blurry, PAN number mismatch..." style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setRejectModal(null)}>Cancel</button>
              <button style={{ padding: '9px 20px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, cursor: 'pointer' }} onClick={handleReject}>
                Reject Registration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
