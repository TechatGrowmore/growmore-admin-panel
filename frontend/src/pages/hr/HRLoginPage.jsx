import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHRAuth } from '../../context/HRAuthContext';
import growmoreLogo from '../../assets/Growmore-logo.jpg';

export default function HRLoginPage() {
  const navigate = useNavigate();
  const { user, setUser, refresh } = useHRAuth();
  const [role, setRole] = useState('hr'); // 'hr' | 'accountant'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate(user.role === 'hr' ? '/hr/dashboard' : '/accountant/dashboard', { replace: true });
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
      if (!res.ok) { setError(data.message || 'Login failed'); return; }

      if (data.user.role !== role) {
        setError(`This account is a ${data.user.role.toUpperCase()} account. Please select the correct role.`);
        // logout
        await fetch('/api/hr/auth/logout', { method: 'POST', credentials: 'include' });
        return;
      }

      setUser(data.user);
      await refresh();
      navigate(data.user.role === 'hr' ? '/hr/dashboard' : '/accountant/dashboard', { replace: true });
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
          <h1>GrowMore HR</h1>
          <p className="subtitle">Human Resources Portal</p>
        </div>

        <div className="login-tabs">
          <button id="tab-hr" type="button" className={`login-tab ${role === 'hr' ? 'active' : ''}`}
            onClick={() => { setRole('hr'); setError(''); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            HR Manager
          </button>
          <button id="tab-accountant" type="button" className={`login-tab ${role === 'accountant' ? 'active' : ''}`}
            onClick={() => { setRole('accountant'); setError(''); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Accountant
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input id="hr-username" className="form-input" type="text" value={username}
              onChange={e => setUsername(e.target.value)} placeholder="Enter username" required autoComplete="username" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input id="hr-password" className="form-input" type="password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="Enter password" required autoComplete="current-password" />
          </div>
          <button id="hr-login-btn" type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />Signing in...</>
            ) : `Sign in as ${role === 'hr' ? 'HR Manager' : 'Accountant'}`}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <a href="/driver/login" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Driver Login →
          </a>
        </div>
        <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          GrowMore Parking Solutions © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
