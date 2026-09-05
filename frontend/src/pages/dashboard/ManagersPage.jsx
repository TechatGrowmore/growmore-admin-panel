import { useState, useEffect, useCallback } from 'react';

function useToast() {
  const [toast, setToast] = useState(null);
  const show = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };
  return [toast, show];
}

export default function ManagersPage() {
  const [managers, setManagers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editManager, setEditManager] = useState(null); // null = Add mode, object = Edit mode
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [toast, showToast] = useToast();

  // Modal Form State
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    phone: '',
    email: '',
    allSites: false,
    assignedClients: [],
    isActive: true,
  });
  const [formError, setFormError] = useState('');

  // Fetch managers
  const fetchManagers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/managers', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load managers');
      const data = await res.json();
      setManagers(data.managers || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch all clients for site selection
  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchManagers();
    fetchClients();
  }, [fetchManagers, fetchClients]);

  // Open modal for Adding
  const handleOpenAdd = () => {
    setEditManager(null);
    setFormData({
      name: '',
      username: '',
      password: '',
      phone: '',
      email: '',
      allSites: false,
      assignedClients: [],
      isActive: true,
    });
    setFormError('');
    setModalOpen(true);
  };

  // Open modal for Editing
  const handleOpenEdit = (manager) => {
    setEditManager(manager);
    const assignedIds = (manager.assignedClients || []).map((c) =>
      typeof c === 'object' && c._id ? c._id.toString() : c.toString()
    );
    setFormData({
      name: manager.name || '',
      username: manager.username || '',
      password: '', // leave empty to keep existing
      phone: manager.phone || '',
      email: manager.email || '',
      allSites: Boolean(manager.allSites),
      assignedClients: assignedIds,
      isActive: manager.isActive !== false,
    });
    setFormError('');
    setModalOpen(true);
  };

  // Toggle client checkbox in modal
  const handleClientToggle = (clientId) => {
    setFormData((prev) => {
      const exists = prev.assignedClients.includes(clientId);
      if (exists) {
        return { ...prev, assignedClients: prev.assignedClients.filter((id) => id !== clientId) };
      } else {
        return { ...prev, assignedClients: [...prev.assignedClients, clientId] };
      }
    });
  };

  // Select all / Deselect all
  const handleSelectAllClients = () => {
    setFormData((prev) => ({
      ...prev,
      assignedClients: clients.map((c) => c.id),
    }));
  };

  const handleDeselectAllClients = () => {
    setFormData((prev) => ({
      ...prev,
      assignedClients: [],
    }));
  };

  // Save (Create or Update)
  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim() || !formData.username.trim()) {
      setFormError('Name and Username are required');
      return;
    }

    if (!editManager && !formData.password) {
      setFormError('Password is required for new managers');
      return;
    }

    if (!formData.allSites && formData.assignedClients.length === 0) {
      setFormError('Please either select "All Sites" or choose at least one client site');
      return;
    }

    setActionBusy(true);
    try {
      const url = editManager ? `/api/managers/${editManager.id}` : '/api/managers';
      const method = editManager ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to save manager');
      }

      showToast(editManager ? 'Operational Manager updated ✓' : 'Operational Manager created ✓');
      setModalOpen(false);
      fetchManagers();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setActionBusy(false);
    }
  };

  // Toggle active status
  const handleToggleStatus = async (manager) => {
    try {
      const res = await fetch(`/api/managers/${manager.id}/toggle-status`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to update status');
      showToast(`Manager ${manager.isActive ? 'deactivated' : 'activated'}`);
      fetchManagers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Delete manager
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setActionBusy(true);
    try {
      const res = await fetch(`/api/managers/${deleteConfirm.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete manager');
      showToast('Operational Manager removed');
      setDeleteConfirm(null);
      fetchManagers();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionBusy(false);
    }
  };

  // Filter managers by search
  const filtered = managers.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.name?.toLowerCase().includes(q) ||
      m.username?.toLowerCase().includes(q) ||
      m.phone?.includes(q) ||
      m.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="page-body">
      {/* Toast */}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Operational Managers</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Create manager accounts and control which valet client sites each manager can access and operate.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button id="add-manager-btn" className="btn-primary" onClick={handleOpenAdd}>
            <span>➕</span> Add Operational Manager
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="table-card">
        <div className="table-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Active Accounts</span>
            <span className="badge badge-neutral">{filtered.length} total</span>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              id="search-managers-input"
              type="text"
              className="form-input"
              placeholder="Search by name, username, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 280 }}
            />
          </div>
        </div>

        {loading ? (
          <div className="page-loading">
            <div className="spinner" />
            <span>Loading managers...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 48, marginBottom: 12 }}>👔</div>
            <h3>No Operational Managers found</h3>
            <p>Add your first manager account to delegate operational control.</p>
            <button className="btn-primary" style={{ marginTop: 12 }} onClick={handleOpenAdd}>
              Add Manager
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Manager</th>
                  <th>Username</th>
                  <th>Contact</th>
                  <th>Site Access</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            background: 'var(--accent-glow-strong)',
                            color: 'var(--accent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                          }}
                        >
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong>{m.name}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            ID: {m.id.slice(-6)}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="badge badge-purple">@{m.username}</span>
                    </td>

                    <td>
                      <div style={{ fontSize: '0.85rem' }}>{m.phone || '—'}</div>
                      {m.email && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {m.email}
                        </div>
                      )}
                    </td>

                    <td>
                      {m.allSites ? (
                        <span className="badge badge-success">🌐 All Client Sites</span>
                      ) : Array.isArray(m.assignedClients) && m.assignedClients.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {m.assignedClients.map((client) => {
                            const name = typeof client === 'object' ? client.name : 'Site';
                            return (
                              <span key={client.id || client._id || client} className="badge badge-info">
                                🏢 {name}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="badge badge-warning">⚠️ No Sites Assigned</span>
                      )}
                    </td>

                    <td>
                      <button
                        className={`badge ${m.isActive !== false ? 'badge-success' : 'badge-danger'}`}
                        style={{ cursor: 'pointer', border: 'none' }}
                        onClick={() => handleToggleStatus(m)}
                        title="Click to toggle status"
                      >
                        {m.isActive !== false ? '● Active' : '○ Inactive'}
                      </button>
                    </td>

                    <td>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {m.lastLogin
                          ? new Date(m.lastLogin).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Never'}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn-secondary"
                          style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                          onClick={() => handleOpenEdit(m)}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="btn-secondary"
                          style={{
                            padding: '5px 10px',
                            fontSize: '0.78rem',
                            color: 'var(--danger)',
                            borderColor: 'rgba(239,68,68,0.3)',
                          }}
                          onClick={() => setDeleteConfirm(m)}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 520 }}
          >
            <div className="modal-header">
              <h2>{editManager ? 'Edit Operational Manager' : 'Add Operational Manager'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {formError && <div className="login-error">{formError}</div>}

                <div className="form-group" style={{ margin: 0 }}>
                  <label>Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Ramesh Kumar"
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Username *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="e.g. ramesh.ops"
                      required
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label>{editManager ? 'Password (blank = keep)' : 'Password *'}</label>
                    <input
                      type="password"
                      className="form-input"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={editManager ? '••••••••' : 'Enter password'}
                      required={!editManager}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Phone</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="e.g. 9876543210"
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Email</label>
                    <input
                      type="email"
                      className="form-input"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g. ramesh@growmore.in"
                    />
                  </div>
                </div>

                {/* Site Access Configuration */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Client Site Access *</label>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: 10,
                      cursor: 'pointer',
                    }}
                    onClick={() => setFormData({ ...formData, allSites: !formData.allSites })}
                  >
                    <input
                      type="checkbox"
                      id="allSites-checkbox"
                      checked={formData.allSites}
                      onChange={(e) => setFormData({ ...formData, allSites: e.target.checked })}
                      style={{ accentColor: 'var(--accent)', width: 18, height: 18, cursor: 'pointer' }}
                    />
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                      🌐 Grant Access to All Current & Future Sites
                    </div>
                  </div>

                  {!formData.allSites && (
                    <div className="site-select-box">
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 8,
                          paddingBottom: 6,
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Select specific client sites:
                        </span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                            onClick={handleSelectAllClients}
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                            onClick={handleDeselectAllClients}
                          >
                            Deselect All
                          </button>
                        </div>
                      </div>

                      {clients.length === 0 ? (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px 0' }}>
                          No clients available. Add clients in the Clients section first.
                        </div>
                      ) : (
                        clients.map((client) => {
                          const isChecked = formData.assignedClients.includes(client.id);
                          return (
                            <label
                              key={client.id}
                              className="site-checkbox-item"
                              style={{ background: isChecked ? 'rgba(255,107,53,0.08)' : 'transparent' }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleClientToggle(client.id)}
                              />
                              <div style={{ flex: 1 }}>
                                <span style={{ fontWeight: 600 }}>{client.name}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                                  ({client.apiUrl})
                                </span>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {editManager && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      background: 'var(--bg-card)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <input
                      type="checkbox"
                      id="isActive-checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
                    />
                    <label htmlFor="isActive-checkbox" style={{ margin: 0, cursor: 'pointer', fontSize: '0.88rem' }}>
                      Account is active (uncheck to suspend manager login)
                    </label>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setModalOpen(false)}
                  disabled={actionBusy}
                >
                  Cancel
                </button>
                <button
                  id="save-manager-btn"
                  type="submit"
                  className="btn-primary"
                  style={{ width: 'auto', padding: '10px 24px' }}
                  disabled={actionBusy}
                >
                  {actionBusy ? 'Saving...' : editManager ? 'Save Changes' : 'Create Manager'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 420 }}
          >
            <div className="modal-header">
              <h2>Confirm Deletion</h2>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                Are you sure you want to permanently delete the operational manager account for{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{deleteConfirm.name}</strong> (@{deleteConfirm.username})?
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: 8 }}>
                This manager will immediately lose access to all client sites and cannot log in again.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setDeleteConfirm(null)}
                disabled={actionBusy}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{ width: 'auto', padding: '10px 20px', background: 'var(--danger)', border: 'none' }}
                onClick={handleDelete}
                disabled={actionBusy}
              >
                {actionBusy ? 'Deleting...' : 'Delete Manager'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
