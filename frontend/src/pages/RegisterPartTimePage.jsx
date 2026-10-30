import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import growmoreLogo from '../assets/Growmore-logo.jpg';

export default function RegisterPartTimePage() {
  const { token } = useParams();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    address: '',
    aadharNumber: '',
    declarationAccepted: false,
  });

  const [aadharDoc, setAadharDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchingToken, setFetchingToken] = useState(!!token);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);

  useEffect(() => {
    if (token) {
      fetch(`/api/employees/public/parttime/${token}`)
        .then(res => res.json())
        .then(data => {
          if (data.driver) {
            setFormData(prev => ({
              ...prev,
              firstName: data.driver.firstName || '',
              lastName: data.driver.lastName || '',
              phone: data.driver.phone || '',
              email: data.driver.email || '',
              address: data.driver.address || '',
            }));
          }
        })
        .catch(() => {})
        .finally(() => setFetchingToken(false));
    }
  }, [token]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Aadhar document must be smaller than 10MB');
        return;
      }
      setAadharDoc(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.declarationAccepted) {
      setError('You must accept the declaration to proceed with registration.');
      return;
    }

    if (!aadharDoc) {
      setError('Please upload your Aadhar Card document.');
      return;
    }

    if (formData.phone.replace(/\D/g, '').length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);

    try {
      const fd = new FormData();
      Object.keys(formData).forEach(key => {
        fd.append(key, formData[key]);
      });
      if (token) {
        fd.append('token', token);
      }
      fd.append('aadharDoc', aadharDoc);

      const res = await fetch('/api/employees/public/parttime', {
        method: 'POST',
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      setSubmittedData({ ...formData, id: data.id });
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || 'Failed to submit registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingToken) {
    return (
      <div className="login-page">
        <div className="page-loading">
          <div className="spinner" />
          <span>Loading form data...</span>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="login-page" style={{ padding: '40px 16px', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="login-card" style={{ maxWidth: 560, textAlign: 'center', padding: '40px 32px' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', background: 'var(--success-bg)',
            color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, margin: '0 auto 20px', border: '2px solid var(--success)',
          }}>✓</div>

          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
            Registration Submitted!
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: 24, lineHeight: 1.6 }}>
            Thank you, <strong>{submittedData?.firstName} {submittedData?.lastName}</strong>. Your part-time driver registration has been received by HR.
          </p>

          <div style={{
            background: 'var(--surface-sunken)', borderRadius: 12, padding: '20px', textAlign: 'left',
            marginBottom: 24, border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 10 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Role</span>
              <span className="badge badge-info">Part-Time Driver</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 10 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Status</span>
              <span className="badge badge-warning">Pending HR Approval</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Mobile Number</span>
              <strong style={{ fontSize: '0.85rem' }}>{submittedData?.phone}</strong>
            </div>
          </div>

          <div style={{ background: 'var(--accent-glow)', padding: '14px 18px', borderRadius: 10, color: 'var(--accent)', fontSize: '0.85rem', marginBottom: 28, lineHeight: 1.5 }}>
            ℹ️ Once the HR team approves your registration, they will share your unique <strong>Daily Punch-in Link</strong> to mark attendance with photo verification.
          </div>

          <div>
            <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none' }}>
              ← Return to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', padding: '32px 16px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          background: 'var(--surface)', borderRadius: 16, padding: '28px 32px', marginBottom: 24,
          boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              background: '#ffffff', borderRadius: 12, padding: '6px 12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}>
              <img src={growmoreLogo} alt="GrowMore Logo" style={{ height: 48, width: 'auto', objectFit: 'contain' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Part-Time Driver Registration
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 2 }}>
                GrowMore Parking Solutions · Driver Onboarding
              </p>
            </div>
          </div>
          <span className="badge badge-info" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
            Part-Time Role
          </span>
        </div>

        {error && (
          <div style={{
            background: 'var(--danger-bg)', border: '1px solid var(--danger)', color: 'var(--danger)',
            padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: '0.9rem',
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Section 1: Basic Information */}
          <div style={{
            background: 'var(--surface)', borderRadius: 16, padding: '28px 32px', marginBottom: 24,
            boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)',
          }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>1</span>
              Driver Information
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <div className="form-group">
                <label>First Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input className="form-input" name="firstName" value={formData.firstName} onChange={handleChange} required placeholder="e.g. Suresh" />
              </div>
              <div className="form-group">
                <label>Last Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input className="form-input" name="lastName" value={formData.lastName} onChange={handleChange} required placeholder="e.g. Patil" />
              </div>
              <div className="form-group">
                <label>Mobile Number <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input className="form-input" name="phone" type="tel" maxLength={10} value={formData.phone} onChange={handleChange} required placeholder="10-digit mobile number" />
              </div>
              <div className="form-group">
                <label>Email Address (Optional)</label>
                <input className="form-input" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="name@example.com" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Residential Address <span style={{ color: 'var(--danger)' }}>*</span></label>
                <textarea className="form-input" name="address" rows={3} value={formData.address} onChange={handleChange} required placeholder="Full residential address..." style={{ resize: 'vertical' }} />
              </div>
            </div>
          </div>

          {/* Section 2: Aadhar Verification */}
          <div style={{
            background: 'var(--surface)', borderRadius: 16, padding: '28px 32px', marginBottom: 24,
            boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)',
          }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>2</span>
              Aadhar Card Verification
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              <div className="form-group">
                <label>Aadhar Card Number</label>
                <input className="form-input" name="aadharNumber" maxLength={12} value={formData.aadharNumber} onChange={handleChange} placeholder="12-digit Aadhar number" />
              </div>
              <div className="form-group">
                <label>Upload Aadhar Document (Photo / PDF) <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} style={{ fontSize: '0.85rem', marginTop: 4 }} />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Clear photo or PDF copy of front &amp; back</p>
              </div>
            </div>
          </div>

          {/* Section 3: Declaration */}
          <div style={{
            background: 'var(--surface)', borderRadius: 16, padding: '28px 32px', marginBottom: 28,
            boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)',
          }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>3</span>
              Driver Declaration
            </h2>

            <div style={{
              background: 'var(--surface-sunken)', borderRadius: 12, padding: '16px 20px',
              fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--text-muted)', marginBottom: 16,
            }}>
              "I hereby declare that all information and Aadhar documentation submitted by me are authentic, valid, and belong to me. I agree to adhere to the company's code of conduct and safety regulations during all assigned shifts."
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
              <input
                type="checkbox"
                name="declarationAccepted"
                checked={formData.declarationAccepted}
                onChange={handleChange}
                style={{ width: 20, height: 20, marginTop: 2, accentColor: 'var(--accent)' }}
              />
              <span>I confirm that the details and Aadhar card provided above are true and correct.</span>
            </label>
          </div>

          {/* Submit */}
          <div style={{ textAlign: 'center' }}>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{
                width: 'auto', minWidth: 260, padding: '14px 40px', fontSize: '1.05rem',
                margin: '0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                  Submitting Registration...
                </>
              ) : (
                'Submit Registration to HR'
              )}
            </button>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 12 }}>
              No accountant verification needed. The HR team will approve your registration directly.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
