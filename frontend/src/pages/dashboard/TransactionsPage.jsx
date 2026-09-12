import { useState, useEffect, useCallback } from 'react';
import ClientSwitcher from '../../components/ClientSwitcher';

export default function TransactionsPage() {
  const [selectedClient, setSelectedClient] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const todayStr = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);
  const [methodFilter, setMethodFilter] = useState('');

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

  const fetchTransactions = useCallback(async () => {
    if (!selectedClient) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate, limit: 200 });
      const res = await fetch(`/api/proxy/${selectedClient}/bookings?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch (err) {
      console.error('Transactions error:', err);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClient, fromDate, toDate]);

  useEffect(() => {
    if (selectedClient) fetchTransactions();
  }, [selectedClient, fromDate, toDate, fetchTransactions]);

  const paidTransactions = bookings.filter((b) => {
    const isPaid = b.payment?.status === 'completed' || b.paymentStatus === 'paid';
    if (!isPaid) return false;
    if (methodFilter && b.payment?.method !== methodFilter) return false;
    return true;
  });

  const groupedTransactions = paidTransactions.reduce((acc, b) => {
    const dateKey = new Date(b.createdAt).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
    if (!acc[dateKey]) acc[dateKey] = { items: [], total: 0 };
    acc[dateKey].items.push(b);
    acc[dateKey].total += b.payment?.amount || 0;
    return acc;
  }, {});

  const totalCollected = paidTransactions.reduce((sum, b) => sum + (b.payment?.amount || 0), 0);

  return (
    <div className="page-body">
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 24, flexWrap: 'wrap', gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>Transactions</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.87rem' }}>
            Day-wise payment history and revenue collections
          </p>
        </div>
        <ClientSwitcher selectedClient={selectedClient} onSelect={setSelectedClient} showAll={false} />
      </div>

      <div className="chart-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div className="date-range-picker">
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>to</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <select className="filter-select" value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
            <option value="">All Payment Methods</option>
            <option value="cash">Cash</option>
            <option value="qr">QR Code</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="razorpay">Razorpay</option>
          </select>
        </div>
      </div>

      <div className="stat-card" style={{ '--card-accent': '#2DB84B', marginBottom: 24 }}>
        <div className="stat-card-header">
          <span className="stat-card-label">Selected Period Total</span>
          <div className="stat-card-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>💳</div>
        </div>
        <div className="stat-card-value">₹{totalCollected.toLocaleString('en-IN')}</div>
        <div className="stat-card-sub">
          {paidTransactions.length} successful transaction{paidTransactions.length !== 1 ? 's' : ''}
        </div>
      </div>

      {loading ? (
        <div className="page-loading"><div className="spinner" /><span>Loading transactions...</span></div>
      ) : Object.keys(groupedTransactions).length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 48, marginBottom: 12 }}>💳</div>
          <h3>No transactions found</h3>
          <p>Try expanding the date range or clearing filters</p>
        </div>
      ) : (
        Object.entries(groupedTransactions).map(([date, group]) => (
          <div key={date} className="data-table-container" style={{ marginBottom: 20 }}>
            <div className="data-table-header" style={{ background: 'var(--bg-secondary)' }}>
              <strong style={{ fontSize: '0.95rem' }}>{date}</strong>
              <div style={{ color: 'var(--success)', fontWeight: 700, fontSize: '0.9rem' }}>
                Day Total: ₹{group.total.toLocaleString('en-IN')} ({group.items.length} txns)
              </div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Booking ID</th><th>Customer</th><th>Vehicle</th>
                  <th>Driver</th><th>Method</th><th>Amount</th><th>Time</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((b) => (
                  <tr key={b._id || b.bookingId}>
                    <td><strong>{b.bookingId}</strong></td>
                    <td>
                      <div><strong>{b.customer?.name}</strong></div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.customer?.phone}</div>
                    </td>
                    <td><strong style={{ color: 'var(--accent)' }}>{b.vehicle?.number}</strong></td>
                    <td>{b.driver?.name || 'Unassigned'}</td>
                    <td>
                      <span className="badge badge-purple" style={{ textTransform: 'uppercase' }}>
                        {b.payment?.method || 'cash'}
                      </span>
                    </td>
                    <td><strong style={{ color: 'var(--success)' }}>₹{b.payment?.amount || 0}</strong></td>
                    <td style={{ fontSize: '0.78rem' }}>
                      {new Date(b.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
