import { useState, useEffect } from 'react';

export default function AccountantLeavesPage() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [remarkModal, setRemarkModal] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [toast, setToast] = useState('');

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await fetch(`/api/employees/leaves${params}`, { credentials: 'include' });
      const data = res.ok ? await res.json() : { leaves: [] };
      setLeaves(data.leaves || []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const handleUpdate = async (id, status) => {
    const res = await fetch(`/api/employees/leaves/${id}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, remarks: remarks || '' }),
    });
    if (res.ok) {
      showToast(`Leave ${status === 'approved' ? 'approved' : 'rejected'}`);
      setRemarkModal(null); setRemarks(''); load();
    }
  };

  const statusBadge = (s) => {
    const m = { pending: ['badge-warning','Pending'], approved: ['badge-success','Approved'], rejected: ['badge-danger','Rejected'], absent: ['badge-danger','Absent'] };
    const [cls, label] = m[s] || ['badge-neutral', s];
    return <span className={`badge ${cls}`}>{label}</span>;
  };

  return (
    <div>
      {toast && <div className="toast-container"><div className="toast toast-success">{toast}</div></div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Leave Requests</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Review and approve driver leave applications</p>
        </div>
        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Leaves</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="data-table-container">
        {loading ? (
          <div className="page-loading"><div className="spinner" /></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th><th>Date</th><th>Reason</th><th>Status</th><th>Remarks</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leaves.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>No leave records</td></tr>
              ) : leaves.map(l => (
                <tr key={l.id}>
                  <td>
                    <strong>{l.employee?.firstName} {l.employee?.lastName}</strong>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{l.employee?.phone}</div>
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {new Date(l.date + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ fontSize: '0.83rem', maxWidth: 200 }}>{l.reason || '—'}</td>
                  <td>{statusBadge(l.status)}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: 160 }}>{l.accountantRemarks || '—'}</td>
                  <td>
                    {l.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => handleUpdate(l.id, 'approved')}
                          style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600 }}>
                          Approve
                        </button>
                        <button onClick={() => { setRemarkModal(l.id); setRemarks(''); }}
                          style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600 }}>
                          Reject
                        </button>
                      </div>
                    )}
                    {l.status !== 'pending' && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        By {l.reviewedBy || 'Accountant'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {remarkModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 400 }}>
            <div className="modal-header"><h2>Reject Leave</h2><button className="modal-close" onClick={() => setRemarkModal(null)}>✕</button></div>
            <div className="modal-body">
              <div className="form-group">
                <label>Remarks (optional)</label>
                <textarea className="form-input" rows={3} value={remarks} onChange={e => setRemarks(e.target.value)}
                  placeholder="Reason for rejection..." style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setRemarkModal(null)}>Cancel</button>
              <button style={{ padding: '9px 20px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, cursor: 'pointer' }} onClick={() => handleUpdate(remarkModal, 'rejected')}>
                Reject Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
