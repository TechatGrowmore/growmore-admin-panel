'use client';

import { useState, useEffect } from 'react';

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [form, setForm] = useState({ name: '', apiUrl: '', apiKey: '' });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [toast, setToast] = useState(null);

  useEffect(() => { fetchClients(); }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients');
      const data = await res.json();
      setClients(data.clients || []);
    } catch {
      showToast('Failed to fetch clients', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditingClient(null);
    setForm({ name: '', apiUrl: '', apiKey: '' });
    setShowModal(true);
  };

  const openEdit = (client) => {
    setEditingClient(client);
    setForm({ name: client.name, apiUrl: client.apiUrl, apiKey: '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.apiUrl || (!editingClient && !form.apiKey)) {
      showToast('All fields are required', 'error');
      return;
    }
    setSaving(true);
    try {
      const body = editingClient
        ? { id: editingClient.id, name: form.name, apiUrl: form.apiUrl, ...(form.apiKey ? { apiKey: form.apiKey } : {}) }
        : form;

      const res = await fetch('/api/clients', {
        method: editingClient ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }

      showToast(editingClient ? 'Client updated!' : 'Client added!');
      setShowModal(false);
      fetchClients();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this client? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/clients?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      showToast('Client deleted');
      fetchClients();
    } catch {
      showToast('Failed to delete client', 'error');
    }
  };

  const handleTestConnection = async (client) => {
    setTesting(client.id);
    try {
      const res = await fetch(`/api/proxy/${client.id}/health`);
      const data = await res.json();
      setTestResults(prev => ({ ...prev, [client.id]: res.ok ? { success: true, data } : { success: false, error: data.message } }));
    } catch (err) {
      setTestResults(prev => ({ ...prev, [client.id]: { success: false, error: err.message } }));
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return <div className="page-loading"><div className="spinner" /><span>Loading clients...</span></div>;
  }

  return (
    <div className="page-body">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>Manage Clients</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.87rem' }}>Connect and manage your valet parking client apps</p>
        </div>
        <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={openAdd}>
          + Add Client
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 64, marginBottom: 12 }}>🏢</div>
          <h3>No clients yet</h3>
          <p>Add your first valet parking client to get started</p>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client Name</th>
                <th>API URL</th>
                <th>API Key</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => {
                const test = testResults[client.id];
                return (
                  <tr key={client.id}>
                    <td><strong>{client.name}</strong></td>
                    <td style={{ fontSize: '0.8rem', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {client.apiUrl}
                    </td>
                    <td>
                      <code style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-input)', padding: '2px 8px', borderRadius: 4 }}>
                        {client.apiKey}
                      </code>
                    </td>
                    <td>
                      {test ? (
                        test.success ? (
                          <span className="badge badge-success">● Connected</span>
                        ) : (
                          <span className="badge badge-danger">● Error</span>
                        )
                      ) : (
                        <span className="badge badge-neutral">Unknown</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn-secondary btn-small"
                          onClick={() => handleTestConnection(client)}
                          disabled={testing === client.id}
                        >
                          {testing === client.id ? '...' : '🔌 Test'}
                        </button>
                        <button className="btn-secondary btn-small" onClick={() => openEdit(client)}>
                          ✏️ Edit
                        </button>
                        <button
                          className="btn-secondary btn-small btn-danger"
                          onClick={() => handleDelete(client.id)}
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingClient ? 'Edit Client' : 'Add New Client'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Client Name</label>
                <input className="form-input" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Benne Cafe" />
              </div>
              <div className="form-group">
                <label>API Base URL</label>
                <input className="form-input" value={form.apiUrl} onChange={(e) => setForm(f => ({ ...f, apiUrl: e.target.value }))} placeholder="e.g. https://bennecafevaletapp.onrender.com" />
              </div>
              <div className="form-group">
                <label>API Key {editingClient && <span style={{ fontWeight: 400, textTransform: 'none' }}>(leave blank to keep existing)</span>}</label>
                <input className="form-input" value={form.apiKey} onChange={(e) => setForm(f => ({ ...f, apiKey: e.target.value }))} placeholder="Paste the PUBLIC_DATA_API_KEY from client's .env" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : (editingClient ? 'Update' : 'Add Client')}
              </button>
            </div>
          </div>
        </div>
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
