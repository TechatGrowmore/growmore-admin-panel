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

/* ── field group helpers ──────────────────────────────────────────────────── */
function Field({ label, children }) {
  return (
    <div className="form-group" style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        {label}
      </label>
      {children}
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

/* ── staff stat card ───────────────────────────────────────────────────────── */
function StatCard({ accent, icon, label, value, sub }) {
  return (
    <div className="stat-card" style={{ '--card-accent': accent }}>
      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        <div className="stat-card-icon">{icon}</div>
      </div>
      <div className="stat-card-value">{value}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  DRIVER FORM                                                                */
/* ─────────────────────────────────────────────────────────────────────────── */
function DriverForm({ form, setForm, venues, supervisors, isEdit }) {
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <Field label="Full Name *">
          <input className="form-input" value={form.name || ''} onChange={(e) => update('name', e.target.value)} placeholder="Driver name" />
        </Field>
        <Field label="Phone *">
          <input className="form-input" value={form.phone || ''} onChange={(e) => update('phone', e.target.value)} placeholder="+91 XXXXX XXXXX" />
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <Field label={isEdit ? 'Username (read-only)' : 'Username *'}>
          <input className="form-input" value={form.username || ''} onChange={(e) => update('username', e.target.value)} placeholder="Login username" disabled={isEdit} style={{ opacity: isEdit ? 0.5 : 1 }} />
        </Field>
        <Field label={isEdit ? 'New Password (optional)' : 'Password *'}>
          <input className="form-input" type="password" value={form.password || ''} onChange={(e) => update('password', e.target.value)} placeholder={isEdit ? 'Leave blank to keep current' : 'Set password'} />
        </Field>
      </div>
      <Field label="Assigned Venue">
        <select className="form-input" value={form.venueId || ''} onChange={(e) => update('venueId', e.target.value)}>
          <option value="">— No Venue —</option>
          {venues.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
        </select>
      </Field>
      <Field label="Supervisor">
        <select className="form-input" value={form.supervisorId || ''} onChange={(e) => update('supervisorId', e.target.value)}>
          <option value="">— No Supervisor —</option>
          {supervisors.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
        </select>
      </Field>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  SUPERVISOR FORM                                                            */
/* ─────────────────────────────────────────────────────────────────────────── */
function SupervisorForm({ form, setForm, venues, isEdit }) {
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <Field label="Full Name *">
          <input className="form-input" value={form.name || ''} onChange={(e) => update('name', e.target.value)} placeholder="Supervisor name" />
        </Field>
        <Field label="Phone *">
          <input className="form-input" value={form.phone || ''} onChange={(e) => update('phone', e.target.value)} placeholder="+91 XXXXX XXXXX" />
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <Field label={isEdit ? 'Username (read-only)' : 'Username *'}>
          <input className="form-input" value={form.username || ''} onChange={(e) => update('username', e.target.value)} placeholder="Login username" disabled={isEdit} style={{ opacity: isEdit ? 0.5 : 1 }} />
        </Field>
        <Field label={isEdit ? 'New Password (optional)' : 'Password *'}>
          <input className="form-input" type="password" value={form.password || ''} onChange={(e) => update('password', e.target.value)} placeholder={isEdit ? 'Leave blank to keep current' : 'Set password'} />
        </Field>
      </div>
      <Field label="Assigned Venue">
        <select className="form-input" value={form.venueId || ''} onChange={(e) => update('venueId', e.target.value)}>
          <option value="">— No Venue —</option>
          {venues.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
        </select>
      </Field>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  STAFF TABLE                                                                */
/* ─────────────────────────────────────────────────────────────────────────── */
function StaffTable({ staff, roleBadge, onEdit, onDelete, busyId, extraColumns = [] }) {
  if (staff.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '40px 20px' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>👤</div>
        <h3>No records yet</h3>
        <p>Use the Add button above to create one</p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Phone</th>
            {extraColumns.map((c) => <th key={c}>{c}</th>)}
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((m) => (
            <tr key={m._id}>
              <td>
                <strong>{m.name}</strong>
                {m.username && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>@{m.username}</div>
                )}
              </td>
              <td>{roleBadge}</td>
              <td>{m.phone || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
              {extraColumns.map((col) => (
                <td key={col}>
                  {col === 'Venue' && (m.venue?.name || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>)}
                  {col === 'Supervisor' && (m.supervisor?.name || <span style={{ color: 'var(--text-muted)' }}>—</span>)}
                  {col === "Today's Bookings" && (
                    <strong style={{ color: m.todayBookings > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                      {m.todayBookings || 0}
                    </strong>
                  )}
                </td>
              ))}
              <td>
                {m.isActive !== false ? (
                  <span className="badge badge-success">Active</span>
                ) : (
                  <span className="badge badge-danger">Inactive</span>
                )}
              </td>
              <td>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn-secondary btn-small"
                    onClick={() => onEdit(m)}
                    disabled={busyId === m._id}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    className="btn-secondary btn-small btn-danger"
                    onClick={() => onDelete(m)}
                    disabled={busyId === m._id}
                  >
                    🗑
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  MAIN PAGE                                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */
export default function TeamPage() {
  const [selectedClient, setSelectedClient] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('driver'); // 'driver' | 'supervisor' | 'manager'

  /* modal state */
  const [modal, setModal] = useState(null); // null | { mode:'add'|'edit', role:'driver'|'supervisor', data? }
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  /* confirm delete */
  const [confirm, setConfirm] = useState(null); // { role, member }
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

  /* fetch team data */
  const fetchTeam = useCallback(async () => {
    if (!selectedClient) return;
    setLoading(true);
    try {
      const [teamRes, venueRes] = await Promise.all([
        fetch(`/api/proxy/${selectedClient}/users`, { credentials: 'include' }),
        fetch(`/api/proxy/${selectedClient}/venues`, { credentials: 'include' }),
      ]);
      if (teamRes.ok) setTeamData(await teamRes.json());
      if (venueRes.ok) {
        const vd = await venueRes.json();
        setVenues(vd.venues || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedClient]);

  useEffect(() => {
    if (selectedClient) fetchTeam();
  }, [selectedClient, fetchTeam]);

  /* open add */
  const openAdd = (role) => {
    setForm({});
    setModal({ mode: 'add', role });
  };

  /* open edit */
  const openEdit = (role, member) => {
    setForm({
      name: member.name,
      phone: member.phone,
      username: member.username,
      venueId: member.venue?._id || member.venueId || '',
      supervisorId: member.supervisor?._id || member.supervisorId || '',
    });
    setModal({ mode: 'edit', role, data: member });
  };

  /* save (add or edit) */
  const handleSave = async () => {
    if (!form.name || !form.phone) {
      showToast('Name and phone are required', 'error');
      return;
    }
    const isAdd = modal.mode === 'add';
    if (isAdd && (!form.username || !form.password)) {
      showToast('Username and password are required for new staff', 'error');
      return;
    }

    setSaving(true);
    try {
      const { role, data } = modal;
      const plural = role === 'driver' ? 'drivers' : 'supervisors';
      const body = { ...form };
      if (!body.password) delete body.password;

      const path = isAdd ? `/${plural}` : `/${plural}/${data._id}`;
      const method = isAdd ? 'POST' : 'PUT';

      const res = await adminFetch(selectedClient, path, method, body);
      const json = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(json.message || 'Save failed');

      showToast(isAdd ? `${role} added ✓` : `${role} updated ✓`);
      setModal(null);
      fetchTeam();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  /* delete */
  const handleDelete = async () => {
    if (!confirm) return;
    const { role, member } = confirm;
    const plural = role === 'driver' ? 'drivers' : 'supervisors';
    setBusyId(member._id);
    setDeleting(true);
    setConfirm(null);
    try {
      const res = await adminFetch(selectedClient, `/${plural}/${member._id}`, 'DELETE');
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.message || 'Delete failed');
      }
      showToast(`${role} deleted`);
      fetchTeam();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusyId(null);
      setDeleting(false);
    }
  };

  const drivers = teamData?.drivers || [];
  const supervisors = teamData?.supervisors || [];
  const managers = teamData?.managers || [];

  const tabs = [
    { key: 'driver', label: `Drivers (${drivers.length})`, icon: '🚗' },
    { key: 'supervisor', label: `Supervisors (${supervisors.length})`, icon: '👔' },
    { key: 'manager', label: `Managers (${managers.length})`, icon: '👑' },
  ];

  return (
    <div className="page-body">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>Team &amp; Staff</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.87rem' }}>
            Add, edit, and manage drivers, supervisors, and managers
          </p>
        </div>
        <ClientSwitcher selectedClient={selectedClient} onSelect={setSelectedClient} showAll={false} />
      </div>

      {loading ? (
        <div className="page-loading"><div className="spinner" /><span>Loading staff...</span></div>
      ) : !teamData ? (
        <div className="empty-state">
          <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
          <h3>No team data available</h3>
          <p>Select a valid client to view staff members</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            <StatCard accent="#3B82F6" icon={<span style={{ background: 'var(--info-bg)', color: 'var(--info)', width: 36, height: 36, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🚗</span>} label="Drivers" value={drivers.length} sub="registered drivers" />
            <StatCard accent="#8B5CF6" icon={<span style={{ background: 'var(--purple-bg)', color: 'var(--purple)', width: 36, height: 36, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👔</span>} label="Supervisors" value={supervisors.length} sub="shift supervisors" />
            <StatCard accent="#FF6B35" icon={<span style={{ background: 'var(--accent-glow)', color: 'var(--accent)', width: 36, height: 36, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👑</span>} label="Managers" value={managers.length} sub="venue managers" />
          </div>

          {/* Tab Bar + Add Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div className="chart-card" style={{ marginBottom: 0, padding: '4px', display: 'flex' }}>
              <div className="chart-tabs" style={{ gap: 2 }}>
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    className={`chart-tab ${activeTab === t.key ? 'active' : ''}`}
                    onClick={() => setActiveTab(t.key)}
                    style={{ padding: '8px 18px' }}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>

            {activeTab !== 'manager' && (
              <button
                className="btn-primary"
                style={{ width: 'auto', padding: '10px 20px' }}
                onClick={() => openAdd(activeTab)}
              >
                + Add {activeTab === 'driver' ? 'Driver' : 'Supervisor'}
              </button>
            )}
          </div>

          {/* Table */}
          <div className="data-table-container">
            {activeTab === 'driver' && (
              <StaffTable
                staff={drivers}
                roleBadge={<span className="badge badge-info">Driver</span>}
                onEdit={(m) => openEdit('driver', m)}
                onDelete={(m) => setConfirm({ role: 'driver', member: m })}
                busyId={busyId}
                extraColumns={['Venue', 'Supervisor', "Today's Bookings"]}
              />
            )}
            {activeTab === 'supervisor' && (
              <StaffTable
                staff={supervisors}
                roleBadge={<span className="badge badge-warning">Supervisor</span>}
                onEdit={(m) => openEdit('supervisor', m)}
                onDelete={(m) => setConfirm({ role: 'supervisor', member: m })}
                busyId={busyId}
                extraColumns={['Venue']}
              />
            )}
            {activeTab === 'manager' && (
              <StaffTable
                staff={managers}
                roleBadge={<span className="badge badge-purple">Manager</span>}
                onEdit={() => {}}
                onDelete={() => {}}
                busyId={busyId}
                extraColumns={['Venue']}
              />
            )}
          </div>
        </>
      )}

      {/* Add / Edit Modal */}
      {modal && (
        <ManageModal
          title={`${modal.mode === 'add' ? 'Add' : 'Edit'} ${modal.role === 'driver' ? 'Driver' : 'Supervisor'}`}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
          saveLabel={modal.mode === 'add' ? 'Add' : 'Update'}
        >
          {modal.role === 'driver' ? (
            <DriverForm
              form={form}
              setForm={setForm}
              venues={venues}
              supervisors={supervisors}
              isEdit={modal.mode === 'edit'}
            />
          ) : (
            <SupervisorForm
              form={form}
              setForm={setForm}
              venues={venues}
              isEdit={modal.mode === 'edit'}
            />
          )}
        </ManageModal>
      )}

      {/* Delete Confirm */}
      {confirm && (
        <ConfirmDialog
          message={`Delete ${confirm.role} "${confirm.member.name}"? This cannot be undone.`}
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
