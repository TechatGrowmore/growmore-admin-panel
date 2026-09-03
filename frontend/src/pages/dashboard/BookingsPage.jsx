import { useState, useEffect, useCallback } from 'react';
import ClientSwitcher from '../../components/ClientSwitcher';

export default function BookingsPage() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 1 });
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/clients', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        const clientList = data.clients || [];
        setClients(clientList);
        if (clientList.length > 0) {
          setSelectedClient(clientList[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const fetchBookings = useCallback(
    async (page = 1) => {
      if (!selectedClient) { setLoading(false); return; }
      setLoading(true);
      try {
        const params = new URLSearchParams({ page, limit: pagination.limit });
        if (statusFilter) params.set('status', statusFilter);

        const res = await fetch(`/api/proxy/${selectedClient}/bookings?${params}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to load bookings');

        const data = await res.json();
        setBookings(data.bookings || []);
        setPagination(data.pagination || { page: 1, limit: 25, total: 0, pages: 1 });
      } catch (err) {
        console.error('Bookings fetch error:', err);
        setBookings([]);
      } finally {
        setLoading(false);
      }
    },
    [selectedClient, statusFilter, pagination.limit]
  );

  useEffect(() => {
    if (selectedClient) fetchBookings(1);
  }, [selectedClient, statusFilter, fetchBookings]);

  const filteredBookings = bookings.filter((b) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (b.bookingId && b.bookingId.toLowerCase().includes(q)) ||
      (b.customer?.name && b.customer.name.toLowerCase().includes(q)) ||
      (b.customer?.phone && b.customer.phone.includes(q)) ||
      (b.vehicle?.number && b.vehicle.number.toLowerCase().includes(q)) ||
      (b.driver?.name && b.driver.name.toLowerCase().includes(q))
    );
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'parked': return <span className="badge badge-info">🚗 Parked</span>;
      case 'recall-requested': return <span className="badge badge-warning">🔔 Recalled</span>;
      case 'in-transit': return <span className="badge badge-warning">🏃 In Transit</span>;
      case 'arrived': return <span className="badge badge-purple">🎯 Arrived</span>;
      case 'completed': return <span className="badge badge-success">✅ Completed</span>;
      case 'cancelled': return <span className="badge badge-danger">❌ Cancelled</span>;
      default: return <span className="badge badge-neutral">{status}</span>;
    }
  };

  const getPaymentBadge = (status, method) => {
    if (status === 'completed' || status === 'paid') {
      return <span className="badge badge-success">Paid ({method || 'cash'})</span>;
    }
    return <span className="badge badge-warning">Unpaid</span>;
  };

  return (
    <div className="page-body">
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 24, flexWrap: 'wrap', gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>Bookings</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.87rem' }}>
            Live booking history and active vehicles
          </p>
        </div>
        <ClientSwitcher
          selectedClient={selectedClient}
          onSelect={(id) => setSelectedClient(id)}
          showAll={false}
        />
      </div>

      <div className="data-table-container">
        <div className="data-table-header">
          <h3>Bookings List {pagination.total > 0 && `(${pagination.total})`}</h3>
          <div className="data-table-filters">
            <input
              type="text"
              className="filter-input"
              placeholder="Search vehicle, customer, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 220 }}
            />
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="parked">Parked</option>
              <option value="recall-requested">Recalled</option>
              <option value="arrived">Arrived</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="page-loading">
            <div className="spinner" />
            <span>Fetching bookings...</span>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <h3>No bookings found</h3>
            <p>Try clearing filters or selecting another client</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Customer</th>
                  <th>Vehicle</th>
                  <th>Driver</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((b) => {
                  const timeFormatted = new Date(b.createdAt).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
                  });
                  return (
                    <tr key={b._id || b.bookingId}>
                      <td>
                        <strong>{b.bookingId}</strong>
                        {b.location?.parkingSpot && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Spot: {b.location.parkingSpot}
                          </div>
                        )}
                      </td>
                      <td>
                        <strong>{b.customer?.name}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {b.customer?.phone}
                        </div>
                      </td>
                      <td>
                        <strong style={{ letterSpacing: 0.5, color: 'var(--accent)' }}>
                          {b.vehicle?.number}
                        </strong>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {[b.vehicle?.color, b.vehicle?.model, b.vehicle?.type].filter(Boolean).join(' • ')}
                        </div>
                      </td>
                      <td>{b.driver?.name || 'Unassigned'}</td>
                      <td>{getStatusBadge(b.status)}</td>
                      <td>
                        {getPaymentBadge(b.payment?.status || b.paymentStatus, b.payment?.method)}
                        {b.payment?.amount ? (
                          <span style={{ marginLeft: 6, fontWeight: 700, fontSize: '0.8rem' }}>
                            ₹{b.payment.amount}
                          </span>
                        ) : null}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{timeFormatted}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination.pages > 1 && (
          <div className="data-table-footer">
            <span>Page {pagination.page} of {pagination.pages}</span>
            <div className="pagination">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchBookings(pagination.page - 1)}
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => fetchBookings(pagination.page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
