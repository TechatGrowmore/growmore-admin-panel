import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import growmoreLogo from '../assets/Growmore-logo.jpg';

export default function PunchInPage() {
  const { token } = useParams();
  const [driver, setDriver] = useState(null);
  const [punch, setPunch] = useState(null);
  const [todayDate, setTodayDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Location
  const [location, setLocation] = useState({ lat: null, lng: null, address: '' });
  const [locLoading, setLocLoading] = useState(false);

  // Camera
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);

  const fetchDriverInfo = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`/api/employees/parttime/punch/${token}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Invalid punch link');
      }
      setDriver(data.driver);
      setPunch(data.punch);
      setTodayDate(data.today);
    } catch (err) {
      setError(err.message || 'Failed to load driver details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchDriverInfo();
  }, [token]);

  // Request Location
  const getLocation = () => {
    if (!navigator.geolocation) {
      setLocation({ lat: null, lng: null, address: 'Geolocation not supported' });
      return;
    }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          if (r.ok) {
            const d = await r.json();
            address = d.display_name || address;
          }
        } catch { }
        setLocation({ lat, lng, address });
        setLocLoading(false);
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        setLocation({ lat: null, lng: null, address: 'Location permission denied' });
        setLocLoading(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    getLocation();
  }, []);

  // Camera start / stop
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      console.warn('Camera error:', err);
      // Fallback: camera not required if blocked
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedPhoto(dataUrl);
    stopCamera();
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    startCamera();
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const handlePunch = async (action) => {
    setSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/employees/parttime/punch/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          lat: location.lat,
          lng: location.lng,
          address: location.address,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Punch submission failed');
      }

      setPunch(data.punch);
      setSuccessMsg(action === 'punchin' ? '✅ Punch-In recorded successfully!' : '✅ Punch-Out recorded successfully!');
      stopCamera();
    } catch (err) {
      setError(err.message || 'Submission error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="login-page">
        <div className="page-loading">
          <div className="spinner" />
          <span>Validating punch token...</span>
        </div>
      </div>
    );
  }

  if (error && !driver) {
    return (
      <div className="login-page" style={{ padding: '40px 16px', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="login-card" style={{ maxWidth: 480, textAlign: 'center', padding: '40px 32px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 8, color: 'var(--danger)' }}>
            Invalid or Expired Link
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 24 }}>
            {error || 'This punch link is invalid or your driver profile is not approved yet.'}
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Please contact your HR manager to obtain an active punch link.
          </p>
        </div>
      </div>
    );
  }

  const isPunchedIn = !!punch?.punchInTime;
  const isPunchedOut = !!punch?.punchOutTime;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 540, margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          background: 'var(--surface)', borderRadius: 16, padding: '20px 24px', marginBottom: 20,
          boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#ffffff', borderRadius: 8, padding: '4px 8px' }}>
              <img src={growmoreLogo} alt="GrowMore" style={{ height: 36, objectFit: 'contain' }} />
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 800 }}>Part-Time Attendance</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>GrowMore Parking Solutions</div>
            </div>
          </div>
          <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>Part-Time</span>
        </div>

        {/* Driver Profile Card */}
        <div style={{
          background: 'var(--surface)', borderRadius: 16, padding: '24px', marginBottom: 20,
          boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, #2DB84B, #F5A623)',
            color: '#fff', fontSize: 26, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
          }}>
            {driver?.firstName?.[0]?.toUpperCase()}
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {driver?.firstName} {driver?.lastName}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 2 }}>
            Phone: {driver?.phone} · Date: <strong>{todayDate || new Date().toISOString().split('T')[0]}</strong>
          </p>

          {/* Status Box */}
          <div style={{
            marginTop: 20, padding: '16px', borderRadius: 12,
            background: isPunchedOut ? 'var(--info-bg)' : isPunchedIn ? 'var(--success-bg)' : 'var(--warning-bg)',
            border: `1px solid ${isPunchedOut ? 'var(--info)' : isPunchedIn ? 'var(--success)' : 'var(--warning)'}`,
          }}>
            {isPunchedOut ? (
              <div>
                <div style={{ fontWeight: 800, color: 'var(--info)', fontSize: '1rem' }}>✅ Shift Completed Today</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  In: {new Date(punch.punchInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  {' · '}
                  Out: {new Date(punch.punchOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ) : isPunchedIn ? (
              <div>
                <div style={{ fontWeight: 800, color: 'var(--success)', fontSize: '1rem' }}>🟢 Currently Punched In</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Started at {new Date(punch.punchInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontWeight: 800, color: 'var(--amber)', fontSize: '1rem' }}>⏳ Not Punched In Yet</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Click below to record your start time for today's shift
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Location Info */}
        <div style={{
          background: 'var(--surface)', borderRadius: 16, padding: '16px 20px', marginBottom: 20,
          boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <span style={{ fontSize: 22 }}>📍</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Current Location</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {locLoading ? 'Fetching GPS location...' : location.address || 'Location captured'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={getLocation}
            className="btn-secondary btn-small"
            style={{ width: 'auto', padding: '6px 12px', fontSize: '0.75rem', flexShrink: 0 }}
          >
            Refresh
          </button>
        </div>

        {/* Camera / Selfie Box */}
        {!isPunchedOut && (
          <div style={{
            background: 'var(--surface)', borderRadius: 16, padding: '20px', marginBottom: 20,
            boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12 }}>
              📸 Verification Photo
            </div>

            {capturedPhoto ? (
              <div>
                <img
                  src={capturedPhoto}
                  alt="Captured selfie"
                  style={{ width: 140, height: 140, borderRadius: 14, objectFit: 'cover', border: '2px solid var(--accent)', margin: '0 auto 12px' }}
                />
                <div>
                  <button type="button" onClick={retakePhoto} className="btn-secondary btn-small" style={{ width: 'auto', padding: '6px 16px' }}>
                    Retake Photo
                  </button>
                </div>
              </div>
            ) : cameraActive ? (
              <div>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', maxWidth: 280, borderRadius: 12, border: '2px solid var(--border)', background: '#000' }}
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button type="button" onClick={capturePhoto} className="btn-primary" style={{ width: 'auto', padding: '8px 20px' }}>
                    📸 Capture Photo
                  </button>
                  <button type="button" onClick={stopCamera} className="btn-secondary" style={{ width: 'auto', padding: '8px 16px' }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={startCamera}
                  className="btn-secondary"
                  style={{ width: 'auto', padding: '10px 24px', margin: '0 auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  📷 Turn On Camera for Selfie
                </button>
              </div>
            )}
          </div>
        )}

        {/* Notifications */}
        {error && (
          <div style={{
            background: 'var(--danger-bg)', border: '1px solid var(--danger)', color: 'var(--danger)',
            padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: '0.85rem',
          }}>
            ⚠️ {error}
          </div>
        )}

        {successMsg && (
          <div style={{
            background: 'var(--success-bg)', border: '1px solid var(--success)', color: 'var(--success)',
            padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: '0.85rem',
          }}>
            {successMsg}
          </div>
        )}

        {/* Punch Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          {!isPunchedIn && (
            <button
              id="punch-in-btn"
              onClick={() => handlePunch('punchin')}
              disabled={submitting}
              className="btn-primary"
              style={{
                padding: '16px', fontSize: '1.1rem', fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
            >
              {submitting ? (
                <><div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> Recording Punch In...</>
              ) : (
                '📍 Punch In (Start Shift)'
              )}
            </button>
          )}

          {isPunchedIn && !isPunchedOut && (
            <button
              id="punch-out-btn"
              onClick={() => handlePunch('punchout')}
              disabled={submitting}
              style={{
                background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
                color: '#fff', border: 'none', borderRadius: 12,
                padding: '16px', fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: '0 4px 14px rgba(231, 76, 60, 0.3)',
              }}
            >
              {submitting ? (
                <><div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> Recording Punch Out...</>
              ) : (
                '🚪 Punch Out (End Shift)'
              )}
            </button>
          )}
        </div>

        <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          GrowMore Parking Solutions · Part-Time Driver Portal
        </div>
      </div>
    </div>
  );
}
