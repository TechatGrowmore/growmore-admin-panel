import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useHRAuth } from '../../context/HRAuthContext';
import growmoreLogo from '../../assets/Growmore-logo.jpg';

export default function AccountantLoginPage() {
  const navigate = useNavigate();
  const { user, setUser, refresh } = useHRAuth();
  const [username, setUsername] = useState('accountant');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      if (user.role === 'accountant') {
        navigate('/accountant/dashboard', { replace: true });
      } else if (user.role === 'hr') {
        navigate('/hr/dashboard', { replace: true });
      }
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/hr/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Login failed');
        return;
      }

      if (data.user.role !== 'accountant') {
        setError('This account does not have Accountant permissions. Please use the HR login page.');
        await fetch('/api/hr/auth/logout', { method: 'POST', credentials: 'include' });
        return;
      }

      setUser(data.user);
      await refresh();
      navigate('/accountant/dashboard', { replace: true });
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
            boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
          }}>
            <img src={growmoreLogo} alt="GrowMore Logo" style={{ height: 56, width: 'auto', maxWidth: 130, objectFit: 'contain' }} />
          </div>
          <h1>GrowMore Finance</h1>
          <p className="subtitle">Accountant &amp; Verification Portal</p>
        </div>

        <div style={{
          background: 'var(--accent-glow)', padding: '10px 14px', borderRadius: 10,
          color: 'var(--accent)', fontSize: '0.8rem', textAlign: 'center', marginBottom: 20, fontWeight: 600,
        }}>
          🛡️ Accountant Portal · Employee Verification &amp; Financial Approvals
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Accountant Username</label>
            <input
              id="accountant-username"
              className="form-input"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="e.g. accountant"
              required
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              id="accountant-password"
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter accountant password"
              required
              autoComplete="current-password"
            />
          </div>
          <button id="accountant-login-btn" type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />Signing in...</>
            ) : 'Sign In as Accountant'}
          </button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, fontSize: '0.8rem' }}>
          <Link to="/hr/login" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
            ← HR Manager Portal
          </Link>
          <Link to="/driver/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            Driver Portal →
          </Link>
        </div>
        <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          GrowMore Parking Solutions © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
