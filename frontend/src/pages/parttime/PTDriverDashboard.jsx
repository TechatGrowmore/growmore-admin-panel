import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePTDriverAuth } from '../../context/PTDriverAuthContext';
import growmoreLogo from '../../assets/Growmore-logo.jpg';
import DriverProfileView from '../../components/DriverProfileView';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function Toast({ msg, onClose }) {
  useEffect(() => {
    if (msg) { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }
  }, [msg, onClose]);
  if (!msg) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
      background: '#1a1a2e', color: '#fff', padding: '12px 24px', borderRadius: 30,
      fontWeight: 600, fontSize: '0.9rem', zIndex: 9999, boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', gap: 10, maxWidth: 380, textAlign: 'center',
    }}>
      {msg}
    </div>
  );
}

export default function PTDriverDashboard() {
  const navigate = useNavigate();
  const { user, setUser } = usePTDriverAuth();
  const [tab, setTab] = useState('home');

  // Data states
  const [profile, setProfile] = useState(null);
  const [punches, setPunches] = useState([]);
  const [todayPunch, setTodayPunch] = useState(null);
  const [assignments, setAssignments] = useState({}); // date -> { venueName, amount }
  const [scheduledDates, setScheduledDates] = useState([]); // dates this driver is scheduled
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const showToast = (m) => setToast(m);

  // Calendar state
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth() + 1);

  // Punch-in state
  const [punchLoading, setPunchLoading] = useState(false);
  const [locationData, setLocationData] = useState({ lat: null, lng: null, address: '' });
  const [locLoading, setLocLoading] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);

  // ── Load data ────────────────────────────────────────────────────────────────
  const loadData = async () => {
    try {
      setLoading(true);
      const [profileRes, punchRes] = await Promise.all([
        fetch('/api/employees/parttime/me', { credentials: 'include' }),
        fetch('/api/employees/punches/parttime/me', { credentials: 'include' }),
      ]);
      if (profileRes.ok) { const d = await profileRes.json(); setProfile(d.driver); }
      if (punchRes.ok) {
        const d = await punchRes.json();
        const ps = d.punches || [];
        setPunches(ps);
        setTodayPunch(ps.find(p => p.date === todayStr) || null);
      }
      await loadSchedules(today.getFullYear(), today.getMonth() + 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadSchedules = async (year, month) => {
    try {
      const res = await fetch(`/api/employees/schedule/parttime/me?month=${month}&year=${year}`, { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setScheduledDates((d.schedules || []).map(s => s.date));
        setAssignments(prev => {
          const next = { ...prev };
          (d.schedules || []).forEach(s => { if (s.myAssignment) next[s.date] = s.myAssignment; });
          return next;
        });
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { loadSchedules(calYear, calMonth); }, [calYear, calMonth]);

  // ── Geolocation ──────────────────────────────────────────────────────────────
  const getLocation = () => {
    if (!navigator.geolocation) { setLocationData({ lat: null, lng: null, address: 'Geolocation not supported' }); return; }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          if (r.ok) { const d = await r.json(); address = d.display_name || address; }
        } catch {}
        setLocationData({ lat, lng, address });
        setLocLoading(false);
      },
      () => { setLocationData({ lat: null, lng: null, address: 'Location unavailable' }); setLocLoading(false); },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  // ── Camera ───────────────────────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);
    } catch { setCameraActive(false); }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const c = canvasRef.current;
    const v = videoRef.current;
    c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    setCapturedPhoto(c.toDataURL('image/jpeg', 0.85));
    stopCamera();
  };

  const retakePhoto = () => { setCapturedPhoto(null); startCamera(); };

  useEffect(() => () => stopCamera(), []);

  // ── Punch In / Out ───────────────────────────────────────────────────────────
  const handlePunch = async (action) => {
    setPunchLoading(true);
    try {
      const fd = new FormData();
      fd.append('action', action);
      fd.append('lat', locationData.lat || '');
      fd.append('lng', locationData.lng || '');
      fd.append('address', locationData.address || '');

      if (capturedPhoto) {
        const blob = await (await fetch(capturedPhoto)).blob();
        fd.append('photo', blob, `${action}_${todayStr}.jpg`);
      }

      const res = await fetch('/api/employees/punches/parttime/me', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Punch failed');

      setTodayPunch(data.punch);
      setPunches(prev => {
        const filtered = prev.filter(p => p.date !== todayStr);
        return [data.punch, ...filtered];
      });
      setCapturedPhoto(null);
      stopCamera();
      showToast(action === 'punchin' ? '✅ Punch-In recorded!' : '✅ Punch-Out recorded!');
    } catch (err) {
      showToast(`⚠️ ${err.message || 'Punch failed'}`);
    } finally {
      setPunchLoading(false);
    }
  };

  // ── Logout ───────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await fetch('/api/ptdriver/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    navigate('/parttime/login', { replace: true });
  };

  // ── Calendar ─────────────────────────────────────────────────────────────────
  const buildCalendar = () => {
    const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  };

  const getDayStr = (day) => {
    if (!day) return '';
    return `${calYear}-${String(calMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  };

  const getDayStatus = (dayStr) => {
    if (!dayStr) return null;
    const punch = punches.find(p => p.date === dayStr);
    const isScheduled = scheduledDates.includes(dayStr);
    if (punch?.punchOutTime) return 'completed';
    if (punch?.punchInTime) return 'punched-in';
    if (isScheduled) return 'scheduled';
    return null;
  };

  if (loading) {
    return (
      <div className="page-loading" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
        <span>Loading your dashboard...</span>
      </div>
    );
  }

  const driverName = profile ? `${profile.firstName} ${profile.lastName}` : user?.name || 'Driver';

  // ── Navigation tabs ──────────────────────────────────────────────────────────
  const locked = !!profile?.status && profile.status !== 'approved'; // punching unlocks after HR approval
  const tabs = [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'punchin', icon: '📍', label: 'Punch In' },
    { id: 'calendar', icon: '📅', label: 'Calendar' },
    { id: 'profile', icon: '👤', label: 'Profile' },
  ].filter(t => !locked || t.id === 'profile');

  const isPunchedIn = !!todayPunch?.punchInTime;
  const isPunchedOut = !!todayPunch?.punchOutTime;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', paddingBottom: 80 }}>
      <Toast msg={toast} onClose={() => setToast('')} />

      {/* ── Top Header ── */}
      <header style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: '3px 8px' }}>
            <img src={growmoreLogo} alt="GrowMore" style={{ height: 32, objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>
              Hi, {profile?.firstName || user?.firstName} 👋
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Part-Time Driver Portal</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>Part-Time</span>
          <button
            onClick={handleLogout}
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 8,
              padding: '6px 12px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.8rem',
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* ── Page Body ── */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px' }}>

        {/* ══ HOME TAB ═══════════════════════════════════════════════════════════ */}
        {locked && (
          <div style={{ background: 'var(--warning-bg)', color: 'var(--warning)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: '0.85rem' }}>
            Your registration is waiting for HR approval. Punch-in unlocks once you are approved. You can track your document approvals below.
          </div>
        )}

        {!locked && tab === 'home' && (
          <div>
            {/* Today Status Card */}
            <div style={{
              background: 'var(--surface)', borderRadius: 16, padding: '20px', marginBottom: 16,
              border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 4 }}>
                    Today's Attendance
                  </h2>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
                {scheduledDates.includes(todayStr) && (
                  <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>📅 Scheduled Today</span>
                )}
              </div>

              {assignments[todayStr] && (
                <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--surface-sunken)', border: '1px solid var(--border)', marginBottom: 16, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>TODAY'S VENUE</div>
                    <div style={{ fontWeight: 800, fontSize: '1rem' }}>📍 {assignments[todayStr].venueName}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>TODAY'S PAY</div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--success)' }}>{`₹${Number(assignments[todayStr].amount).toLocaleString('en-IN')}`}</div>
                  </div>
                </div>
              )}

              {/* Status Banner */}
              <div style={{
                padding: '16px', borderRadius: 12,
                background: isPunchedOut ? 'var(--success-bg)' : isPunchedIn ? 'var(--accent-glow)' : 'var(--warning-bg)',
                border: `1px solid ${isPunchedOut ? 'var(--success)' : isPunchedIn ? 'var(--accent)' : 'var(--warning)'}`,
                marginBottom: 16,
              }}>
                {isPunchedOut ? (
                  <div>
                    <div style={{ fontWeight: 800, color: 'var(--success)', fontSize: '1rem' }}>✅ Shift Completed</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      In: {new Date(todayPunch.punchInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      {' · '}
                      Out: {new Date(todayPunch.punchOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {todayPunch.punchInPhotoUrl && (
                      <img
                        src={todayPunch.punchInPhotoUrl}
                        alt="Punch selfie"
                        onClick={() => window.open(todayPunch.punchInPhotoUrl, '_blank')}
                        style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', marginTop: 10, cursor: 'pointer' }}
                      />
                    )}
                  </div>
                ) : isPunchedIn ? (
                  <div>
                    <div style={{ fontWeight: 800, color: 'var(--accent)', fontSize: '1rem' }}>🟢 Shift In Progress</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      Started at {new Date(todayPunch.punchInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <button
                      className="btn-primary"
                      onClick={() => setTab('punchin')}
                      style={{ marginTop: 12, width: 'auto', padding: '8px 20px', fontSize: '0.85rem' }}
                    >
                      🚪 Punch Out Now
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontWeight: 800, color: 'var(--amber)', fontSize: '1rem' }}>⏳ Not Punched In Yet</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>Tap below to start your shift</div>
                    <button
                      className="btn-primary"
                      onClick={() => { setTab('punchin'); getLocation(); }}
                      style={{ marginTop: 12, width: 'auto', padding: '8px 20px', fontSize: '0.85rem' }}
                    >
                      📍 Punch In Now
                    </button>
                  </div>
                )}
              </div>

              {/* Stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {[
                  { label: 'Total Shifts', value: punches.length, color: 'var(--accent)' },
                  { label: 'This Month', value: punches.filter(p => p.date.startsWith(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`)).length, color: 'var(--success)' },
                  { label: 'Scheduled', value: scheduledDates.length, color: 'var(--purple)' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--surface-sunken)', borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming Scheduled Dates */}
            <div style={{
              background: 'var(--surface)', borderRadius: 16, padding: '20px',
              border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 14 }}>📅 Upcoming Schedule</h3>
              {scheduledDates.filter(d => d >= todayStr).slice(0, 5).length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No upcoming scheduled shifts this month.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {scheduledDates
                    .filter(d => d >= todayStr)
                    .slice(0, 5)
                    .map(d => {
                      const dt = new Date(d + 'T00:00:00');
                      const isToday = d === todayStr;
                      return (
                        <div key={d} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 14px', borderRadius: 10,
                          background: isToday ? 'var(--accent-glow)' : 'var(--surface-sunken)',
                          border: isToday ? '1px solid var(--accent)' : '1px solid transparent',
                        }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: isToday ? 'var(--accent)' : 'var(--text-primary)' }}>
                              {isToday ? '🟢 Today' : dt.toLocaleDateString('en-IN', { weekday: 'long' })}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </div>
                            {assignments[d] && (
                              <div style={{ fontSize: '0.78rem', fontWeight: 600, marginTop: 2 }}>
                                📍 {assignments[d].venueName} · {`₹${Number(assignments[d].amount).toLocaleString('en-IN')}`}
                              </div>
                            )}
                          </div>
                          <span className={`badge ${isToday ? 'badge-success' : 'badge-info'}`} style={{ fontSize: '0.7rem' }}>
                            {isToday ? 'Active' : 'Scheduled'}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ PUNCH IN TAB ════════════════════════════════════════════════════════ */}
        {!locked && tab === 'punchin' && (
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 20 }}>
              {isPunchedIn && !isPunchedOut ? '🚪 Punch Out' : '📍 Punch In'}
            </h1>

            {assignments[todayStr] ? (
              <div style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: '0.9rem' }}>
                📍 Your venue today: <strong>{assignments[todayStr].venueName}</strong> · Pay <strong>{`₹${Number(assignments[todayStr].amount).toLocaleString('en-IN')}`}</strong>
              </div>
            ) : (
              <div style={{ background: 'var(--warning-bg)', color: 'var(--warning)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: '0.85rem' }}>
                No venue has been assigned to you for today yet.
              </div>
            )}

            {/* Already completed */}
            {isPunchedOut ? (
              <div style={{
                background: 'var(--success-bg)', border: '1px solid var(--success)',
                borderRadius: 16, padding: '24px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <h2 style={{ color: 'var(--success)', fontWeight: 800 }}>Shift Completed!</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 8 }}>
                  You have already punched in and out for today.
                </p>
                <div style={{ marginTop: 16, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  <strong>In:</strong> {new Date(todayPunch.punchInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}{' · '}
                  <strong>Out:</strong> {new Date(todayPunch.punchOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ) : (
              <>
                {/* Location Card */}
                <div style={{
                  background: 'var(--surface)', borderRadius: 16, padding: '16px 20px', marginBottom: 16,
                  border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 4 }}>📍 Your Location</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {locLoading ? 'Detecting location...' : locationData.address || 'Tap to get location'}
                    </div>
                  </div>
                  <button
                    onClick={getLocation}
                    className="btn-secondary btn-small"
                    style={{ width: 'auto', padding: '6px 14px', fontSize: '0.75rem', flexShrink: 0 }}
                  >
                    {locLoading ? '...' : 'Get GPS'}
                  </button>
                </div>

                {/* Camera / Selfie */}
                <div style={{
                  background: 'var(--surface)', borderRadius: 16, padding: '20px', marginBottom: 16,
                  border: '1px solid var(--border)', textAlign: 'center',
                }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 12 }}>📸 Verification Selfie</div>

                  {capturedPhoto ? (
                    <div>
                      <img src={capturedPhoto} alt="Captured" style={{ width: 140, height: 140, borderRadius: 14, objectFit: 'cover', border: '3px solid var(--accent)', marginBottom: 12 }} />
                      <div>
                        <button onClick={retakePhoto} className="btn-secondary btn-small" style={{ width: 'auto', padding: '6px 16px' }}>
                          🔄 Retake
                        </button>
                      </div>
                    </div>
                  ) : cameraActive ? (
                    <div>
                      <video ref={videoRef} autoPlay playsInline muted
                        style={{ width: '100%', maxWidth: 260, borderRadius: 12, background: '#000', border: '2px solid var(--border)' }}
                      />
                      <canvas ref={canvasRef} style={{ display: 'none' }} />
                      <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <button onClick={capturePhoto} className="btn-primary" style={{ width: 'auto', padding: '8px 20px' }}>
                          📸 Capture
                        </button>
                        <button onClick={stopCamera} className="btn-secondary" style={{ width: 'auto', padding: '8px 14px' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={startCamera} className="btn-secondary" style={{ width: 'auto', padding: '10px 24px', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      📷 Open Camera
                    </button>
                  )}
                </div>

                {/* Punch Buttons */}
                {!isPunchedIn ? (
                  <button
                    className="btn-primary"
                    onClick={() => handlePunch('punchin')}
                    disabled={punchLoading}
                    style={{ padding: '16px', fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
                  >
                    {punchLoading ? <><div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> Recording...</> : '📍 Punch In — Start Shift'}
                  </button>
                ) : (
                  <button
                    onClick={() => handlePunch('punchout')}
                    disabled={punchLoading}
                    style={{
                      width: '100%', background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
                      color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer',
                      padding: '16px', fontSize: '1.05rem', fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      boxShadow: '0 4px 14px rgba(231,76,60,0.3)',
                    }}
                  >
                    {punchLoading ? <><div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> Recording...</> : '🚪 Punch Out — End Shift'}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ══ CALENDAR TAB ════════════════════════════════════════════════════════ */}
        {!locked && tab === 'calendar' && (
          <div>
            {/* Month Navigator */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 20,
            }}>
              <button
                onClick={() => { const d = new Date(calYear, calMonth - 2); setCalMonth(d.getMonth()+1); setCalYear(d.getFullYear()); }}
                className="btn-secondary btn-small"
                style={{ width: 'auto', padding: '6px 14px' }}
              >
                ←
              </button>
              <h2 style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                {MONTHS[calMonth - 1]} {calYear}
              </h2>
              <button
                onClick={() => { const d = new Date(calYear, calMonth); setCalMonth(d.getMonth()+1); setCalYear(d.getFullYear()); }}
                className="btn-secondary btn-small"
                style={{ width: 'auto', padding: '6px 14px' }}
              >
                →
              </button>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, fontSize: '0.75rem' }}>
              {[
                { color: '#2DB84B', label: 'Shift Completed' },
                { color: '#F5A623', label: 'Shift In Progress' },
                { color: '#3498db', label: 'Scheduled by HR' },
                { color: 'var(--text-muted)', label: 'No Shift' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: l.color }} />
                  <span style={{ color: 'var(--text-muted)' }}>{l.label}</span>
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: 'var(--surface-sunken)', borderBottom: '1px solid var(--border)' }}>
                {DAYS_OF_WEEK.map(d => (
                  <div key={d} style={{ textAlign: 'center', padding: '10px 4px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    {d}
                  </div>
                ))}
              </div>
              {/* Days */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
                {buildCalendar().map((day, i) => {
                  const ds = getDayStr(day);
                  const status = getDayStatus(ds);
                  const isToday = ds === todayStr;
                  let bg = 'transparent';
                  let color = 'var(--text-primary)';
                  let dot = null;
                  if (status === 'completed') { bg = '#2DB84B18'; dot = '#2DB84B'; }
                  else if (status === 'punched-in') { bg = '#F5A62318'; dot = '#F5A623'; }
                  else if (status === 'scheduled') { bg = '#3498db18'; dot = '#3498db'; }
                  if (isToday) { color = 'var(--accent)'; }
                  return (
                    <div key={i} style={{
                      minHeight: 54, padding: '6px 4px', textAlign: 'center',
                      background: bg, borderBottom: '1px solid var(--border-subtle)',
                      borderRight: '1px solid var(--border-subtle)',
                      position: 'relative',
                    }}>
                      {day && (
                        <>
                          <div style={{
                            fontWeight: isToday ? 800 : 500,
                            fontSize: '0.85rem',
                            background: isToday ? 'var(--accent)' : 'transparent',
                            color: isToday ? '#fff' : color,
                            width: 26, height: 26, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 4px',
                          }}>
                            {day}
                          </div>
                          {dot && (
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: dot, margin: '0 auto' }} />
                          )}
                          {status === 'completed' && (
                            <div style={{ fontSize: '0.6rem', color: '#2DB84B', marginTop: 2, fontWeight: 600 }}>Done</div>
                          )}
                          {status === 'scheduled' && (
                            <div style={{ fontSize: '0.6rem', color: '#3498db', marginTop: 2, fontWeight: 600 }}>Sched</div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Punch History */}
            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontWeight: 800, marginBottom: 14, fontSize: '1rem' }}>📋 Recent Shifts</h3>
              {punches.slice(0, 15).length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No shift records yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {punches.slice(0, 15).map(p => {
                    const dt = new Date(p.date + 'T00:00:00');
                    return (
                      <div key={p.id || p.date} style={{
                        background: 'var(--surface)', borderRadius: 12, padding: '12px 16px',
                        border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14,
                      }}>
                        {p.punchInPhotoUrl && (
                          <img
                            src={p.punchInPhotoUrl}
                            alt=""
                            onClick={() => window.open(p.punchInPhotoUrl, '_blank')}
                            style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', cursor: 'pointer', flexShrink: 0 }}
                          />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                            {dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            {p.punchInTime ? `In: ${new Date(p.punchInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : '—'}
                            {p.punchOutTime ? ` · Out: ${new Date(p.punchOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ' · No punch-out'}
                          </div>
                          {p.venue && <div style={{ fontSize: '0.75rem', fontWeight: 600, marginTop: 2 }}>🏢 {p.venue}</div>}
                          {p.location?.address && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                              📍 {p.location.address.slice(0, 60)}
                            </div>
                          )}
                        </div>
                        <span className={`badge ${p.punchOutTime ? 'badge-success' : p.punchInTime ? 'badge-warning' : 'badge-neutral'}`} style={{ fontSize: '0.7rem', flexShrink: 0 }}>
                          {p.punchOutTime ? 'Done' : p.punchInTime ? 'Active' : 'Absent'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ PROFILE TAB ═════════════════════════════════════════════════════════ */}
        {(locked || tab === 'profile') && (
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 20 }}>👤 My Profile</h1>

            {/* Profile Card */}
            <div style={{
              background: 'var(--surface)', borderRadius: 16, padding: '24px', marginBottom: 16,
              border: '1px solid var(--border)', textAlign: 'center',
            }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'linear-gradient(135deg, #2DB84B, #F5A623)',
                color: '#fff', fontSize: 32, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                {profile?.firstName?.[0]?.toUpperCase()}
              </div>
              <h2 style={{ fontWeight: 800, fontSize: '1.3rem' }}>{driverName}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>Part-Time Driver</p>
              <span className={`badge ${profile?.status === 'approved' ? 'badge-success' : 'badge-warning'}`} style={{ marginTop: 10 }}>
                {profile?.status?.toUpperCase() || 'APPROVED'}
              </span>
            </div>

            <DriverProfileView kind="parttime" />

            {/* Logout */}
            <button
              onClick={handleLogout}
              style={{
                width: '100%', marginTop: 20, padding: '14px', borderRadius: 12,
                background: 'var(--danger-bg)', color: 'var(--danger)',
                border: '1px solid var(--danger)', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.9rem',
              }}
            >
              Sign Out of Portal
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom Navigation ── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--surface)', borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-around', padding: '8px 0',
        zIndex: 100,
        boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              if (t.id === 'punchin') getLocation();
            }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '4px 16px', borderRadius: 10,
              color: tab === t.id ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            <span style={{ fontSize: 22 }}>{t.icon}</span>
            <span style={{ fontSize: '0.65rem', fontWeight: tab === t.id ? 700 : 400 }}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
