import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePTDriverAuth } from '../../context/PTDriverAuthContext';
import growmoreLogo from '../../assets/Growmore-logo.jpg';

export default function PTDriverLoginPage() {
  const navigate = useNavigate();
  const { user, setUser, refresh } = usePTDriverAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/parttime/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/ptdriver/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: phone.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Login failed');
        return;
      }
      setUser(data.user);
      await refresh();
      navigate('/parttime/dashboard', { replace: true });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-orb login-orb-1" />
      <div className="login-orb login-orb-2" />
      <div className="login-card">
        <div className="logo-section">
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: '#ffffff', borderRadius: 16, padding: '6px 14px',
            margin: '0 auto 16px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          }}>
            <img src={growmoreLogo} alt="GrowMore" style={{ height: 56, width: 'auto', maxWidth: 130, objectFit: 'contain' }} />
          </div>
          <h1>Part-Time Driver Portal</h1>
          <p className="subtitle">GrowMore Parking Solutions</p>
        </div>

        <div style={{
          background: 'var(--accent-glow)', borderRadius: 10, padding: '10px 14px',
          fontSize: '0.8rem', color: 'var(--accent)', textAlign: 'center',
          marginBottom: 20, fontWeight: 600,
        }}>
          🚗 Part-Time Driver Access · Punch In &amp; Track Attendance
        </div>

        {error && (
          <div className="login-error">{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Mobile Number (Username)</label>
            <input
              id="pt-phone"
              className="form-input"
              type="tel"
              maxLength={10}
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="10-digit registered mobile number"
              required
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              id="pt-password"
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Your first name in lowercase"
              required
              autoComplete="current-password"
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
              💡 Default password is your first name in lowercase letters (e.g. "ramesh")
            </p>
          </div>
          <button id="pt-login-btn" type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Signing in...</>
            ) : (
              '🚗 Sign In as Part-Time Driver'
            )}
          </button>
        </form>

        <div style={{ borderTop: '1px solid var(--border)', marginTop: 24, paddingTop: 16, display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
          <Link to="/driver/login" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
            Full-Time Driver →
          </Link>
          <Link to="/hr/login" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
            HR Portal →
          </Link>
        </div>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          GrowMore Parking Solutions © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

