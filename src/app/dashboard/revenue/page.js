'use client';

import { useState, useEffect, useCallback } from 'react';
import ClientSwitcher from '@/components/ClientSwitcher';

/* ─── Mini Bar Chart Component ───────────────────────────── */
const MiniBarChart = ({ data, height = 140, color = '#8B5CF6' }) => {
  const [tooltip, setTooltip] = useState(null);
  if (!data || data.length === 0) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No chart data for this period</div>;

  const max = Math.max(...data.map(d => d.amount), 1);
  const barW = Math.max(8, Math.floor(600 / data.length) - 4);
  const totalWidth = Math.max(600, data.length * (barW + 4));

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8, position: 'relative' }}>
      {tooltip && (
        <div style={{
          position: 'absolute', top: 0, left: Math.min(tooltip.x, totalWidth - 140),
          background: 'rgba(18,20,26,0.95)', color: '#fff', borderRadius: 8,
          padding: '6px 12px', fontSize: 12, fontWeight: 600, zIndex: 10,
          pointerEvents: 'none', whiteSpace: 'nowrap', backdropFilter: 'blur(4px)',
          border: '1px solid var(--border)'
        }}>
          ₹{tooltip.amount.toLocaleString('en-IN')} • {tooltip.count} booking{tooltip.count !== 1 ? 's' : ''}<br />
          <span style={{ fontWeight: 400, opacity: 0.8, fontSize: 11 }}>{tooltip.label}</span>
        </div>
      )}
      <svg width={totalWidth} height={height + 24} style={{ display: 'block' }}>
        {data.map((d, i) => {
          const bH = Math.max(d.amount > 0 ? 4 : 1, Math.round((d.amount / max) * height));
          const x = i * (barW + 4);
          const y = height - bH;
          const isLast = i === data.length - 1;
          const barColor = d.amount > 0 ? (isLast ? '#FF6B35' : color) : '#2A2D37';
          return (
            <g key={i}
              onMouseEnter={() => setTooltip({ x: x + barW / 2, amount: d.amount, count: d.count, label: d.label })}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: d.amount > 0 ? 'pointer' : 'default' }}
            >
              <rect x={x} y={y} width={barW} height={bH} rx={3} fill={barColor} opacity={isLast ? 1 : 0.85} />
              {(i % Math.ceil(data.length / 10) === 0 || isLast) && (
                <text x={x + barW / 2} y={height + 18} textAnchor="middle" fontSize="9" fill="#9CA3AF">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/* ─── Quick Presets ─────────────────────────────────────────── */
const DATE_PRESETS = [
  { label: 'Today', getDates: () => { const d = new Date(); return { from: d.toISOString().split('T')[0], to: d.toISOString().split('T')[0] }; } },
  { label: 'Yesterday', getDates: () => { const d = new Date(); d.setDate(d.getDate() - 1); return { from: d.toISOString().split('T')[0], to: d.toISOString().split('T')[0] }; } },
  { label: 'Last 7 Days', getDates: () => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 6); return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] }; } },
  { label: 'Last 30 Days', getDates: () => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 29); return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] }; } },
  { label: 'This Month', getDates: () => { const now = new Date(); const from = new Date(now.getFullYear(), now.getMonth(), 1); return { from: from.toISOString().split('T')[0], to: now.toISOString().split('T')[0] }; } },
];

