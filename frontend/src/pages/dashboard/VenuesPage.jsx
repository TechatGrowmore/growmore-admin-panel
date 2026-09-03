import { useState, useEffect, useCallback } from 'react';
import ClientSwitcher from '../../components/ClientSwitcher';

export default function VenuesPage() {
  const [selectedClient, setSelectedClient] = useState(null);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const fetchVenues = useCallback(async () => {
    if (!selectedClient) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/proxy/${selectedClient}/venues`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch venues');
      const data = await res.json();
      setVenues(data.venues || []);
    } catch (err) {
      console.error('Venues fetch error:', err);
      setVenues([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClient]);

  useEffect(() => {
    if (selectedClient) fetchVenues();
  }, [selectedClient, fetchVenues]);

  return (
    <div className="page-body">
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 24, flexWrap: 'wrap', gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>Venues &amp; Locations</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.87rem' }}>
            Parking locations, spot capacity, and fee configurations
          </p>
        </div>
        <ClientSwitcher selectedClient={selectedClient} onSelect={setSelectedClient} showAll={false} />
      </div>

      {loading ? (
        <div className="page-loading"><div className="spinner" /><span>Loading venues...</span></div>
      ) : venues.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 48, marginBottom: 12 }}>📍</div>
          <h3>No venues configured</h3>
          <p>This client has no active parking venues</p>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Venue Name</th><th>Parking Fee</th><th>Upfront Payment</th>
                <th>Parking Spots</th><th>Supervisor</th>
                <th>Today&apos;s Bookings</th><th>Today&apos;s Revenue</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {venues.map((v) => (
                <tr key={v._id || v.name}>
                  <td><strong>{v.name}</strong></td>
                  <td>₹{v.parkingFee || 100}</td>
                  <td>
                    {v.requiresUpfrontPayment ? (
                      <span className="badge badge-warning">Required</span>
                    ) : (
                      <span className="badge badge-neutral">On Exit</span>
                    )}
                  </td>
                  <td>
                    {v.parkingSpots?.length > 0 ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {v.parkingSpots.length} spot{v.parkingSpots.length !== 1 ? 's' : ''} configured
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Auto spot assignment</span>
                    )}
                  </td>
                  <td>{v.supervisor?.name || 'Unassigned'}</td>
                  <td>
                    <strong style={{ color: v.todayBookings > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                      {v.todayBookings || 0}
                    </strong>
                  </td>
                  <td>
                    <strong style={{ color: (v.todayRevenue || 0) > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                      ₹{(v.todayRevenue || 0).toLocaleString('en-IN')}
                    </strong>
                  </td>
                  <td>
                    {v.isActive !== false ? (
                      <span className="badge badge-success">Active</span>
                    ) : (
                      <span className="badge badge-danger">Inactive</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
