import { useState, useEffect } from 'react';
import ProfileCompletion from './ProfileCompletion';
import DocumentsPanel from './DocumentsPanel';
import { compressImage } from '../utils/compressImage';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '');
const join = (...parts) => parts.filter(Boolean).join(', ');

function sectionsFor(kind, r) {
  if (kind === 'fulltime') {
    return [
      ['Personal Details', [
        ['Name', `${r.firstName || ''} ${r.lastName || ''}`.trim()],
        ['Mobile', r.phone], ['Email', r.email], ['Date of Birth', fmtDate(r.dob)],
        ['Gender', r.gender], ['Blood Group', r.bloodGroup],
        ['Designation', r.designation], ['Venue', r.venue],
      ]],
      ['Current Address', [['Address', join(r.addressLine1, r.addressLine2, r.city, r.state, r.pincode)]]],
      ['Address as per Aadhar', [['Address', join(r.aadharAddressLine1, r.aadharAddressLine2, r.aadharCity, r.aadharState, r.aadharPincode)]]],
      ['Identity', [['Aadhar Number', r.aadharNumber], ['PAN Number', r.panNumber]]],
      ['Emergency Contact', [['Name', r.emergencyContactName], ['Phone', r.emergencyContactPhone]]],
      ['Bank Details', [
        ['Bank', r.bankName], ['Account Holder', r.bankAccountHolderName], ['Account Number', r.bankAccountNumber],
        ['IFSC', r.bankIfsc], ['Branch', r.bankBranchName],
      ]],
      ['PF & ESIC', [['PF Number', r.pfNumber], ['ESIC Number', r.esicNumber]]],
    ];
  }
  return [
    ['Personal Details', [
      ['Name', `${r.firstName || ''} ${r.lastName || ''}`.trim()],
      ['Mobile', r.phone], ['Email', r.email], ['Address', r.address],
      ['Registered On', fmtDate(r.registrationDate || r.createdAt)],
    ]],
    ['Identity', [['Aadhar Number', r.aadharNumber]]],
    ['Bank Details', [
      ['Bank', r.bankName], ['Account Holder', r.bankAccountHolderName], ['Account Number', r.bankAccountNumber],
      ['IFSC', r.bankIfsc], ['Branch', r.bankBranchName],
    ]],
  ];
}

// Read-only view of a driver's own registration: completion %, entered details, document status.
// Details cannot be edited here; only rejected / missing documents can be uploaded again.
// kind: 'fulltime' | 'parttime'
export default function DriverProfileView({ kind }) {
  const [rec, setRec] = useState(null);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [msg, setMsg] = useState('');
  const base = `/api/employees/${kind}/me`;
  const respKey = kind === 'fulltime' ? 'employee' : 'driver';

  useEffect(() => {
    fetch(base, { credentials: 'include' })
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => (ok ? setRec(d[respKey]) : setError(d.message || 'Could not load profile')))
      .catch(() => setError('Could not load profile'));
  }, [base, respKey]);

  const upload = async (docKey, file) => {
    setBusyKey(docKey); setError(''); setMsg('');
    try {
      const fd = new FormData();
      fd.append('file', await compressImage(file));
      const res = await fetch(`${base}/docs/${docKey}`, { method: 'POST', credentials: 'include', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      setRec(data[respKey]);
      setMsg('Document uploaded and sent for approval.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKey('');
    }
  };

  if (!rec) {
    return error
      ? <div className="login-error" style={{ marginTop: 16 }}>{error}</div>
      : <div className="page-loading" style={{ minHeight: 120 }}><div className="spinner" /></div>;
  }

  const rejectedCount = (rec.documents || []).filter(d => d.status === 'rejected').length;
  const card = { background: 'var(--bg-card, var(--surface))', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 20px', marginTop: 16 };
  const title = { fontSize: '0.95rem', fontWeight: 700, marginBottom: 10 };

  return (
    <div>
      <div style={card}>
        <div style={title}>Profile Completion</div>
        <ProfileCompletion completion={rec.profileCompletion} showMissing />
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
          Your profile reaches 100% once every document is approved by HR / accountant.
        </p>
      </div>

      <div style={card}>
        <div style={title}>Documents</div>
        {rejectedCount > 0 && (
          <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 8, padding: '8px 12px', fontSize: '0.82rem', marginBottom: 8 }}>
            {rejectedCount} document{rejectedCount > 1 ? 's were' : ' was'} rejected. Please upload corrected copies.
          </div>
        )}
        {error && <div className="login-error" style={{ marginBottom: 8 }}>{error}</div>}
        {msg && <div style={{ background: 'var(--success-bg)', color: 'var(--success)', borderRadius: 8, padding: '8px 12px', fontSize: '0.82rem', marginBottom: 8 }}>{msg}</div>}
        <DocumentsPanel documents={rec.documents} mode="driver" onUpload={upload} busyKey={busyKey} />
      </div>

      {sectionsFor(kind, rec).map(([heading, rows]) => (
        <div key={heading} style={card}>
          <div style={title}>{heading}</div>
          {rows.map(([label, val]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', flexShrink: 0 }}>{label}</span>
              <span style={{ fontWeight: 600, fontSize: '0.85rem', textAlign: 'right', wordBreak: 'break-word' }}>{val || '—'}</span>
            </div>
          ))}
        </div>
      ))}
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 12, textAlign: 'center' }}>
        To change any of these details, please contact HR.
      </p>
    </div>
  );
}
