import { useState, useEffect } from 'react';
import LazyPhoto from '../../components/LazyPhoto';

function PartTimeModal({ driver, onClose, onSave }) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', email: '', aadharNumber: '', address: '', ...driver,
  });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    setLoading(true); setError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, v); });
      if (file) fd.append('aadharDoc', file);

      const url = driver?.id ? `/api/employees/parttime/${driver.id}` : '/api/employees/parttime';
      const method = driver?.id ? 'PUT' : 'POST';
      const res = await fetch(url, { method, credentials: 'include', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      onSave(data.driver);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2>{driver?.id ? 'Edit Part-Time Driver' : 'Register Part-Time Driver'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="login-error">{error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[['firstName','First Name *','text'],['lastName','Last Name *','text'],
              ['phone','Phone *','tel'],['email','Email','email'],
              ['aadharNumber','Aadhar Number','text'],['address','Address','text']].map(([name,label,type]) => (
              <div className="form-group" key={name} style={{ margin: 0, gridColumn: name === 'address' ? '1/-1' : 'auto' }}>
                <label>{label}</label>
                <input className="form-input" type={type} name={name} value={form[name]||''} onChange={handleChange} placeholder={label.replace(' *','')} />
              </div>
            ))}
            <div className="form-group" style={{ margin: 0, gridColumn: '1/-1' }}>
              <label>Aadhar Document (PDF/Image)</label>
              <input type="file" accept="image/*,application/pdf" onChange={e => setFile(e.target.files[0])}
                style={{ padding: 8, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', width: '100%', fontSize: '0.8rem' }} />
              {form.aadharDocUrl && (
                <a href={form.aadharDocUrl} target="_blank" rel="noreferrer"
                  style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: 4, display: 'block' }}>
                  View uploaded document ↗
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" style={{ width: 'auto', padding: '9px 20px' }} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : driver?.id ? 'Save Changes' : 'Register Driver'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HRPartTimePage() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [toast, setToast] = useState('');
  const [remarkModal, setRemarkModal] = useState(null);
  const [remarks, setRemarks] = useState('');

  const loadDrivers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      const res = await fetch(`/api/employees/parttime?${params}`, { credentials: 'include' });
      const data = res.ok ? await res.json() : { drivers: [] };
      setDrivers(data.drivers || []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { loadDrivers(); }, [search, statusFilter]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleApprove = async (id) => {
    const res = await fetch(`/api/employees/parttime/${id}/approve`, { method: 'POST', credentials: 'include' });
    const data = await res.json();
    if (res.ok) { showToast('Driver approved! Punch link generated.'); loadDrivers(); }
  };

  const handleReject = async () => {
    const res = await fetch(`/api/employees/parttime/${remarkModal}/reject`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks }),
    });
    if (res.ok) { showToast('Driver rejected'); setRemarkModal(null); setRemarks(''); loadDrivers(); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this driver?')) return;
    await fetch(`/api/employees/parttime/${id}`, { method: 'DELETE', credentials: 'include' });
    showToast('Driver deleted'); loadDrivers();
  };

  const copyLink = (token) => {
    navigator.clipboard.writeText(`${window.location.origin}/punchin/${token}`);
    showToast('Punch link copied!');
  };

  const statusBadge = (s) => {
    const map = { pending: ['badge-warning', 'Pending'], approved: ['badge-success', 'Approved'], rejected: ['badge-danger', 'Rejected'] };
    const [cls, label] = map[s] || ['badge-neutral', s];
    return <span className={`badge ${cls}`}>{label}</span>;
  };

  return (
    <div>
      {toast && <div className="toast-container"><div className="toast toast-success">{toast}</div></div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Part-Time Drivers</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Manage part-time driver registrations and punch links</p>
        </div>
        <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => { setSelectedDriver(null); setShowModal(true); }}>
          + Add Driver
        </button>
      </div>

      <div className="data-table-container">
        <div className="data-table-header">
          <input className="filter-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search..." style={{ minWidth: 220 }} />
          <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        {loading ? (
          <div className="page-loading"><div className="spinner" /><span>Loading...</span></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>Name</th><th>Phone</th><th>Aadhar</th><th>Photo</th><th>Status</th>
                <th>Registered</th><th>Punch Link</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {drivers.length === 0 ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>No drivers found</td></tr>
              ) : drivers.map((d, i) => (
                <tr key={d.id}>
                  <td>{i + 1}</td>
                  <td>
                    <strong>{d.firstName} {d.lastName}</strong>
                    {d.email && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{d.email}</div>}
                  </td>
                  <td>{d.phone}</td>
                  <td>{d.aadharDocUrl ? <a href={d.aadharDocUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: '0.8rem' }}>View Doc ↗</a> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td><LazyPhoto src={d.photoUrl} size={90} /></td>
                  <td>{statusBadge(d.status)}</td>
                  <td style={{ fontSize: '0.78rem' }}>{new Date(d.registrationDate || d.createdAt).toLocaleDateString('en-IN')}</td>
                  <td>
                    {d.punchToken ? (
                      <button onClick={() => copyLink(d.punchToken)} style={{
                        fontSize: '0.75rem', padding: '4px 10px',
                        background: 'var(--accent-glow)', color: 'var(--accent)',
                        border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      }}>📋 Copy Link</button>
                    ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn-secondary btn-small" onClick={() => { setSelectedDriver(d); setShowModal(true); }}>Edit</button>
                      {d.status === 'pending' && (
                        <>
                          <button onClick={() => handleApprove(d.id)} style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600 }}>Approve</button>
                          <button onClick={() => { setRemarkModal(d.id); setRemarks(''); }} style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600 }}>Reject</button>
                        </>
                      )}
                      <button className="btn-danger btn-small btn-secondary" onClick={() => handleDelete(d.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <PartTimeModal driver={selectedDriver} onClose={() => setShowModal(false)}
          onSave={(saved) => { showToast('Driver saved!'); setShowModal(false); loadDrivers(); }} />
      )}

      {remarkModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 400 }}>
            <div className="modal-header"><h2>Reject Driver</h2><button className="modal-close" onClick={() => setRemarkModal(null)}>✕</button></div>
            <div className="modal-body">
              <div className="form-group">
                <label>Rejection Remarks</label>
                <textarea className="form-input" rows={3} value={remarks} onChange={e => setRemarks(e.target.value)}
                  placeholder="Provide reason for rejection..." style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setRemarkModal(null)}>Cancel</button>
              <button className="btn-primary" style={{ width: 'auto', background: 'var(--danger)', padding: '9px 20px' }} onClick={handleReject}>Reject Driver</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
