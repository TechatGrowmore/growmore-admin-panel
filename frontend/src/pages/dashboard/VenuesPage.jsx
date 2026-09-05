import { useState, useEffect, useCallback } from 'react';
import ClientSwitcher from '../../components/ClientSwitcher';
import ManageModal from '../../components/ManageModal';

/* ── helpers ───────────────────────────────────────────────────────────────── */
function useToast() {
  const [toast, setToast] = useState(null);
  const show = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };
  return [toast, show];
}

function adminFetch(clientId, path, method = 'GET', body) {
  return fetch(`/api/proxy/${clientId}/admin${path}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function Field({ label, children, hint }) {
  return (
    <div className="form-group" style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

/* ── confirm dialog ────────────────────────────────────────────────────────── */
function ConfirmDialog({ message, onConfirm, onCancel, busy }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h2>Confirm Delete</h2>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            className="btn-primary"
            style={{ width: 'auto', padding: '10px 20px', background: 'var(--danger)', border: 'none' }}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  VENUE FORM                                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */
function VenueForm({ form, setForm }) {
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  /* parking spots as newline-separated textarea */
  const spotsText = (form.parkingSpots || []).join('\n');
  const handleSpots = (raw) => {
    const arr = raw.split('\n').map((s) => s.trim()).filter(Boolean);
    update('parkingSpots', arr);
  };

  return (
    <>
      <Field label="Venue Name *">
        <input
          className="form-input"
          value={form.name || ''}
          onChange={(e) => update('name', e.target.value)}
          placeholder="e.g. Main Parking, Rooftop Level 2"
        />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <Field label="Parking Fee (₹) *">
          <input
            className="form-input"
            type="number"
            min="0"
            value={form.parkingFee ?? ''}
            onChange={(e) => update('parkingFee', Number(e.target.value))}
            placeholder="e.g. 100"
          />
        </Field>
        <Field label="Upfront Payment Required">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textTransform: 'none', letterSpacing: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
              <input
                type="checkbox"
                checked={!!form.requiresUpfrontPayment}
                onChange={(e) => update('requiresUpfrontPayment', e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
              />
              Collect payment on entry
            </label>
          </div>
        </Field>
      </div>

      <Field
        label="Parking Spots (optional)"
        hint="Enter one spot label per line, e.g. A1, A2, B1 … Leave empty for automatic assignment."
      >
        <textarea
          className="form-input"
          rows={5}
          value={spotsText}
          onChange={(e) => handleSpots(e.target.value)}
          placeholder={'A1\nA2\nB1\nB2'}
          style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.82rem' }}
        />
      </Field>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  MAIN PAGE                                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */
export default function VenuesPage() {
  const [selectedClient, setSelectedClient] = useState(null);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState(null); // null | { mode, data? }
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const [confirm, setConfirm] = useState(null); // venue to delete
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [toast, showToast] = useToast();

  /* load clients */
  useEffect(() => {
    fetch('/api/clients', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const list = d.clients || [];
        if (list.length > 0) setSelectedClient(list[0].id);
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  /* fetch venues */
  const fetchVenues = useCallback(async () => {
    if (!selectedClient) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/proxy/${selectedClient}/venues`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setVenues(d.venues || []);
    } catch {
      setVenues([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClient]);

  useEffect(() => {
    if (selectedClient) fetchVenues();
  }, [selectedClient, fetchVenues]);

  /* open add */
  const openAdd = () => {
    setForm({ parkingFee: 100, requiresUpfrontPayment: false, parkingSpots: [] });
    setModal({ mode: 'add' });
  };

  /* open edit */
  const openEdit = (venue) => {
    setForm({
      name: venue.name,
      parkingFee: venue.parkingFee ?? 100,
      requiresUpfrontPayment: !!venue.requiresUpfrontPayment,
      parkingSpots: venue.parkingSpots || [],
    });
    setModal({ mode: 'edit', data: venue });
  };

  /* save */
  const handleSave = async () => {
    if (!form.name) { showToast('Venue name is required', 'error'); return; }
    if (form.parkingFee === '' || form.parkingFee === undefined) {
      showToast('Parking fee is required', 'error'); return;
    }
    setSaving(true);
    try {
      const isAdd = modal.mode === 'add';
      const path = isAdd ? '/venues' : `/venues/${modal.data._id}`;
      const method = isAdd ? 'POST' : 'PUT';
      const res = await adminFetch(selectedClient, path, method, form);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Save failed');
      showToast(isAdd ? 'Venue created ✓' : 'Venue updated ✓');
      setModal(null);
      fetchVenues();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  /* delete */
  const handleDelete = async () => {
    if (!confirm) return;
    setBusyId(confirm._id);
    setDeleting(true);
    setConfirm(null);
    try {
      const res = await adminFetch(selectedClient, `/venues/${confirm._id}`, 'DELETE');
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.message || 'Delete failed');
      }
      showToast('Venue deleted');
      fetchVenues();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusyId(null);
      setDeleting(false);
    }
  };

  return (
    <div className="page-body">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>Venues &amp; Locations</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.87rem' }}>
            Parking locations, spot capacity, and fee configurations
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <ClientSwitcher selectedClient={selectedClient} onSelect={setSelectedClient} showAll={false} />
          <button
            className="btn-primary"
            style={{ width: 'auto', padding: '10px 20px' }}
            onClick={openAdd}
          >
            + Add Venue
          </button>
        </div>
      </div>

      {loading ? (
        <div className="page-loading"><div className="spinner" /><span>Loading venues...</span></div>
      ) : venues.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 48, marginBottom: 12 }}>📍</div>
          <h3>No venues configured</h3>
          <p>Add your first parking venue using the button above</p>
        </div>
      ) : (
        <>
          {/* Venue Cards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20, marginBottom: 28 }}>
            {venues.map((v) => (
              <div
                key={v._id || v.name}
                className="client-card"
                style={{ cursor: 'default', position: 'relative' }}
              >
                {/* Active badge */}
                <div style={{ position: 'absolute', top: 16, right: 16 }}>
                  {v.isActive !== false ? (
                    <span className="badge badge-success">● Active</span>
                  ) : (
                    <span className="badge badge-danger">● Inactive</span>
                  )}
                </div>

                {/* Name + meta */}
                <div style={{ marginBottom: 16, paddingRight: 80 }}>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 4 }}>
                    📍 {v.name}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {v.supervisor?.name ? `Supervisor: ${v.supervisor.name}` : 'No supervisor assigned'}
                  </div>
                </div>

                {/* Stats grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Parking Fee</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent)' }}>₹{v.parkingFee || 0}</div>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Payment</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                      {v.requiresUpfrontPayment ? (
                        <span style={{ color: 'var(--warning)' }}>On Entry</span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>On Exit</span>
                      )}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Today's Bookings</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: v.todayBookings > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>{v.todayBookings || 0}</div>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Today's Revenue</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: (v.todayRevenue || 0) > 0 ? 'var(--success)' : 'var(--text-muted)' }}>₹{(v.todayRevenue || 0).toLocaleString('en-IN')}</div>
                  </div>
                </div>

                {/* Parking spots */}
                {v.parkingSpots?.length > 0 ? (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>
                      Parking Spots ({v.parkingSpots.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {v.parkingSpots.slice(0, 10).map((s) => (
                        <span
                          key={s}
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', fontSize: '0.72rem', fontFamily: 'monospace' }}
                        >
                          {s}
                        </span>
                      ))}
                      {v.parkingSpots.length > 10 && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', paddingTop: 2 }}>
                          +{v.parkingSpots.length - 10} more
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                    Auto spot assignment
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <button
                    className="btn-secondary btn-small"
                    style={{ flex: 1 }}
                    onClick={() => openEdit(v)}
                    disabled={busyId === v._id}
                  >
                    ✏️ Edit Venue
                  </button>
                  <button
                    className="btn-secondary btn-small btn-danger"
                    onClick={() => setConfirm(v)}
                    disabled={busyId === v._id}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add / Edit Modal */}
      {modal && (
        <ManageModal
          title={modal.mode === 'add' ? 'Add New Venue' : `Edit Venue — ${modal.data?.name}`}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
          saveLabel={modal.mode === 'add' ? 'Create Venue' : 'Update Venue'}
        >
          <VenueForm form={form} setForm={setForm} />
        </ManageModal>
      )}

      {/* Delete Confirm */}
      {confirm && (
        <ConfirmDialog
          message={`Delete venue "${confirm.name}"? All associated data may be affected. This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
          busy={deleting}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}
    </div>
  );
}
