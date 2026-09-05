import { useState, useEffect, useCallback } from 'react';
import ClientSwitcher from '../../components/ClientSwitcher';

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

/* ── sub-components ────────────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const map = {
    parked: ['badge-info', '🚗 Parked'],
    'recall-requested': ['badge-warning', '🔔 Recalled'],
    'in-transit': ['badge-warning', '🏃 In Transit'],
    arrived: ['badge-purple', '🎯 Arrived'],
    completed: ['badge-success', '✅ Completed'],
    cancelled: ['badge-danger', '❌ Cancelled'],
  };
  const [cls, label] = map[status] || ['badge-neutral', status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

function PaymentBadge({ status, method }) {
  const paid = status === 'completed' || status === 'paid';
  return paid ? (
    <span className="badge badge-success">Paid ({method || 'cash'})</span>
  ) : (
    <span className="badge badge-warning">Unpaid</span>
  );
}

/* ── confirm dialog ────────────────────────────────────────────────────────── */
function ConfirmDialog({ message, onConfirm, onCancel, busy }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 400 }}
      >
        <div className="modal-header">
          <h2>Confirm Action</h2>
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
            {busy ? 'Processing...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── main page ─────────────────────────────────────────────────────────────── */
export default function BookingsPage() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 1 });
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(null); // bookingId being actioned
  const [confirm, setConfirm] = useState(null); // { type, booking }
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    customerName: '',
    customerPhone: '',
    vehicleNumber: '',
    vehicleType: 'car',
    vehicleModel: '',
    vehicleColor: '',
    parkingSpot: '',
  });
  const [createBusy, setCreateBusy] = useState(false);
  const [toast, showToast] = useToast();

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    if (!selectedClient) {
      showToast('Please select a client site first', 'error');
      return;
    }
    if (!createForm.vehicleNumber.trim() || !createForm.customerPhone.trim()) {
      showToast('Vehicle Number and Customer Phone are required', 'error');
      return;
    }

    setCreateBusy(true);
    try {
      const payload = {
        customer: {
          name: createForm.customerName.trim() || 'Guest Customer',
          phone: createForm.customerPhone.trim(),
        },
        vehicle: {
          number: createForm.vehicleNumber.trim().toUpperCase(),
          type: createForm.vehicleType,
          model: createForm.vehicleModel.trim() || undefined,
          color: createForm.vehicleColor.trim() || undefined,
        },
        location: {
          parkingSpot: createForm.parkingSpot.trim() || undefined,
        },
      };

      const res = await adminFetch(selectedClient, '/bookings', 'POST', payload);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to create booking');
      }

      showToast('Booking created successfully ✓');
      setCreateOpen(false);
      setCreateForm({
        customerName: '',
        customerPhone: '',
        vehicleNumber: '',
        vehicleType: 'car',
        vehicleModel: '',
        vehicleColor: '',
        parkingSpot: '',
      });
      fetchBookings(1);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCreateBusy(false);
    }
  };

  /* load clients */
  useEffect(() => {
    fetch('/api/clients', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const list = d.clients || [];
        setClients(list);
        if (list.length > 0) setSelectedClient(list[0].id);
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  /* fetch bookings */
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
      } catch {
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

  /* mark paid */
  const handleMarkPaid = async (booking) => {
    setActionBusy(booking._id || booking.bookingId);
    try {
      const method = (!booking.payment?.method || booking.payment?.method === 'pending')
        ? 'cash'
        : booking.payment.method;
      const res = await adminFetch(
        selectedClient,
        `/bookings/${booking._id}/payment`,
        'PATCH',
        { paymentMethod: method, paymentStatus: 'paid' }
      );
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.message || 'Failed to update payment');
      }
      showToast('Payment marked as paid ✓');
      fetchBookings(pagination.page);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionBusy(null);
    }
  };

  /* delete booking */
  const handleDelete = async () => {
    if (!confirm) return;
    const { booking } = confirm;
    setActionBusy(booking._id || booking.bookingId);
    setConfirm(null);
    try {
      const res = await adminFetch(selectedClient, `/bookings/${booking._id}`, 'DELETE');
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.message || 'Failed to delete booking');
      }
      showToast('Booking deleted');
      fetchBookings(pagination.page);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionBusy(null);
    }
  };

  /* client-side search */
  const filtered = bookings.filter((b) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.bookingId?.toLowerCase().includes(q) ||
      b.customer?.name?.toLowerCase().includes(q) ||
      b.customer?.phone?.includes(q) ||
      b.vehicle?.number?.toLowerCase().includes(q) ||
      b.driver?.name?.toLowerCase().includes(q)
    );
  });

  const isPaid = (b) =>
    b.payment?.status === 'completed' || b.paymentStatus === 'paid';

  const isCash = (b) =>
    !b.payment?.method || b.payment?.method === 'cash' || b.payment?.method === 'pending';

  return (
    <div className="page-body">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>Bookings</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.87rem' }}>
            Live booking history — mark payments, delete records, and create new bookings
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            id="create-booking-btn"
            className="btn-primary"
            style={{ width: 'auto', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => setCreateOpen(true)}
            disabled={!selectedClient}
          >
            <span>➕</span> New Booking
          </button>
          <ClientSwitcher selectedClient={selectedClient} onSelect={setSelectedClient} showAll={false} />
        </div>
      </div>

      {/* Table */}
      <div className="data-table-container">
        <div className="data-table-header">
          <h3>
            Bookings List {pagination.total > 0 && `(${pagination.total})`}
          </h3>
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
          <div className="page-loading"><div className="spinner" /><span>Fetching bookings...</span></div>
        ) : filtered.length === 0 ? (
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const bid = b._id || b.bookingId;
                  const busy = actionBusy === bid || actionBusy === b._id;
                  const paid = isPaid(b);
                  const cash = isCash(b);

                  return (
                    <tr key={bid}>
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
                          {[b.vehicle?.color, b.vehicle?.model, b.vehicle?.type]
                            .filter(Boolean)
                            .join(' • ')}
                        </div>
                      </td>
                      <td>{b.driver?.name || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}</td>
                      <td><StatusBadge status={b.status} /></td>
                      <td>
                        <PaymentBadge
                          status={b.payment?.status || b.paymentStatus}
                          method={b.payment?.method}
                        />
                        {b.payment?.amount ? (
                          <span style={{ marginLeft: 6, fontWeight: 700, fontSize: '0.8rem' }}>
                            ₹{b.payment.amount}
                          </span>
                        ) : null}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                        {new Date(b.createdAt).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short',
                          hour: '2-digit', minute: '2-digit', hour12: true,
                        })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {/* Mark Paid — only for unpaid cash bookings */}
                          {!paid && cash && (
                            <button
                              className="btn-secondary btn-small"
                              style={{ color: 'var(--success)', borderColor: 'rgba(16,185,129,0.3)', whiteSpace: 'nowrap' }}
                              onClick={() => handleMarkPaid(b)}
                              disabled={busy}
                              title="Mark as paid (cash)"
                            >
                              {busy ? '...' : '💳 Mark Paid'}
                            </button>
                          )}
                          {/* Delete */}
                          <button
                            className="btn-secondary btn-small btn-danger"
                            onClick={() => setConfirm({ booking: b })}
                            disabled={busy}
                            title="Delete booking"
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

      {/* Create Booking Modal */}
      {createOpen && (
        <div className="modal-overlay" onClick={() => setCreateOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 480 }}
          >
            <div className="modal-header">
              <h2>Create Valet Booking</h2>
              <button className="modal-close" onClick={() => setCreateOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateBooking}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Customer Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. John Doe"
                      value={createForm.customerName}
                      onChange={(e) => setCreateForm({ ...createForm, customerName: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Customer Phone *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 9876543210"
                      value={createForm.customerPhone}
                      onChange={(e) => setCreateForm({ ...createForm, customerPhone: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Vehicle Number *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. MH02AB1234"
                      value={createForm.vehicleNumber}
                      onChange={(e) => setCreateForm({ ...createForm, vehicleNumber: e.target.value })}
                      required
                      style={{ textTransform: 'uppercase', letterSpacing: 1 }}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Vehicle Type</label>
                    <select
                      className="form-input"
                      value={createForm.vehicleType}
                      onChange={(e) => setCreateForm({ ...createForm, vehicleType: e.target.value })}
                    >
                      <option value="car">🚗 Car</option>
                      <option value="suv">🚙 SUV</option>
                      <option value="bike">🏍️ Bike</option>
                      <option value="luxury">✨ Luxury</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Vehicle Model</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Honda City"
                      value={createForm.vehicleModel}
                      onChange={(e) => setCreateForm({ ...createForm, vehicleModel: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Vehicle Color</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. White"
                      value={createForm.vehicleColor}
                      onChange={(e) => setCreateForm({ ...createForm, vehicleColor: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label>Parking Spot / Notes</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Spot A-04 or VIP"
                    value={createForm.parkingSpot}
                    onChange={(e) => setCreateForm({ ...createForm, parkingSpot: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setCreateOpen(false)}
                  disabled={createBusy}
                >
                  Cancel
                </button>
                <button
                  id="submit-create-booking-btn"
                  type="submit"
                  className="btn-primary"
                  style={{ width: 'auto', padding: '10px 24px' }}
                  disabled={createBusy}
                >
                  {createBusy ? 'Creating...' : 'Create Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirm && (
        <ConfirmDialog
          message={`Delete booking ${confirm.booking.bookingId}? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
          busy={!!actionBusy}
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
