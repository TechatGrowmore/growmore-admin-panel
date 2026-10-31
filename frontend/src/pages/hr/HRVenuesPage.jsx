import { useState, useEffect } from 'react';

export default function HRVenuesPage() {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', address: '' });
  const [editing, setEditing] = useState(null); // venue id being edited
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/employees/venues', { credentials: 'include' });
      const data = res.ok ? await res.json() : { venues: [] };
      setVenues(data.venues || []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const request = async (url, method, body) => {
    const res = await fetch(url, {
      method, credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (editing) {
        await request(`/api/employees/venues/${editing}`, 'PUT', form);
        showToast('Venue updated');
      } else {
        await request('/api/employees/venues', 'POST', form);
        showToast('Venue added');
      }
      setForm({ name: '', address: '' });
      setEditing(null);
      load();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const toggleActive = async (v) => {
    try { await request(`/api/employees/venues/${v.id}`, 'PUT', { active: !v.active }); load(); }
    catch (err) { setError(err.message); }
  };

  const remove = async (v) => {
    if (!window.confirm(`Delete venue "${v.name}"? A venue that was already assigned to drivers is only deactivated.`)) return;
    try {
      const data = await request(`/api/employees/venues/${v.id}`, 'DELETE');
      showToast(data.deactivated ? 'Venue is in use, so it was deactivated' : 'Venue deleted');
      load();
    } catch (err) { setError(err.message); }
  };

  return (
    <div>
      {toast && <div className="toast-container"><div className="toast toast-success">{toast}</div></div>}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Venues</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Add the venues part-time drivers can be assigned to from the Schedule Calendar</p>
      </div>

      <form onSubmit={save} className="chart-card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 14 }}>{editing ? 'Edit Venue' : 'Add Venue'}</h3>
        {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Venue Name *</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Phoenix Mall - Basement" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Address / Location</label>
            <input className="form-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Optional" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '9px 20px' }} disabled={saving}>
            {saving ? 'Saving...' : editing ? 'Save Changes' : '+ Add Venue'}
          </button>
          {editing && <button type="button" className="btn-secondary" onClick={() => { setEditing(null); setForm({ name: '', address: '' }); }}>Cancel</button>}
        </div>
      </form>

      <div className="data-table-container">
        {loading ? (
          <div className="page-loading"><div className="spinner" /><span>Loading...</span></div>
        ) : (
          <table className="data-table">
            <thead><tr><th>#</th><th>Venue</th><th>Address</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {venues.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No venues yet. Add your first venue above.</td></tr>
              ) : venues.map((v, i) => (
                <tr key={v.id}>
                  <td>{i + 1}</td>
                  <td><strong>{v.name}</strong></td>
                  <td style={{ fontSize: '0.82rem' }}>{v.address || '—'}</td>
                  <td><span className={`badge ${v.active ? 'badge-success' : 'badge-warning'}`}>{v.active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-secondary btn-small" onClick={() => { setEditing(v.id); setForm({ name: v.name, address: v.address || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
                      <button className="btn-secondary btn-small" onClick={() => toggleActive(v)}>{v.active ? 'Deactivate' : 'Activate'}</button>
                      <button className="btn-secondary btn-small" style={{ color: 'var(--danger)' }} onClick={() => remove(v)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
