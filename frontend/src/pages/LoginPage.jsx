import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, setUser, refreshUser } = useAuth();
  const [loginType, setLoginType] = useState('admin'); // 'admin' | 'manager'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password, loginType }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Login failed');
        return;
      }

      // Immediately set user in context and refresh
      if (data.user) {
        setUser(data.user);
      }
      await refreshUser();
      navigate('/dashboard', { replace: true });
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

      <div
        className="login-card"
        style={{ opacity: 1, transform: 'translateY(0)', transition: 'all 0.5s ease' }}
      >
        <div className="logo-section">
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C42 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
              fontSize: 24,
              fontWeight: 800,
              color: 'white',
            }}
          >
            G
          </div>
          <h1>GrowMore Admin</h1>
          <p className="subtitle">Central Valet Parking Management</p>
        </div>

        {/* Tab Switcher for Admin vs Operations Manager */}
        <div className="login-tabs">
          <button
            id="tab-admin"
            type="button"
            className={`login-tab ${loginType === 'admin' ? 'active' : ''}`}
            onClick={() => {
              setLoginType('admin');
              setError('');
            }}
          >
            <span>🛡️</span>
            Super Admin
          </button>
          <button
            id="tab-manager"
            type="button"
            className={`login-tab ${loginType === 'manager' ? 'active' : ''}`}
            onClick={() => {
              setLoginType('manager');
              setError('');
            }}
          >
            <span>👔</span>
            Operations Manager
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{loginType === 'admin' ? 'Admin Username' : 'Manager Username'}</label>
            <input
              id="username"
              className="form-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={loginType === 'admin' ? 'Enter admin username' : 'Enter your manager username'}
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              id="password"
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              autoComplete="current-password"
            />
          </div>

          <button id="login-btn" type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <>
                <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                Signing in...
              </>
            ) : loginType === 'admin' ? (
              'Sign In as Super Admin'
            ) : (
              'Sign In as Operations Manager'
            )}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          GrowMore Parking Solutions © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