export default function RevenuePage() {
  const [selectedClient, setSelectedClient] = useState(null);
  const todayStr = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(todayStr);

  const [revenueData, setRevenueData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch clients on mount
  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then(d => {
        const list = d.clients || [];
        if (list.length > 0) setSelectedClient(list[0].id);
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const fetchRevenue = useCallback(async () => {
    if (!selectedClient) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/proxy/${selectedClient}/revenue?from=${fromDate}&to=${toDate}`);
      if (!res.ok) throw new Error('Failed to fetch revenue');
      const data = await res.json();
      setRevenueData(data);
    } catch (err) {
      console.error('Revenue fetch error:', err);
      setRevenueData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedClient, fromDate, toDate]);

  useEffect(() => {
    if (selectedClient && fromDate && toDate) {
      fetchRevenue();
    }
  }, [selectedClient, fromDate, toDate, fetchRevenue]);

  const chartData = revenueData?.hourlyBreakdown || revenueData?.dailyBreakdown || [];

  return (
    <div className="page-body">
      {/* Header & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>Revenue Analytics</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.87rem' }}>Revenue breakdowns, method splits, and trends</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <ClientSwitcher
            selectedClient={selectedClient}
            onSelect={(id) => setSelectedClient(id)}
            showAll={false}
          />
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="chart-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div className="chart-tabs">
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                className="chart-tab"
                onClick={() => {
                  const { from, to } = preset.getDates();
                  setFromDate(from);
                  setToDate(to);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="date-range-picker">
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>to</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="page-loading">
          <div className="spinner" />
          <span>Fetching revenue analytics...</span>
        </div>
      ) : !revenueData ? (
        <div className="empty-state">
          <div style={{ fontSize: 48, marginBottom: 12 }}>💰</div>
          <h3>No revenue data available</h3>
          <p>Select a valid client or adjust the date range</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="stats-grid">
            <div className="stat-card" style={{ '--card-accent': '#10B981' }}>
              <div className="stat-card-header">
                <span className="stat-card-label">Total Revenue</span>
                <div className="stat-card-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>💰</div>
              </div>
              <div className="stat-card-value">₹{(revenueData.summary?.revenue || 0).toLocaleString('en-IN')}</div>
              <div className="stat-card-sub">{revenueData.summary?.paidCount || 0} paid transactions</div>
            </div>

            <div className="stat-card" style={{ '--card-accent': '#FF6B35' }}>
              <div className="stat-card-header">
                <span className="stat-card-label">Total Bookings</span>
                <div className="stat-card-icon">📋</div>
              </div>
              <div className="stat-card-value">{revenueData.summary?.totalBookings || 0}</div>
              <div className="stat-card-sub">{revenueData.summary?.completedBookings || 0} completed</div>
            </div>

            <div className="stat-card" style={{ '--card-accent': '#8B5CF6' }}>
              <div className="stat-card-header">
                <span className="stat-card-label">Avg. Revenue / Booking</span>
                <div className="stat-card-icon" style={{ background: 'var(--purple-bg)', color: 'var(--purple)' }}>📊</div>
              </div>
              <div className="stat-card-value">
                ₹{revenueData.summary?.paidCount > 0
                  ? Math.round(revenueData.summary.revenue / revenueData.summary.paidCount)
                  : 0}
              </div>
              <div className="stat-card-sub">per paid booking</div>
            </div>
          </div>

          {/* Revenue Chart */}
          <div className="chart-card">
            <div className="chart-card-header">
              <h3>
                Revenue Trend {revenueData.hourlyBreakdown ? '(Hourly)' : '(Daily)'}
              </h3>
            </div>
            <MiniBarChart data={chartData} height={160} color="#FF6B35" />
          </div>

          {/* Payment Method Breakdown & Status */}
          <div className="two-col">
            <div className="chart-card">
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 16 }}>
                Payment Method Split
              </h3>
              <div className="breakdown-list">
                {Object.entries(revenueData.paymentBreakdown || {}).map(([method, val]) => (
                  <div key={method} className="breakdown-item">
                    <div className="breakdown-item-label">
                      <span className="breakdown-item-dot" style={{ background: 'var(--accent)' }} />
                      <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{method}</span>
                    </div>
                    <div className="breakdown-item-value">
                      ₹{val.amount.toLocaleString('en-IN')} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({val.count} txns)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="chart-card">
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 16 }}>
                Payment Status Summary
              </h3>
              <div className="breakdown-list">
                <div className="breakdown-item">
                  <div className="breakdown-item-label">
                    <span className="breakdown-item-dot" style={{ background: 'var(--success)' }} />
                    <span>Completed</span>
                  </div>
                  <div className="breakdown-item-value" style={{ color: 'var(--success)' }}>
                    ₹{(revenueData.paymentStatus?.completed?.total || 0).toLocaleString('en-IN')} ({revenueData.paymentStatus?.completed?.count || 0})
                  </div>
                </div>
                <div className="breakdown-item">
                  <div className="breakdown-item-label">
                    <span className="breakdown-item-dot" style={{ background: 'var(--warning)' }} />
                    <span>Pending</span>
                  </div>
                  <div className="breakdown-item-value" style={{ color: 'var(--warning)' }}>
                    ₹{(revenueData.paymentStatus?.pending?.total || 0).toLocaleString('en-IN')} ({revenueData.paymentStatus?.pending?.count || 0})
                  </div>
                </div>
                <div className="breakdown-item">
                  <div className="breakdown-item-label">
                    <span className="breakdown-item-dot" style={{ background: 'var(--danger)' }} />
                    <span>Failed</span>
                  </div>
                  <div className="breakdown-item-value" style={{ color: 'var(--danger)' }}>
                    ₹{(revenueData.paymentStatus?.failed?.total || 0).toLocaleString('en-IN')} ({revenueData.paymentStatus?.failed?.count || 0})
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
