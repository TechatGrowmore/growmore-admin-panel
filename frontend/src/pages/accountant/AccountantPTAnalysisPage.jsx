import { useState, useEffect, useMemo } from 'react';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const pad = (n) => String(n).padStart(2, '0');
const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => new Date(`${s}T12:00:00`);
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return toStr(d); };
const mondayOf = (s) => { const d = parse(s); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return toStr(d); };
const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—');
const fmtDay = (s, opts) => parse(s).toLocaleDateString('en-IN', opts || { weekday: 'short', day: 'numeric', month: 'short' });
const hoursOf = (r) => (r.punchInTime && r.punchOutTime ? (new Date(r.punchOutTime) - new Date(r.punchInTime)) / 36e5 : 0);

const STATUS = {
  completed: ['badge-success', 'Worked'],
  inprogress: ['badge-info', 'On shift'],
  noout: ['badge-warning', 'No punch-out'],
  absent: ['badge-danger', 'Absent'],
  pending: ['badge-warning', 'Not punched yet'],
  upcoming: ['badge-neutral', 'Upcoming'],
};

function statusOf(r, today) {
  if (r.punchInTime) {
    if (r.punchOutTime) return 'completed';
    return r.date === today ? 'inprogress' : 'noout';
  }
  if (r.date > today) return 'upcoming';
  return r.date === today ? 'pending' : 'absent';
}

