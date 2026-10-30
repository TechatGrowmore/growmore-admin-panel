import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import growmoreLogo from '../assets/Growmore-logo.jpg';

export default function RegisterFullTimePage() {
  const { token } = useParams();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    dob: '',
    gender: 'Male',
    bloodGroup: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    aadharNumber: '',
    panNumber: '',
    designation: 'Driver',
    emergencyContactName: '',
    emergencyContactPhone: '',
    bankName: '',
    bankAccountNumber: '',
    bankIfsc: '',
    declarationAccepted: false,
  });

  const [files, setFiles] = useState({
    aadharDoc: null,
    panDoc: null,
    photo: null,
  });

  const [previews, setPreviews] = useState({
    photo: null,
  });

  const [loading, setLoading] = useState(false);
  const [fetchingToken, setFetchingToken] = useState(!!token);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);

  // If token is provided, fetch pre-filled data
  useEffect(() => {
    if (token) {
      fetch(`/api/employees/public/fulltime/${token}`)
        .then(res => res.json())
        .then(data => {
          if (data.employee) {
            setFormData(prev => ({
              ...prev,
              firstName: data.employee.firstName || '',
              lastName: data.employee.lastName || '',
              phone: data.employee.phone || '',
              email: data.employee.email || '',
              city: data.employee.city || '',
              state: data.employee.state || '',
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

  const handleFileChange = (e, field) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError(`${field} must be smaller than 10MB`);
        return;
      }
      setFiles(prev => ({ ...prev, [field]: file }));
      if (field === 'photo') {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviews(prev => ({ ...prev, photo: reader.result }));
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.declarationAccepted) {
      setError('You must accept the declaration to proceed with registration.');
      return;
    }

    if (!files.photo) {
      setError('Please upload your passport-size photograph.');
      return;
    }

    if (!files.aadharDoc) {
      setError('Please upload your Aadhar Card document.');
      return;
    }

    if (!files.panDoc) {
      setError('Please upload your PAN Card document.');
      return;
    }

    if (formData.aadharNumber.replace(/\D/g, '').length !== 12) {
      setError('Please enter a valid 12-digit Aadhar number.');
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
      if (files.photo) fd.append('photo', files.photo);
      if (files.aadharDoc) fd.append('aadharDoc', files.aadharDoc);
      if (files.panDoc) fd.append('panDoc', files.panDoc);

      const res = await fetch('/api/employees/public/fulltime', {
        method: 'POST',
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      setSubmittedData(data.employee || formData);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || 'Failed to submit registration form. Please try again.');
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
        <div className="login-card" style={{ maxWidth: 600, textAlign: 'center', padding: '40px 32px' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', background: 'var(--success-bg)',
            color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, margin: '0 auto 20px', border: '2px solid var(--success)',
          }}>✓</div>

          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
            Registration Submitted!
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: 24, lineHeight: 1.6 }}>
            Thank you, <strong>{submittedData?.firstName} {submittedData?.lastName}</strong>. Your application has been registered successfully.
          </p>

          <div style={{
            background: 'var(--surface-sunken)', borderRadius: 12, padding: '20px', textAlign: 'left',
            marginBottom: 24, border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 10 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Application Status</span>
              <span className="badge badge-warning">Pending Accountant Verification</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 10 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Mobile Number</span>
              <strong style={{ fontSize: '0.85rem' }}>{submittedData?.phone}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 10 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Designation</span>
              <span style={{ fontSize: '0.85rem' }}>{submittedData?.designation || 'Driver (Full-Time)'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Next Step</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 600 }}>Verification by Finance/Accountant</span>
            </div>
          </div>

          <div style={{ background: 'var(--accent-glow)', padding: '14px 18px', borderRadius: 10, color: 'var(--accent)', fontSize: '0.85rem', marginBottom: 28, lineHeight: 1.5 }}>
            ℹ️ Once your documents (Aadhar &amp; PAN) are verified by the accountant, your driver dashboard login will be activated automatically with your phone number and first name as password.
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link to="/driver/login" className="btn-primary" style={{ width: 'auto', padding: '10px 24px', textDecoration: 'none' }}>
              Go to Driver Portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', padding: '32px 16px' }}>
      <div style={{ maxWidth: 840, margin: '0 auto' }}>
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
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Full-Time Employee Registration
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 2 }}>
                GrowMore Parking Solutions · Official Employee Onboarding Form
              </p>
            </div>
          </div>
          <span className="badge badge-info" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
            Full-Time Role
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
          {/* Section 1: Personal Details */}
          <div style={{
            background: 'var(--surface)', borderRadius: 16, padding: '28px 32px', marginBottom: 24,
            boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)',
          }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>1</span>
              Personal Details
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <div className="form-group">
                <label>First Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input className="form-input" name="firstName" value={formData.firstName} onChange={handleChange} required placeholder="e.g. Ramesh" />
              </div>
              <div className="form-group">
                <label>Last Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input className="form-input" name="lastName" value={formData.lastName} onChange={handleChange} required placeholder="e.g. Kumar" />
              </div>
              <div className="form-group">
                <label>Mobile Number <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input className="form-input" name="phone" type="tel" maxLength={10} value={formData.phone} onChange={handleChange} required placeholder="10-digit mobile number" />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input className="form-input" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="name@example.com" />
              </div>
              <div className="form-group">
                <label>Date of Birth</label>
                <input className="form-input" name="dob" type="date" value={formData.dob} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Gender</label>
                <select className="form-input" name="gender" value={formData.gender} onChange={handleChange}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Blood Group</label>
                <input className="form-input" name="bloodGroup" value={formData.bloodGroup} onChange={handleChange} placeholder="e.g. O+, B+, A+" />
              </div>
              <div className="form-group">
                <label>Designation</label>
                <input className="form-input" name="designation" value={formData.designation} onChange={handleChange} placeholder="e.g. Driver" />
              </div>
            </div>
          </div>

          {/* Section 2: Address Information */}
          <div style={{
            background: 'var(--surface)', borderRadius: 16, padding: '28px 32px', marginBottom: 24,
            boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)',
          }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>2</span>
              Address Details
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Address Line 1 <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input className="form-input" name="addressLine1" value={formData.addressLine1} onChange={handleChange} required placeholder="House / Flat No., Street, Landmark" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Address Line 2</label>
                <input className="form-input" name="addressLine2" value={formData.addressLine2} onChange={handleChange} placeholder="Locality, Area" />
              </div>
              <div className="form-group">
                <label>City <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input className="form-input" name="city" value={formData.city} onChange={handleChange} required placeholder="e.g. Pune / Mumbai" />
              </div>
              <div className="form-group">
                <label>State <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input className="form-input" name="state" value={formData.state} onChange={handleChange} required placeholder="e.g. Maharashtra" />
              </div>
              <div className="form-group">
                <label>Pincode <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input className="form-input" name="pincode" maxLength={6} value={formData.pincode} onChange={handleChange} required placeholder="6-digit pincode" />
              </div>
            </div>
          </div>

          {/* Section 3: Identity & Document Uploads */}
          <div style={{
            background: 'var(--surface)', borderRadius: 16, padding: '28px 32px', marginBottom: 24,
            boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)',
          }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>3</span>
              Identity &amp; Government Documents
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              {/* Photo Upload */}
              <div className="form-group">
                <label>Applicant Photograph <span style={{ color: 'var(--danger)' }}>*</span></label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
                  {previews.photo ? (
                    <img src={previews.photo} alt="Preview" style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover', border: '2px solid var(--accent)' }} />
                  ) : (
                    <div style={{ width: 72, height: 72, borderRadius: 12, background: 'var(--surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', border: '1px dashed var(--border)' }}>
                      Photo
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'photo')} style={{ fontSize: '0.85rem' }} />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Clear front-facing passport style photo</p>
                  </div>
                </div>
              </div>

              {/* Aadhar Details */}
              <div className="form-group">
                <label>Aadhar Card Number <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input className="form-input" name="aadharNumber" maxLength={12} value={formData.aadharNumber} onChange={handleChange} required placeholder="12-digit Aadhar number" />
                <div style={{ marginTop: 8 }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Upload Aadhar Document (PDF/JPG) <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileChange(e, 'aadharDoc')} style={{ fontSize: '0.85rem', marginTop: 4 }} />
                </div>
              </div>

              {/* PAN Details */}
              <div className="form-group">
                <label>PAN Card Number <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input className="form-input" name="panNumber" maxLength={10} style={{ textTransform: 'uppercase' }} value={formData.panNumber} onChange={handleChange} required placeholder="e.g. ABCDE1234F" />
                <div style={{ marginTop: 8 }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Upload PAN Document (PDF/JPG) <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileChange(e, 'panDoc')} style={{ fontSize: '0.85rem', marginTop: 4 }} />
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="form-group">
                <label>Emergency Contact Name</label>
                <input className="form-input" name="emergencyContactName" value={formData.emergencyContactName} onChange={handleChange} placeholder="Relative / Family member" />
                <div style={{ marginTop: 8 }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Emergency Contact Phone</label>
                  <input className="form-input" name="emergencyContactPhone" maxLength={10} value={formData.emergencyContactPhone} onChange={handleChange} placeholder="10-digit number" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Bank Details for Salary */}
          <div style={{
            background: 'var(--surface)', borderRadius: 16, padding: '28px 32px', marginBottom: 24,
            boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)',
          }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>4</span>
              Bank Account Details (For Salary &amp; Payroll)
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <div className="form-group">
                <label>Bank Name</label>
                <input className="form-input" name="bankName" value={formData.bankName} onChange={handleChange} placeholder="e.g. State Bank of India, HDFC" />
              </div>
              <div className="form-group">
                <label>Account Number</label>
                <input className="form-input" name="bankAccountNumber" value={formData.bankAccountNumber} onChange={handleChange} placeholder="Bank account number" />
              </div>
              <div className="form-group">
                <label>IFSC Code</label>
                <input className="form-input" name="bankIfsc" style={{ textTransform: 'uppercase' }} value={formData.bankIfsc} onChange={handleChange} placeholder="e.g. SBIN0001234" />
              </div>
            </div>
          </div>

          {/* Section 5: Mandatory Declaration */}
          <div style={{
            background: 'var(--surface)', borderRadius: 16, padding: '28px 32px', marginBottom: 28,
            boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)',
          }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>5</span>
              Applicant Declaration
            </h2>

            <div style={{
              background: 'var(--surface-sunken)', borderRadius: 12, padding: '16px 20px',
              fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--text-muted)', marginBottom: 16,
            }}>
              "I hereby declare that all particulars, identity numbers (Aadhar, PAN), and documents furnished by me in this registration form are true, complete, and authentic to the best of my knowledge and belief. I understand that any false statement or omission of information will result in immediate disqualification or termination of employment and may attract legal action. I authorize GrowMore Parking Solutions to verify my credentials with the respective authorities."
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
              <input
                type="checkbox"
                name="declarationAccepted"
                checked={formData.declarationAccepted}
                onChange={handleChange}
                style={{ width: 20, height: 20, marginTop: 2, accentColor: 'var(--accent)' }}
              />
              <span>I agree to the declaration above and confirm all information and documents submitted are accurate and genuine.</span>
            </label>
          </div>

          {/* Submit Button */}
          <div style={{ textAlign: 'center' }}>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{
                width: 'auto', minWidth: 280, padding: '14px 40px', fontSize: '1.05rem',
                margin: '0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                  Submitting Registration...
                </>
              ) : (
                'Submit Application for Verification'
              )}
            </button>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 12 }}>
              Your application will be sent to the Finance &amp; Accountant team for verification.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
