import { useState, useEffect, useCallback } from 'react';

function formatRelativeTime(dateString) {
  if (!dateString) return '—';
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now - past;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return past.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function ActionBadge({ action }) {
  const act = (action || '').toUpperCase();
  if (act.includes('DELETE') || act.includes('REMOVE')) {
    return <span className="log-action-badge log-action-delete">🗑️ {action}</span>;
  }
  if (act.includes('CREATE') || act.includes('ADD')) {
    return <span className="log-action-badge log-action-create">➕ {action}</span>;
  }
  if (act.includes('UPDATE') || act.includes('PAYMENT') || act.includes('EDIT')) {
    return <span className="log-action-badge log-action-update">✏️ {action}</span>;
  }
  return <span className="log-action-badge log-action-other">⚡ {action}</span>;
}

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [clients, setClients] = useState([]);
  const [managers, setManagers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterManager, setFilterManager] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [search, setSearch] = useState('');
  const [inspectLog, setInspectLog] = useState(null);

  // Fetch client list for dropdown
  useEffect(() => {
    fetch('/api/clients', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setClients(d.clients || []))
      .catch(() => {});
    fetch('/api/managers', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setManagers(d.managers || []))
      .catch(() => {});
  }, []);

  // Fetch logs
  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        limit: pagination.limit,
      });

      if (filterManager) params.set('managerId', filterManager);
      if (filterClient) params.set('clientId', filterClient);
      if (filterEntity) params.set('entity', filterEntity);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/logs?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch activity logs');
      const data = await res.json();

      setLogs(data.logs || []);
      setPagination(data.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('[LogsPage] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [filterManager, filterClient, filterEntity, search, pagination.limit]);

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  const handleClearFilters = () => {
    setFilterManager('');
    setFilterClient('');
    setFilterEntity('');
    setSearch('');
  };

  return (
    <div className="page-body">
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Activity Audit Logs</h1>
            <span className="badge badge-purple">
              {pagination.total} logged actions
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Real-time audit log of all operational manager activities (booking deletions, creations, payments, driver/supervisor updates).
          </p>
        </div>

        <button
          className="btn-secondary"
          onClick={() => fetchLogs(pagination.page)}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span>🔄</span> Refresh Logs
        </button>
      </div>

      {/* Filter Toolbar */}
      <div
        className="table-card"
        style={{ marginBottom: 20, padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}
      >
        <div style={{ flex: '1 1 220px', minWidth: 200 }}>
          <input
            id="search-logs-input"
            type="text"
            className="form-input"
            placeholder="Search description, manager, or site..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Manager Filter */}
        <select
          id="filter-manager"
          className="filter-select"
          value={filterManager}
          onChange={(e) => setFilterManager(e.target.value)}
          style={{ width: 180 }}
        >
          <option value="">All Managers</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} (@{m.username})
            </option>
          ))}
        </select>

        {/* Client Site Filter */}
        <select
          id="filter-client"
          className="filter-select"
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          style={{ width: 180 }}
        >
          <option value="">All Client Sites</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Entity Filter */}
        <select
          id="filter-entity"
          className="filter-select"
          value={filterEntity}
          onChange={(e) => setFilterEntity(e.target.value)}
          style={{ width: 150 }}
        >
          <option value="">All Entities</option>
          <option value="Booking">📋 Bookings</option>
          <option value="Driver">🚗 Drivers</option>
          <option value="Supervisor">👔 Supervisors</option>
          <option value="Venue">📍 Venues</option>
        </select>

        {(filterManager || filterClient || filterEntity || search) && (
          <button
            className="btn-secondary"
            style={{ padding: '8px 12px', fontSize: '0.8rem' }}
            onClick={handleClearFilters}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Logs Table */}
      <div className="table-card">
        {loading ? (
          <div className="page-loading">
            <div className="spinner" />
            <span>Fetching audit logs...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 48, marginBottom: 12 }}>📜</div>
            <h3>No activity logs found</h3>
            <p>Actions performed by operational managers will appear here automatically.</p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Manager</th>
                    <th>Site</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Description</th>
                    <th>Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span
                          style={{ fontSize: '0.82rem', fontWeight: 500 }}
                          title={new Date(log.createdAt).toLocaleString()}
                        >
                          {formatRelativeTime(log.createdAt)}
                        </span>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              background: 'rgba(139, 92, 246, 0.2)',
                              color: 'var(--purple)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                            }}
                          >
                            {log.user?.name?.charAt(0)?.toUpperCase() || 'M'}
                          </div>
                          <div>
                            <strong style={{ fontSize: '0.85rem' }}>{log.user?.name}</strong>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              @{log.user?.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="badge badge-neutral" style={{ fontSize: '0.78rem' }}>
                          🏢 {log.clientName || 'Site'}
                        </span>
                      </td>

                      <td>
                        <ActionBadge action={log.action} />
                      </td>

                      <td>
                        <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                          {log.entity}
                        </span>
                      </td>

                      <td>
                        <div style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                          {log.description}
                        </div>
                      </td>

                      <td>
                        <button
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={() => setInspectLog(log)}
                        >
                          🔍 View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 20px',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} total items)
                </span>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    disabled={pagination.page <= 1}
                    onClick={() => fetchLogs(pagination.page - 1)}
                  >
                    ← Previous
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => fetchLogs(pagination.page + 1)}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Inspect Log Modal */}
      {inspectLog && (
        <div className="modal-overlay" onClick={() => setInspectLog(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 560 }}
          >
            <div className="modal-header">
              <h2>Activity Log Details</h2>
              <button className="modal-close" onClick={() => setInspectLog(null)}>✕</button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>ACTION PERFORMED</span>
                  <div style={{ marginTop: 4 }}>
                    <ActionBadge action={inspectLog.action} />
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>TIMESTAMP</span>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    {new Date(inspectLog.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>

              <div style={{ padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  SUMMARY
                </span>
                <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{inspectLog.description}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>OPERATIONAL MANAGER</span>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, marginTop: 2 }}>
                    {inspectLog.user?.name} (@{inspectLog.user?.username})
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CLIENT SITE</span>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, marginTop: 2 }}>
                    {inspectLog.clientName}
                  </div>
                </div>
              </div>

              {inspectLog.details && (
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    REQUEST PAYLOAD / METADATA
                  </span>
                  <pre className="log-json-viewer">
                    {JSON.stringify(inspectLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setInspectLog(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
