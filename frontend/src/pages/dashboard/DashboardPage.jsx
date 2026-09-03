import { useState, useEffect } from 'react';

export default function DashboardPage() {
  const [clients, setClients] = useState([]);
  const [clientData, setClientData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients', { credentials: 'include' });
      const data = await res.json();
      setClients(data.clients || []);

      // Fetch summary for each client
      const summaries = {};
      await Promise.allSettled(
        (data.clients || []).map(async (client) => {
          try {
            const sRes = await fetch(`/api/proxy/${client.id}/summary`, { credentials: 'include' });
            if (sRes.ok) {
              summaries[client.id] = await sRes.json();
            } else {
              summaries[client.id] = { error: true };
            }
          } catch {
            summaries[client.id] = { error: true };
          }
        })
      );
      setClientData(summaries);
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals across all clients
  const totals = Object.values(clientData).reduce(
    (acc, d) => {
      if (!d || d.error) return acc;
      acc.todayBookings += d.today?.bookings || 0;
      acc.todayRevenue += d.today?.revenue || 0;
      acc.activeBookings += d.today?.active || 0;
      acc.allTimeRevenue += d.allTime?.revenue || 0;
      acc.allTimeBookings += d.allTime?.bookings || 0;
      return acc;
    },
    { todayBookings: 0, todayRevenue: 0, activeBookings: 0, allTimeRevenue: 0, allTimeBookings: 0 }
  );

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <span>Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="page-body">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>Dashboard Overview</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.87rem' }}>
          Real-time summary across all connected clients
        </p>
      </div>

      {/* Global Stats */}
      <div className="stats-grid">
        <div className="stat-card" style={{ '--card-accent': '#FF6B35' }}>
          <div className="stat-card-header">
            <span className="stat-card-label">Today&apos;s Bookings</span>
            <div className="stat-card-icon">📋</div>
          </div>
          <div className="stat-card-value">{totals.todayBookings}</div>
          <div className="stat-card-sub">
            across {clients.length} client{clients.length !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="stat-card" style={{ '--card-accent': '#10B981' }}>
          <div className="stat-card-header">
            <span className="stat-card-label">Today&apos;s Revenue</span>
            <div className="stat-card-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
              💰
            </div>
          </div>
          <div className="stat-card-value">₹{totals.todayRevenue.toLocaleString('en-IN')}</div>
          <div className="stat-card-sub">collected today</div>
        </div>

        <div className="stat-card" style={{ '--card-accent': '#3B82F6' }}>
          <div className="stat-card-header">
            <span className="stat-card-label">Active Now</span>
            <div className="stat-card-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
              🚗
            </div>
          </div>
          <div className="stat-card-value">{totals.activeBookings}</div>
          <div className="stat-card-sub">parked / in-transit</div>
        </div>

        <div className="stat-card" style={{ '--card-accent': '#8B5CF6' }}>
          <div className="stat-card-header">
            <span className="stat-card-label">All-Time Revenue</span>
            <div className="stat-card-icon" style={{ background: 'var(--purple-bg)', color: 'var(--purple)' }}>
              📈
            </div>
          </div>
          <div className="stat-card-value">₹{totals.allTimeRevenue.toLocaleString('en-IN')}</div>
          <div className="stat-card-sub">{totals.allTimeBookings.toLocaleString()} total bookings</div>
        </div>
      </div>

      {/* Client Cards */}
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>
        Connected Clients ({clients.length})
      </h2>

      {clients.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 64, marginBottom: 12 }}>🏢</div>
          <h3>No clients connected yet</h3>
          <p>Go to Clients page to add your first valet parking client</p>
        </div>
      ) : (
        <div className="clients-grid">
          {clients.map((client) => {
            const data = clientData[client.id];
            const hasData = data && !data.error;

            return (
              <div key={client.id} className="client-card">
                <div className="client-card-header">
                  <div>
                    <div className="client-card-name">{client.name}</div>
                    <div className="client-card-url">{client.apiUrl}</div>
                  </div>
                  <span className={`connection-dot ${hasData ? 'online' : 'offline'}`} />
                </div>

                {hasData ? (
                  <div className="client-card-stats">
                    <div className="client-stat">
                      <div className="client-stat-value">{data.today?.bookings || 0}</div>
                      <div className="client-stat-label">Today&apos;s Bookings</div>
                    </div>
                    <div className="client-stat">
                      <div className="client-stat-value">
                        ₹{(data.today?.revenue || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="client-stat-label">Today&apos;s Revenue</div>
                    </div>
                    <div className="client-stat">
                      <div className="client-stat-value">{data.today?.active || 0}</div>
                      <div className="client-stat-label">Active Now</div>
                    </div>
                    <div className="client-stat">
                      <div className="client-stat-value">
                        ₹{(data.allTime?.revenue || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="client-stat-label">All-Time Revenue</div>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '20px 0',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '0.85rem',
                    }}
                  >
                    ⚠️ Unable to connect — check API key &amp; URL
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
