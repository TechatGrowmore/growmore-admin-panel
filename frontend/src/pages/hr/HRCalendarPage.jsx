import { useState, useEffect } from 'react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function HRCalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [schedules, setSchedules] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [allEmployees, setAllEmployees] = useState([]);
  const [allPartTime, setAllPartTime] = useState([]);
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
    const [ftRes, ptRes] = await Promise.all([
      fetch('/api/employees/fulltime?status=verified', { credentials: 'include' }),
      fetch('/api/employees/parttime?status=approved', { credentials: 'include' }),
    ]);
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
    if (existing) {
      setSelectedSchedule({
        fullTimeDrivers: existing.fullTimeDrivers?.map(d => d.id || d._id) || [],
        partTimeDrivers: existing.partTimeDrivers?.map(d => d.id || d._id) || [],
        notes: existing.notes || '',
      });
    } else {
      setSelectedSchedule({ fullTimeDrivers: [], partTimeDrivers: [], notes: '' });
    }
  };

  const toggleDriver = (id, type) => {
    setSelectedSchedule(prev => {
      const arr = prev[type];
      return { ...prev, [type]: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] };
    });
  };

  const saveSchedule = async () => {
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
            const ptCount = sched?.partTimeDrivers?.length || 0;
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
                    🚗 {ptCount} PT
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Full-time */}
                <div>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 10, color: 'var(--accent)' }}>
                    👤 Full-Time Drivers
                  </h3>
                  {allEmployees.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No verified FT drivers</p>
                  ) : (
                    <div className="site-select-box">
                      {allEmployees.map(emp => (
                        <label key={emp.id} className="site-checkbox-item">
                          <input type="checkbox" checked={selectedSchedule.fullTimeDrivers.includes(emp.id)}
                            onChange={() => toggleDriver(emp.id, 'fullTimeDrivers')}
                            style={{ accentColor: 'var(--accent)' }} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{emp.firstName} {emp.lastName}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{emp.phone}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Part-time */}
                <div>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 10, color: 'var(--amber)' }}>
                    🚗 Part-Time Drivers
                  </h3>
                  {allPartTime.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No approved PT drivers</p>
                  ) : (
                    <div className="site-select-box">
                      {allPartTime.map(d => (
                        <label key={d.id} className="site-checkbox-item">
                          <input type="checkbox" checked={selectedSchedule.partTimeDrivers.includes(d.id)}
                            onChange={() => toggleDriver(d.id, 'partTimeDrivers')}
                            style={{ accentColor: 'var(--amber)' }} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{d.firstName} {d.lastName}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{d.phone}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 16 }}>
                <label>Notes for this day</label>
                <textarea className="form-input" rows={2} value={selectedSchedule.notes}
                  onChange={e => setSelectedSchedule(s => ({ ...s, notes: e.target.value }))}
                  placeholder="Add any shift notes..." style={{ resize: 'vertical' }} />
              </div>

              <div style={{ marginTop: 12, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {selectedSchedule.fullTimeDrivers.length} FT + {selectedSchedule.partTimeDrivers.length} PT drivers scheduled
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedDate(null)}>Cancel</button>
              <button className="btn-primary" style={{ width: 'auto', padding: '9px 20px' }} onClick={saveSchedule} disabled={saving}>
                {saving ? 'Saving...' : 'Save Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
