import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useHRAuth } from '../../context/HRAuthContext';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function HRCalendarPage() {
  const { user } = useHRAuth();
  const canEdit = user?.role === 'hr'; // accountant gets a read-only view
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [schedules, setSchedules] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [allEmployees, setAllEmployees] = useState([]);
  const [allPartTime, setAllPartTime] = useState([]);
  const [venues, setVenues] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/employees/schedule?month=${month}&year=${year}`, { credentials: 'include' });
      const data = res.ok ? await res.json() : { schedules: [] };
      const map = {};
      (data.schedules || []).forEach(s => { map[s.date] = s; });
      setSchedules(map);
    } catch { } finally { setLoading(false); }
  };

  const loadEmployees = async () => {
    const [ftRes, ptRes, vRes] = await Promise.all([
      fetch('/api/employees/fulltime?status=verified', { credentials: 'include' }),
      fetch('/api/employees/parttime?status=approved', { credentials: 'include' }),
      fetch('/api/employees/venues?active=true', { credentials: 'include' }),
    ]);
    if (vRes.ok) setVenues((await vRes.json()).venues || []);
    const ftData = ftRes.ok ? await ftRes.json() : { employees: [] };
    const ptData = ptRes.ok ? await ptRes.json() : { drivers: [] };
    setAllEmployees(ftData.employees || []);
    setAllPartTime(ptData.drivers || []);
  };

  useEffect(() => { loadSchedules(); }, [year, month]);
  useEffect(() => { loadEmployees(); }, []);

  const openDay = async (dateStr) => {
    setSelectedDate(dateStr);
    const existing = schedules[dateStr];
    const idOf = (x) => (x && typeof x === 'object' ? (x.id || x._id) : x);
    let assignments = (existing?.partTimeAssignments || []).map(a => ({
      driver: idOf(a.driver), venue: idOf(a.venue) || '', amount: a.amount ?? '',
    }));
    if (assignments.length === 0 && existing?.partTimeDrivers?.length) {
      // legacy day with drivers but no venue / pay yet
      assignments = existing.partTimeDrivers.map(d => ({ driver: idOf(d), venue: '', amount: '' }));
    }
    setSelectedSchedule({
      fullTimeDrivers: existing?.fullTimeDrivers?.map(d => d.id || d._id) || [],
      partTimeAssignments: assignments,
      notes: existing?.notes || '',
    });
  };

  const toggleDriver = (id) => {
    setSelectedSchedule(prev => ({
      ...prev,
      fullTimeDrivers: prev.fullTimeDrivers.includes(id) ? prev.fullTimeDrivers.filter(x => x !== id) : [...prev.fullTimeDrivers, id],
    }));
  };

  const togglePartTime = (id) => {
    setSelectedSchedule(prev => {
      const has = prev.partTimeAssignments.some(a => a.driver === id);
      return {
        ...prev,
        partTimeAssignments: has
          ? prev.partTimeAssignments.filter(a => a.driver !== id)
          : [...prev.partTimeAssignments, { driver: id, venue: '', amount: '' }],
      };
    });
  };

  const updateAssignment = (id, patch) => {
    setSelectedSchedule(prev => ({
      ...prev,
      partTimeAssignments: prev.partTimeAssignments.map(a => (a.driver === id ? { ...a, ...patch } : a)),
    }));
  };

  // Plain-text version of the day's part-time assignments, for sharing
  const buildShareText = () => {
    const dateLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const saved = schedules[selectedDate]?.partTimeAssignments || [];
    const lines = (canEdit ? selectedSchedule.partTimeAssignments : saved).map((a, i) => {
      const id = a.driver?.id || a.driver;
      const d = allPartTime.find(x => x.id === id) || a.driver || {};
      const name = `${d.firstName || ''} ${d.lastName || ''}`.trim() || 'Driver';
      const venue = venues.find(v => v.id === (a.venue?.id || a.venue))?.name || a.venueName || '—';
      return `${i + 1}. ${name} - ${venue} - ₹${Number(a.amount || 0).toLocaleString('en-IN')}`;
    });
    return ['DATE - ' + dateLabel, 'Part Time Drivers :', ...lines].join('\n');
  };

  const shareCount = canEdit ? selectedSchedule?.partTimeAssignments.length : (schedules[selectedDate]?.partTimeAssignments || []).length;

  const copyShareText = async () => {
    const text = buildShareText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    showToast('Schedule copied!');
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(buildShareText())}`, '_blank', 'noopener');
  };

  const saveSchedule = async () => {
    const incomplete = selectedSchedule.partTimeAssignments.find(a => !a.venue || a.amount === '' || Number(a.amount) < 0);
    if (incomplete) { showToast('Select a venue and enter the payment for every part-time driver'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/employees/schedule/${selectedDate}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedSchedule),
      });
      const data = await res.json();
      if (res.ok) {
        setSchedules(prev => ({ ...prev, [selectedDate]: data.schedule }));
        showToast('Schedule saved!');
        setSelectedDate(null);
      } else {
        showToast(data.message || 'Failed to save schedule');
      }
    } catch { } finally { setSaving(false); }
  };

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayStr = today.toISOString().split('T')[0];

  return (
    <div>
      {toast && <div className="toast-container"><div className="toast toast-success">{toast}</div></div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Schedule Calendar</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Assign drivers to work shifts by day</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn-secondary btn-small" onClick={() => {
            if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1);
          }}>‹ Prev</button>
          <span style={{ fontWeight: 700, minWidth: 140, textAlign: 'center', fontSize: '0.95rem' }}>
            {MONTHS[month - 1]} {year}
          </span>
          <button className="btn-secondary btn-small" onClick={() => {
            if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1);
          }}>Next ›</button>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
          {DAYS.map(d => (
            <div key={d} style={{ padding: '10px 4px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{d}</div>
          ))}
        </div>

        {/* Calendar cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} style={{ minHeight: 90, borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)', opacity: 0.4 }} />;
            const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const sched = schedules[dateStr];
            const ftCount = sched?.fullTimeDrivers?.length || 0;
            const ptCount = sched?.partTimeAssignments?.length || sched?.partTimeDrivers?.length || 0;
            const ptTotal = (sched?.partTimeAssignments || []).reduce((sum, a) => sum + (a.amount || 0), 0);
            const isToday = dateStr === todayStr;
            const isPast = dateStr < todayStr;

            return (
              <div key={day}
                onClick={() => openDay(dateStr)}
                style={{
                  minHeight: 90, padding: 8, cursor: 'pointer',
                  borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
                  background: isToday ? 'var(--accent-glow)' : 'var(--bg-card)',
                  transition: 'background 0.15s',
                  opacity: isPast ? 0.7 : 1,
                }}
                onMouseEnter={e => !isPast && (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                onMouseLeave={e => e.currentTarget.style.background = isToday ? 'var(--accent-glow)' : 'var(--bg-card)'}
              >
                <div style={{
                  fontWeight: isToday ? 800 : 600,
                  fontSize: '0.9rem',
                  color: isToday ? 'var(--accent)' : 'var(--text-primary)',
                  marginBottom: 6,
                }}>
                  {day}
                  {isToday && <span style={{ fontSize: '0.6rem', marginLeft: 4, fontWeight: 700, color: 'var(--accent)' }}>TODAY</span>}
                </div>
                {ftCount > 0 && (
                  <div style={{ fontSize: '0.7rem', background: 'var(--accent-glow)', color: 'var(--accent)', padding: '2px 6px', borderRadius: 4, marginBottom: 3, fontWeight: 600 }}>
                    👤 {ftCount} FT
                  </div>
                )}
                {ptCount > 0 && (
                  <div style={{ fontSize: '0.7rem', background: 'var(--amber-glow)', color: 'var(--amber)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                    🚗 {ptCount} PT{ptTotal > 0 ? ` · ${money(ptTotal)}` : ''}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Schedule Modal */}
      {selectedDate && selectedSchedule && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedDate(null)}>
          <div className="modal-content" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h2>Schedule for {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h2>
              <button className="modal-close" onClick={() => setSelectedDate(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              {/* Part-time: venue + pay per driver for this day */}
              <div>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 10, color: 'var(--amber)' }}>
                  🚗 Part-Time Drivers — venue &amp; pay for this day
                </h3>
                {canEdit && venues.length === 0 && (
                  <div className="login-error" style={{ marginBottom: 10 }}>
                    No venues yet. <Link to="/hr/dashboard/venues" style={{ color: 'inherit', fontWeight: 700 }}>Add a venue</Link> first, then assign drivers.
                  </div>
                )}
                {canEdit ? (
                  allPartTime.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No approved PT drivers</p>
                  ) : allPartTime.map(d => {
                    const a = selectedSchedule.partTimeAssignments.find(x => x.driver === d.id);
                    return (
                      <div key={d.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!a} onChange={() => togglePartTime(d.id)} style={{ accentColor: 'var(--amber)' }} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{d.firstName} {d.lastName}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{d.phone}</div>
                          </div>
                        </label>
                        {a && (
                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginTop: 8, marginLeft: 26 }}>
                            <select className="form-input" value={a.venue} onChange={e => updateAssignment(d.id, { venue: e.target.value })}>
                              <option value="">Select venue</option>
                              {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                              {a.venue && !venues.some(v => v.id === a.venue) && <option value={a.venue}>(inactive venue)</option>}
                            </select>
                            <input className="form-input" type="number" min="0" placeholder="Pay ₹" value={a.amount}
                              onChange={e => updateAssignment(d.id, { amount: e.target.value })} />
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  (schedules[selectedDate]?.partTimeAssignments || []).length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No part-time drivers assigned for this day</p>
                  ) : (
                    <table className="data-table" style={{ minWidth: 0 }}>
                      <thead><tr><th>Driver</th><th>Venue</th><th>Pay</th></tr></thead>
                      <tbody>
                        {schedules[selectedDate].partTimeAssignments.map((a, i) => (
                          <tr key={i}>
                            <td>{a.driver?.firstName} {a.driver?.lastName}<div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{a.driver?.phone}</div></td>
                            <td>{a.venueName || '—'}</td>
                            <td><strong>{money(a.amount)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}
              </div>

              <div className="form-group" style={{ marginTop: 16 }}>
                <label>Notes for this day</label>
                <textarea className="form-input" rows={2} value={selectedSchedule.notes}
                  onChange={e => setSelectedSchedule(s => ({ ...s, notes: e.target.value }))} disabled={!canEdit}
                  placeholder="Add any shift notes..." style={{ resize: 'vertical' }} />
              </div>

              <div style={{ marginTop: 12, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {selectedSchedule.partTimeAssignments.length} part-time driver{selectedSchedule.partTimeAssignments.length === 1 ? '' : 's'} scheduled
                {selectedSchedule.partTimeAssignments.length > 0 && ` · PT total ${money(selectedSchedule.partTimeAssignments.reduce((t, a) => t + (Number(a.amount) || 0), 0))}`}
              </div>
            </div>
            <div className="modal-footer">
              {shareCount > 0 && (
                <>
                  <button className="btn-secondary" onClick={copyShareText}>📋 Copy</button>
                  <button className="btn-secondary" onClick={shareWhatsApp}>💬 WhatsApp</button>
                </>
              )}
              <button className="btn-secondary" onClick={() => setSelectedDate(null)}>{canEdit ? 'Cancel' : 'Close'}</button>
              {canEdit && (
                <button className="btn-primary" style={{ width: 'auto', padding: '9px 20px' }} onClick={saveSchedule} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Schedule'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