function Kpi({ label, value, sub, color }) {
  return (
    <div className="stat-card" style={{ '--card-accent': color || 'var(--accent)' }}>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">{value}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function summarise(rows, today) {
  const worked = rows.filter(r => r.punchInTime);
  const past = rows.filter(r => r.date < today);
  return {
    assigned: rows.length,
    worked: worked.length,
    absent: past.filter(r => !r.punchInTime).length,
    assignedAmount: rows.reduce((t, r) => t + r.amount, 0),
    payable: worked.reduce((t, r) => t + r.amount, 0),
    missed: past.filter(r => !r.punchInTime).reduce((t, r) => t + r.amount, 0),
    upcoming: rows.filter(r => r.date > today).reduce((t, r) => t + r.amount, 0),
    hours: rows.reduce((t, r) => t + hoursOf(r), 0),
  };
}

export default function AccountantPTAnalysisPage() {
  const today = toStr(new Date());
  const [date, setDate] = useState(today);
  const [data, setData] = useState({ rows: [], unassignedPunches: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const weekStart = mondayOf(date);
  const weekEnd = addDays(weekStart, 6);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    fetch(`/api/employees/analysis/parttime?from=${weekStart}&to=${weekEnd}`, { credentials: 'include' })
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => { if (!cancelled) { if (ok) setData(d); else setError(d.message || 'Failed to load'); } })
      .catch(() => !cancelled && setError('Failed to load'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [weekStart, weekEnd]);

  const { rows, unassignedPunches } = data;
  const dayRows = useMemo(() => rows.filter(r => r.date === date).sort((a, b) => a.venueName.localeCompare(b.venueName)), [rows, date]);
  const day = useMemo(() => summarise(dayRows, today), [dayRows, today]);
  const week = useMemo(() => summarise(rows, today), [rows, today]);

  const drivers = useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      if (!map.has(r.driverId)) map.set(r.driverId, { id: r.driverId, name: r.driverName, phone: r.phone, rows: [] });
      map.get(r.driverId).rows.push(r);
    });
    return [...map.values()]
      .map(d => ({ ...d, ...summarise(d.rows, today), venues: [...new Set(d.rows.map(r => r.venueName))] }))
      .sort((a, b) => b.payable - a.payable);
  }, [rows, today]);

  const venues = useMemo(() => {
    const map = new Map();
    rows.forEach(r => { if (!map.has(r.venueName)) map.set(r.venueName, []); map.get(r.venueName).push(r); });
    return [...map.entries()]
      .map(([name, vr]) => ({ name, drivers: new Set(vr.map(r => r.driverId)).size, ...summarise(vr, today) }))
      .sort((a, b) => b.assignedAmount - a.assignedAmount);
  }, [rows, today]);

  const trend = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return { date: d, ...summarise(rows.filter(r => r.date === d), today) };
  }), [rows, weekStart, today]);
  const maxTrend = Math.max(1, ...trend.map(t => t.assignedAmount));

  const attendance = week.assigned - rows.filter(r => r.date > today).length > 0
    ? Math.round((week.worked / (week.assigned - rows.filter(r => r.date > today).length)) * 100) : null;
  const noOut = rows.filter(r => statusOf(r, today) === 'noout');
  const absentRows = rows.filter(r => statusOf(r, today) === 'absent');
  const perfect = drivers.filter(d => d.absent === 0 && d.worked > 0 && d.worked === d.rows.filter(r => r.date <= today).length);

  const exportCsv = () => {
    const header = ['Driver', 'Phone', 'Venues', 'Assigned days', 'Worked days', 'Absent days', 'Hours', 'Assigned amount', 'Payable (worked days)', 'Missed amount'];
    const lines = drivers.map(d => [d.name, d.phone, d.venues.join(' / '), d.assigned, d.worked, d.absent, d.hours.toFixed(1), d.assignedAmount, d.payable, d.missed]);
    const csv = [header, ...lines].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `part-time-weekly-${weekStart}_to_${weekEnd}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const badge = (key) => <span className={`badge ${STATUS[key][0]}`}>{STATUS[key][1]}</span>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Part-Time Driver Analysis</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Venues, pay and attendance of part-time drivers, by day and by week</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn-secondary btn-small" onClick={() => setDate(addDays(date, -1))}>‹</button>
          <input type="date" className="filter-input" value={date} onChange={e => e.target.value && setDate(e.target.value)} />
          <button className="btn-secondary btn-small" onClick={() => setDate(addDays(date, 1))}>›</button>
          <button className="btn-secondary btn-small" onClick={() => setDate(today)}>Today</button>
        </div>
      </div>

      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}
      {loading && <div className="page-loading" style={{ minHeight: 60 }}><div className="spinner" /></div>}

      {/* ── Selected day ─────────────────────────────────────────── */}
      <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '8px 0 12px' }}>
        📅 {fmtDay(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </h2>
      <div className="stats-grid">
        <Kpi label="Drivers Assigned" value={day.assigned} color="var(--accent)" />
        <Kpi label="Punched In" value={day.worked} sub={day.assigned ? `${Math.round((day.worked / day.assigned) * 100)}% of assigned` : ''} color="var(--success)" />
        <Kpi label="Assigned Pay" value={money(day.assignedAmount)} color="var(--info)" />
        <Kpi label="Payable (worked)" value={money(day.payable)} color="var(--amber)" />
      </div>
      <div className="data-table-container" style={{ marginBottom: 28 }}>
        <table className="data-table">
          <thead><tr><th>Driver</th><th>Venue</th><th>Payment</th><th>Punch In</th><th>Punch Out</th><th>Hours</th><th>Status</th></tr></thead>
          <tbody>
            {dayRows.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No part-time drivers were assigned on this day</td></tr>
            ) : dayRows.map(r => (
              <tr key={r.driverId}>
                <td><strong>{r.driverName}</strong><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{r.phone}</div></td>
                <td>{r.venueName}</td>
                <td><strong>{money(r.amount)}</strong></td>
                <td>{fmtTime(r.punchInTime)}</td>
                <td>{fmtTime(r.punchOutTime)}</td>
                <td>{hoursOf(r) ? hoursOf(r).toFixed(1) : '—'}</td>
                <td>{badge(statusOf(r, today))}</td>
              </tr>
            ))}
          </tbody>
          {dayRows.length > 0 && (
            <tfoot><tr style={{ fontWeight: 700 }}>
              <td colSpan="2">Total</td><td>{money(day.assignedAmount)}</td><td colSpan="4">Payable for worked shifts: {money(day.payable)}</td>
            </tr></tfoot>
          )}
        </table>
      </div>

      {/* ── Week ─────────────────────────────────────────────────── */}
      <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '8px 0 12px' }}>
        🗓️ Week: {fmtDay(weekStart, { day: 'numeric', month: 'short' })} – {fmtDay(weekEnd, { day: 'numeric', month: 'short', year: 'numeric' })}
      </h2>
      <div className="stats-grid">
        <Kpi label="Assigned Shifts" value={week.assigned} sub={`${drivers.length} driver${drivers.length === 1 ? '' : 's'}`} color="var(--accent)" />
        <Kpi label="Worked Shifts" value={week.worked} sub={attendance === null ? 'No past shifts yet' : `${attendance}% attendance`} color="var(--success)" />
        <Kpi label="Total Assigned Pay" value={money(week.assignedAmount)} sub="sum of all assigned days" color="var(--info)" />
        <Kpi label="Payable (worked)" value={money(week.payable)} sub={week.worked ? `avg ${money(Math.round(week.payable / week.worked))} / shift` : ''} color="var(--amber)" />
        <Kpi label="Missed Pay" value={money(week.missed)} sub={`${week.absent} absent shift${week.absent === 1 ? '' : 's'}`} color="var(--danger)" />
        <Kpi label="Upcoming Pay" value={money(week.upcoming)} sub="shifts still to come" color="var(--purple)" />
        <Kpi label="Hours Worked" value={week.hours.toFixed(1)} sub={week.hours ? `${money(Math.round(week.payable / week.hours))} per hour` : ''} color="var(--accent)" />
      </div>

      <div className="data-table-container" style={{ marginBottom: 28 }}>
        <div className="data-table-header" style={{ justifyContent: 'space-between' }}>
          <h3>Weekly summary by driver</h3>
          <button className="btn-secondary btn-small" onClick={exportCsv} disabled={drivers.length === 0}>⬇ Export CSV</button>
        </div>
        <table className="data-table">
          <thead><tr><th>Driver</th><th>Venues</th><th>Assigned days</th><th>Worked days</th><th>Absent</th><th>Hours</th><th>Assigned pay</th><th>Payable</th><th>Missed</th></tr></thead>
          <tbody>
            {drivers.length === 0 ? (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No assignments this week</td></tr>
            ) : drivers.map(d => (
              <tr key={d.id}>
                <td><strong>{d.name}</strong><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{d.phone}</div></td>
                <td style={{ fontSize: '0.8rem', whiteSpace: 'normal' }}>{d.venues.join(', ')}</td>
                <td>{d.assigned}</td>
                <td>{d.worked}</td>
                <td style={{ color: d.absent ? 'var(--danger)' : undefined }}>{d.absent}</td>
                <td>{d.hours ? d.hours.toFixed(1) : '—'}</td>
                <td>{money(d.assignedAmount)}</td>
                <td><strong>{money(d.payable)}</strong></td>
                <td style={{ color: d.missed ? 'var(--danger)' : undefined }}>{money(d.missed)}</td>
              </tr>
            ))}
          </tbody>
          {drivers.length > 0 && (
            <tfoot><tr style={{ fontWeight: 700 }}>
              <td colSpan="2">Total</td><td>{week.assigned}</td><td>{week.worked}</td><td>{week.absent}</td>
              <td>{week.hours.toFixed(1)}</td><td>{money(week.assignedAmount)}</td><td>{money(week.payable)}</td><td>{money(week.missed)}</td>
            </tr></tfoot>
          )}
        </table>
      </div>

      {/* ── Daily trend ─────────────────────────────────────────── */}
      <div className="chart-card" style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 14 }}>Daily pay this week</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8, alignItems: 'end', height: 150 }}>
          {trend.map(t => (
            <div key={t.date} onClick={() => setDate(t.date)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 4 }}>{t.assignedAmount ? money(t.assignedAmount) : ''}</div>
              <div style={{ width: '100%', maxWidth: 40, height: `${(t.assignedAmount / maxTrend) * 100}%`, minHeight: t.assignedAmount ? 4 : 0, background: 'var(--info-bg)', borderRadius: 6, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${t.assignedAmount ? (t.payable / t.assignedAmount) * 100 : 0}%`, background: 'var(--success)' }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8, marginTop: 6 }}>
          {trend.map(t => (
            <div key={t.date} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: t.date === date ? 800 : 500, color: t.date === date ? 'var(--accent)' : 'var(--text-muted)' }}>
              {fmtDay(t.date, { weekday: 'short' })}<br />{parse(t.date).getDate()}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--success)', borderRadius: 2, marginRight: 4 }} />Payable (worked)</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--info-bg)', border: '1px solid var(--info)', borderRadius: 2, marginRight: 4 }} />Assigned</span>
        </div>
      </div>

      {/* ── Venue breakdown ─────────────────────────────────────── */}
      <div className="data-table-container" style={{ marginBottom: 28 }}>
        <div className="data-table-header"><h3>Venue-wise cost this week</h3></div>
        <table className="data-table">
          <thead><tr><th>Venue</th><th>Drivers</th><th>Shifts</th><th>Worked</th><th>Assigned pay</th><th>Payable</th><th>Share of cost</th></tr></thead>
          <tbody>
            {venues.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No assignments this week</td></tr>
            ) : venues.map(v => (
              <tr key={v.name}>
                <td><strong>{v.name}</strong></td>
                <td>{v.drivers}</td><td>{v.assigned}</td><td>{v.worked}</td>
                <td>{money(v.assignedAmount)}</td><td><strong>{money(v.payable)}</strong></td>
                <td>{week.assignedAmount ? `${Math.round((v.assignedAmount / week.assignedAmount) * 100)}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Insights ────────────────────────────────────────────── */}
      <div className="chart-card">
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 12 }}>Insights &amp; things to check</h3>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9, fontSize: '0.86rem' }}>
          {drivers.length === 0 && <li style={{ color: 'var(--text-muted)' }}>No assignments this week, so there is nothing to analyse yet.</li>}
          {drivers[0] && drivers[0].payable > 0 && <li>Highest earner: <strong>{drivers[0].name}</strong> with {money(drivers[0].payable)} from {drivers[0].worked} worked day{drivers[0].worked === 1 ? '' : 's'}.</li>}
          {perfect.length > 0 && <li>Full attendance so far: {perfect.map(d => d.name).join(', ')}.</li>}
          {absentRows.length > 0 && (
            <li style={{ color: 'var(--danger)' }}>
              {absentRows.length} assigned shift{absentRows.length === 1 ? '' : 's'} with no punch-in ({money(absentRows.reduce((t, r) => t + r.amount, 0))} not payable):{' '}
              {absentRows.map(r => `${r.driverName} (${fmtDay(r.date)})`).join(', ')}.
            </li>
          )}
          {noOut.length > 0 && (
            <li style={{ color: 'var(--warning)' }}>
              Missing punch-out, please confirm hours: {noOut.map(r => `${r.driverName} (${fmtDay(r.date)})`).join(', ')}.
            </li>
          )}
          {unassignedPunches.length > 0 && (
            <li style={{ color: 'var(--warning)' }}>
              Punched in without being assigned: {unassignedPunches.map(p => `${p.driverName} (${fmtDay(p.date)})`).join(', ')}.
            </li>
          )}
          {venues[0] && venues.length > 1 && <li>Costliest venue: <strong>{venues[0].name}</strong> ({money(venues[0].assignedAmount)}, {Math.round((venues[0].assignedAmount / week.assignedAmount) * 100)}% of the week).</li>}
          {week.missed === 0 && week.worked > 0 && absentRows.length === 0 && <li style={{ color: 'var(--success)' }}>No missed shifts this week.</li>}
        </ul>
      </div>
    </div>
  );
}
