import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDriverAuth } from '../../context/DriverAuthContext';
import growmoreLogo from '../../assets/Growmore-logo.jpg';

const DAYS_OF_WEEK = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function DriverDashboard() {
  const { user, setUser } = useDriverAuth();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [tab, setTab] = useState('home');
  const [punches, setPunches] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [todayPunch, setTodayPunch] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: 'success' });

  // Punch-in state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [stream, setStream] = useState(null);
  const [location, setLocation] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [punchLoading, setPunchLoading] = useState(false);

  // Leave state
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveLoading, setLeaveLoading] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: 'success' }), 4000); };

  const loadData = async () => {
    try {
      const [pRes, lRes] = await Promise.all([
        fetch('/api/employees/punches/fulltime/me', { credentials: 'include' }),
        fetch('/api/employees/leaves/me', { credentials: 'include' }),
      ]);
      if (pRes.ok) { const d = await pRes.json(); setPunches(d.punches || []); setTodayPunch((d.punches || []).find(p => p.date === today) || null); }
      if (lRes.ok) { const d = await lRes.json(); setLeaves(d.leaves || []); }
    } catch (err) { console.error(err); }
  };

  useEffect(() => { if (user) loadData(); }, [user]);

  // Camera
  const openCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
      setCameraOpen(true);
      setCapturedPhoto(null);
    } catch { showToast('Camera access denied. Please allow camera in browser.', 'error'); }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedPhoto(dataUrl);
    stopCamera();
  };

  const stopCamera = () => {
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
  };

  const getLocation = () => {
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        let address = '';
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
          const d = await r.json();
          address = d.display_name || '';
        } catch { address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`; }
        setLocation({ lat, lng, address });
        setGeoLoading(false);
      },
      (err) => { showToast('Location access denied. Continuing without location.', 'error'); setGeoLoading(false); },
      { timeout: 10000 }
    );
  };

  const submitPunchIn = async () => {
    if (!capturedPhoto) { showToast('Please capture your photo first', 'error'); return; }
    setPunchLoading(true);
    try {
      const fd = new FormData();
      if (location) { fd.append('lat', location.lat); fd.append('lng', location.lng); fd.append('address', location.address); }
      // Convert dataURL to blob
      const res = await fetch(capturedPhoto);
      const blob = await res.blob();
      fd.append('photo', blob, `punchin_${today}.jpg`);
      const r = await fetch('/api/employees/punches/fulltime', { method: 'POST', credentials: 'include', body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      showToast('✅ Punch-in recorded successfully!');
      setCapturedPhoto(null); setCameraOpen(false); setLocation(null);
      await loadData();
      setTab('home');
    } catch (err) { showToast(err.message || 'Punch-in failed', 'error'); } finally { setPunchLoading(false); }
  };

  const applyLeave = async () => {
    if (!leaveDate) { showToast('Please select a date', 'error'); return; }
    setLeaveLoading(true);
    try {
      const r = await fetch('/api/employees/leaves', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: leaveDate, reason: leaveReason }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      showToast('Leave applied successfully!');
      setLeaveDate(''); setLeaveReason('');
      await loadData();
    } catch (err) { showToast(err.message || 'Failed to apply leave', 'error'); } finally { setLeaveLoading(false); }
  };

  const handleLogout = async () => {
    await fetch('/api/driver/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null); navigate('/driver/login');
  };

  // Build mini calendar for last 30 days
  const calendarDays = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    const punch = punches.find(p => p.date === ds);
    const leave = leaves.find(l => l.date === ds);
    calendarDays.push({ date: ds, day: d.getDate(), weekday: DAYS_OF_WEEK[d.getDay()], month: MONTHS[d.getMonth()], punch, leave });
  }

  const empProfile = user;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {toast.msg && <div className="toast-container"><div className={`toast toast-${toast.type}`}>{toast.msg}</div></div>}

      {/* Header */}
      <header style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', padding: '0 20px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={growmoreLogo} alt="GrowMore" style={{ height: 32, objectFit: 'contain', background: '#fff', borderRadius: 6, padding: '2px 6px' }} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Driver Portal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {empProfile?.firstName} {empProfile?.lastName}
          </span>
          <button onClick={handleLogout} style={{ padding: '6px 14px', background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
            Logout
          </button>
        </div>
      </header>

      {/* Bottom Nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', display: 'flex', zIndex: 100 }}>
        {[
          { id: 'home', icon: '🏠', label: 'Home' },
          { id: 'punchin', icon: '📍', label: 'Punch In' },
          { id: 'calendar', icon: '📅', label: 'Calendar' },
          { id: 'leave', icon: '📝', label: 'Leave' },
          { id: 'profile', icon: '👤', label: 'Profile' },
        ].map(({ id, icon, label }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: '10px 4px 8px', border: 'none', background: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            borderTop: `2px solid ${tab === id ? 'var(--accent)' : 'transparent'}`,
            color: tab === id ? 'var(--accent)' : 'var(--text-muted)',
          }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>{label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <main style={{ padding: '20px 20px 80px' }}>

        {/* HOME */}
        {tab === 'home' && (
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 4 }}>
              Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {empProfile?.firstName}! 👋
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>

            {/* Today punch status */}
            <div style={{
              background: todayPunch ? 'var(--success-bg)' : 'var(--warning-bg)',
              border: `1px solid ${todayPunch ? 'var(--success)' : 'var(--warning)'}`,
              borderRadius: 'var(--radius-lg)', padding: 20, marginBottom: 24, textAlign: 'center',
            }}>
              {todayPunch ? (
                <>
                  <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--accent)' }}>Punched In Today</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
                    at {new Date(todayPunch.punchInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    {todayPunch.location?.address && ` · ${todayPunch.location.address.slice(0, 60)}...`}
                  </div>
                  {todayPunch.photoUrl && (
                    <img src={todayPunch.photoUrl} alt="Today's punch" style={{ width: 80, height: 80, borderRadius: 12, objectFit: 'cover', marginTop: 12 }} />
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontSize: 48, marginBottom: 8 }}>⚠️</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--amber)' }}>Not Punched In Yet</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>Please punch in to record your attendance</div>
                  <button className="btn-primary" style={{ width: 'auto', padding: '10px 28px', marginTop: 16 }} onClick={() => setTab('punchin')}>
                    📍 Punch In Now
                  </button>
                </>
              )}
            </div>

            {/* Quick stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
              {[
                { label: 'Days Present', value: punches.filter(p => p.status === 'present').length, color: 'var(--accent)' },
                { label: 'Leaves Taken', value: leaves.filter(l => l.status === 'approved').length, color: 'var(--info)' },
                { label: 'Pending Leaves', value: leaves.filter(l => l.status === 'pending').length, color: 'var(--amber)' },
                { label: 'Total Punches', value: punches.length, color: 'var(--purple)' },
              ].map(({ label, value, color }) => (
                <div key={label} className="stat-card" style={{ '--card-accent': color }}>
                  <div className="stat-card-label">{label}</div>
                  <div className="stat-card-value">{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PUNCH IN */}
        {tab === 'punchin' && (
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 20 }}>📍 Punch In</h1>

            {todayPunch ? (
              <div style={{ textAlign: 'center', padding: 40, background: 'var(--success-bg)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--success)' }}>
                <div style={{ fontSize: 64, marginBottom: 12 }}>✅</div>
                <h2 style={{ color: 'var(--accent)', marginBottom: 8 }}>Already Punched In Today!</h2>
                <p style={{ color: 'var(--text-muted)' }}>
                  Time: {new Date(todayPunch.punchInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </p>
                {todayPunch.photoUrl && (
                  <img src={todayPunch.photoUrl} alt="punch" style={{ width: 100, height: 100, borderRadius: 14, objectFit: 'cover', marginTop: 16 }} />
                )}
              </div>
            ) : (
              <div>
                {/* Camera section */}
                {!capturedPhoto ? (
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 24, marginBottom: 20, textAlign: 'center' }}>
                    {cameraOpen ? (
                      <div>
                        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', maxWidth: 360, borderRadius: 12, marginBottom: 16 }} />
                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                        <button className="btn-primary" style={{ width: 'auto', padding: '12px 32px', fontSize: '1rem' }} onClick={capturePhoto}>
                          📸 Capture Photo
                        </button>
                        <br />
                        <button className="btn-secondary" style={{ marginTop: 8 }} onClick={() => { stopCamera(); setCameraOpen(false); }}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 64, marginBottom: 16 }}>📸</div>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: '0.9rem' }}>
                          Take a photo of yourself to punch in
                        </p>
                        <button className="btn-primary" style={{ width: 'auto', padding: '12px 32px' }} onClick={openCamera}>
                          Open Camera
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 24, marginBottom: 20, textAlign: 'center' }}>
                    <img src={capturedPhoto} alt="captured" style={{ width: 160, height: 160, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent)', marginBottom: 16 }} />
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                      <button className="btn-secondary" onClick={() => { setCapturedPhoto(null); setCameraOpen(false); }}>Retake</button>
                      <span style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 600, alignSelf: 'center' }}>✅ Photo ready</span>
                    </div>
                  </div>
                )}

                {/* Location section */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20, marginBottom: 20 }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12 }}>📍 Location</h3>
                  {location ? (
                    <div style={{ background: 'var(--success-bg)', padding: 12, borderRadius: 'var(--radius-md)', fontSize: '0.83rem', color: 'var(--accent)', lineHeight: 1.5 }}>
                      ✅ {location.address || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`}
                    </div>
                  ) : (
                    <button className="btn-secondary" onClick={getLocation} disabled={geoLoading} style={{ width: '100%' }}>
                      {geoLoading ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, display: 'inline-block', marginRight: 8 }} />Getting location...</> : '📍 Get My Location'}
                    </button>
                  )}
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
                    Location is optional but recommended for attendance verification
                  </p>
                </div>

                <button className="btn-primary" onClick={submitPunchIn} disabled={punchLoading || !capturedPhoto} style={{ padding: '14px', fontSize: '1rem' }}>
                  {punchLoading ? <><div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />Recording...</> : '✅ Submit Punch-In'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* CALENDAR */}
        {tab === 'calendar' && (
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 20 }}>📅 My Attendance</h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {calendarDays.map(({ date, day, weekday, month, punch, leave }) => {
                const isToday = date === today;
                const bg = isToday ? 'var(--accent)' : punch ? 'var(--success-bg)' : leave ? 'var(--info-bg)' : 'var(--bg-card)';
                const color = isToday ? 'white' : punch ? 'var(--success)' : leave ? 'var(--info)' : 'var(--text-muted)';
                return (
                  <div key={date} style={{ width: 60, background: bg, border: `1px solid var(--border)`, borderRadius: 'var(--radius-md)', padding: '8px 4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: isToday ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)', marginBottom: 2 }}>{weekday}</div>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color }}>{day}</div>
                    <div style={{ fontSize: '0.6rem', color: isToday ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>{month}</div>
                    <div style={{ marginTop: 4, fontSize: '0.65rem', fontWeight: 700 }}>
                      {isToday ? '↑ today' : punch ? '✅' : leave ? `📋` : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 20, flexWrap: 'wrap' }}>
              {[['var(--accent)', 'white', 'Today'], ['var(--success-bg)', 'var(--success)', 'Present'], ['var(--info-bg)', 'var(--info)', 'Leave'], ['var(--bg-card)', 'var(--text-muted)', 'Absent/No punch']].map(([bg, col, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: '1px solid var(--border)' }} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LEAVE */}
        {tab === 'leave' && (
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 20 }}>📝 Leave Application</h1>

            <div className="chart-card" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: '0.95rem', marginBottom: 16 }}>Apply for Leave</h3>
              <div className="form-group">
                <label>Date</label>
                <input className="form-input" type="date" value={leaveDate} onChange={e => setLeaveDate(e.target.value)} min={today} />
              </div>
              <div className="form-group">
                <label>Reason (optional)</label>
                <textarea className="form-input" rows={3} value={leaveReason} onChange={e => setLeaveReason(e.target.value)}
                  placeholder="Reason for leave..." style={{ resize: 'vertical' }} />
              </div>
              <button className="btn-primary" onClick={applyLeave} disabled={leaveLoading}>
                {leaveLoading ? 'Submitting...' : 'Apply for Leave'}
              </button>
            </div>

            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>My Leaves</h3>
            {leaves.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>No leave records</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {leaves.map(l => (
                  <div key={l.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                        {new Date(l.date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      {l.reason && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{l.reason}</div>}
                      {l.accountantRemarks && <div style={{ fontSize: '0.75rem', color: 'var(--info)', marginTop: 2 }}>Remarks: {l.accountantRemarks}</div>}
                    </div>
                    <span className={`badge badge-${l.status === 'approved' ? 'success' : l.status === 'rejected' ? 'danger' : 'warning'}`}>
                      {l.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PROFILE */}
        {tab === 'profile' && (
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 20 }}>👤 My Profile</h1>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 24, textAlign: 'center', marginBottom: 20 }}>
              {user?.photoUrl ? (
                <img src={user.photoUrl} alt="Profile" style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent)', marginBottom: 12 }} />
              ) : (
                <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'var(--accent-glow)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 800, margin: '0 auto 12px' }}>
                  {user?.firstName?.[0]}
                </div>
              )}
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{user?.firstName} {user?.lastName}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{user?.designation || 'Driver'} · {user?.department}</p>
              <span className="badge badge-success" style={{ marginTop: 8 }}>Verified Employee</span>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {[
                ['📱 Phone', user?.phone],
                ['📧 Email', user?.email || '—'],
                ['🎂 Date of Birth', user?.dob ? new Date(user.dob).toLocaleDateString('en-IN') : '—'],
                ['🩸 Blood Group', user?.bloodGroup || '—'],
                ['🏠 Address', [user?.addressLine1, user?.city, user?.state].filter(Boolean).join(', ') || '—'],
                ['🪪 Aadhar No.', user?.aadharNumber ? `****  ****  ${user.aadharNumber.slice(-4)}` : '—'],
                ['📄 PAN', user?.panNumber || '—'],
                ['💼 Designation', user?.designation || '—'],
                ['📅 Joining Date', user?.joiningDate ? new Date(user.joiningDate).toLocaleDateString('en-IN') : '—'],
              ].map(([label, val]) => (
                <div key={label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
