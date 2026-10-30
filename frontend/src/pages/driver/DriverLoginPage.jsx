import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDriverAuth } from '../../context/DriverAuthContext';
import growmoreLogo from '../../assets/Growmore-logo.jpg';

export default function DriverLoginPage() {
  const navigate = useNavigate();
  const { user, setUser, refresh } = useDriverAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate('/driver/dashboard', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/driver/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Login failed'); return; }
      setUser(data.user);
      await refresh();
      navigate('/driver/dashboard', { replace: true });
    } catch { setError('Network error.'); } finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="login-orb login-orb-1" />
      <div className="login-orb login-orb-2" />
      <div className="login-card">
        <div className="logo-section">
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', borderRadius: 16, padding: '6px 14px', margin: '0 auto 16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <img src={growmoreLogo} alt="GrowMore Logo" style={{ height: 56, width: 'auto', maxWidth: 130, objectFit: 'contain' }} />
          </div>
          <h1>Driver Portal</h1>
          <p className="subtitle">GrowMore Parking Solutions</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Phone Number</label>
            <input id="driver-phone" className="form-input" type="tel" value={phone}
              onChange={e => setPhone(e.target.value)} placeholder="Enter your registered phone number" required autoComplete="username" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input id="driver-password" className="form-input" type="password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="Your first name in lowercase" required autoComplete="current-password" />
          </div>
          <button id="driver-login-btn" type="submit" className="btn-primary" disabled={loading}>
            {loading ? <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />Signing in...</> : 'Sign In to Driver Portal'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Password is your first name in lowercase.<br />Contact HR if you face any issues.
        </p>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <a href="/hr/login" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>HR / Accountant Login →</a>
        </div>
      </div>
    </div>
  );
}
