import { useState, useEffect, useRef } from 'react';
import ProfileCompletion from '../../components/ProfileCompletion';
import LazyPhoto from '../../components/LazyPhoto';
import DocumentsPanel, { reviewDocument } from '../../components/DocumentsPanel';

const INDIAN_STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Chandigarh','Puducherry'];

const EMPTY_FORM = {
  firstName: '', lastName: '', phone: '', email: '', dob: '', gender: 'Male', bloodGroup: '',
  designation: 'Driver', venue: '', department: 'Operations', joiningDate: '', salary: '',
  addressLine1: '', addressLine2: '', city: '', state: '', pincode: '',
  aadharAddressLine1: '', aadharAddressLine2: '', aadharCity: '', aadharState: '', aadharPincode: '',
  aadharNumber: '', panNumber: '',
  emergencyContactName: '', emergencyContactPhone: '',
  bankName: '', bankAccountHolderName: '', bankAccountNumber: '', bankIfsc: '', bankBranchName: '',
  pfNumber: '', esicNumber: '', declarationAccepted: false,
};

// Server-computed / read-only values that must not be sent back
const SKIP_KEYS = ['id', 'docReviews', 'documents', 'profileCompletion', 'createdAt', 'updatedAt', 'status',
  'photoUrl', 'aadharDocUrl', 'panDocUrl', 'licenseDocUrl', 'passbookDocUrl', 'fullName',
  'rejectionRemarks', 'verifiedBy', 'verifiedAt', 'isLoginEnabled', 'publicFormToken', 'submittedViaPublicForm', 'declarationDate'];

const FILE_FIELDS = [
  ['photo', 'Profile Photo', 'photoUrl', 'image/*'],
  ['aadharDoc', 'Aadhar Document', 'aadharDocUrl', 'image/*,application/pdf'],
  ['panDoc', 'PAN Document', 'panDocUrl', 'image/*,application/pdf'],
  ['licenseDoc', 'Driving License', 'licenseDocUrl', 'image/*,application/pdf'],
  ['passbookDoc', 'Bank Passbook', 'passbookDocUrl', 'image/*,application/pdf'],
];

const FILE_INPUT_STYLE = { padding: 8, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', width: '100%', fontSize: '0.8rem' };

function EmployeeModal({ emp, onClose, onSave, onChanged }) {
  const [rec, setRec] = useState(emp || null); // latest server copy (documents + completion)
  const [form, setForm] = useState({ ...EMPTY_FORM, ...emp, dob: emp?.dob?.split('T')[0] || '', joiningDate: emp?.joiningDate?.split('T')[0] || '' });
  const [files, setFiles] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [busyKey, setBusyKey] = useState('');
  const [venues, setVenues] = useState([]);

  useEffect(() => {
    fetch('/api/employees/venues?active=true', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : { venues: [] }))
      .then(d => setVenues(d.venues || []))
      .catch(() => {});
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };
  const handleFile = (e) => setFiles(f => ({ ...f, [e.target.name]: e.target.files[0] }));

  const handleSubmit = async (submitForVerification = false) => {
    setLoading(true); setError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (SKIP_KEYS.includes(k) || v === null || v === undefined || typeof v === 'object') return;
        fd.append(k, v);
      });
      if (submitForVerification) fd.append('submitForVerification', 'true');
      Object.entries(files).forEach(([k, v]) => { if (v) fd.append(k, v); });

      const url = emp?.id ? `/api/employees/fulltime/${emp.id}` : '/api/employees/fulltime';
      const method = emp?.id ? 'PUT' : 'POST';
      const res = await fetch(url, { method, credentials: 'include', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      onSave(data.employee);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const review = async (docKey, status, remarks) => {
    setBusyKey(docKey); setError('');
    try {
      const updated = await reviewDocument('fulltime', emp.id, docKey, status, remarks);
      setRec(updated);
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKey('');
    }
  };

  const text = (name, label, type = 'text', extra = {}) => (
    <div className="form-group" key={name} style={{ margin: 0, ...extra.style }}>
      <label>{label}</label>
      <input className="form-input" type={type} name={name} value={form[name] || ''} onChange={handleChange} placeholder={label.replace(' *', '')} />
    </div>
  );
  const stateSelect = (name, label) => (
    <div className="form-group" key={name} style={{ margin: 0 }}>
      <label>{label}</label>
      <select className="form-input" name={name} value={form[name] || ''} onChange={handleChange}>
        <option value="">Select State</option>
        {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
      </select>
    </div>
  );
  const sectionTitle = (t) => (
    <div style={{ gridColumn: '1/-1', fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent)', marginTop: 4 }}>{t}</div>
  );
  const grid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };

  const STEPS = ['Personal Info', 'Address', 'Documents', 'Bank & PF/ESIC', 'Employment & Declaration'];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 720 }}>
        <div className="modal-header">
          <h2>{emp?.id ? 'Edit Employee' : 'Register Full-Time Employee'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {rec?.profileCompletion && (
          <div style={{ padding: '12px 24px 0' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Profile completion (documents count once approved)</div>
            <ProfileCompletion completion={rec.profileCompletion} showMissing />
          </div>
        )}

        {/* Step tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px', overflowX: 'auto', marginTop: 8 }}>
          {STEPS.map((tab, i) => (
            <button key={i} onClick={() => setStep(i + 1)} style={{
              padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              fontSize: '0.82rem', fontWeight: 600, borderBottom: `2px solid ${step === i + 1 ? 'var(--accent)' : 'transparent'}`,
              color: step === i + 1 ? 'var(--accent)' : 'var(--text-muted)',
            }}>{i + 1}. {tab}</button>
          ))}
        </div>

        <div className="modal-body" style={{ maxHeight: '55vh', overflowY: 'auto' }}>
          {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

          {step === 1 && (
            <div style={grid}>
              {text('firstName', 'First Name *')}
              {text('lastName', 'Last Name *')}
              {text('phone', 'Phone Number *', 'tel')}
              {text('email', 'Email Address', 'email')}
              {text('dob', 'Date of Birth', 'date')}
              {text('bloodGroup', 'Blood Group')}
              <div className="form-group" style={{ margin: 0 }}>
                <label>Gender</label>
                <select className="form-input" name="gender" value={form.gender} onChange={handleChange}>
                  {['Male', 'Female', 'Other'].map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              {text('emergencyContactName', 'Emergency Contact Name')}
              {text('emergencyContactPhone', 'Emergency Contact Phone', 'tel')}
            </div>
          )}

          {step === 2 && (
            <div style={grid}>
              {sectionTitle('Current Address Details')}
              {text('addressLine1', 'Address Line 1')}
              {text('addressLine2', 'Address Line 2')}
              {text('city', 'City')}
              {stateSelect('state', 'State')}
              {text('pincode', 'Pincode')}
              {sectionTitle('Address as per Aadhar Card')}
              {text('aadharAddressLine1', 'Address Line 1')}
              {text('aadharAddressLine2', 'Address Line 2')}
              {text('aadharCity', 'City')}
              {stateSelect('aadharState', 'State')}
              {text('aadharPincode', 'Pincode')}
            </div>
          )}

          {step === 3 && (
            <div style={grid}>
              {text('aadharNumber', 'Aadhar Number')}
              {text('panNumber', 'PAN Number')}
              {FILE_FIELDS.map(([name, label, urlKey, accept]) => (
                <div className="form-group" key={name} style={{ margin: 0 }}>
                  <label>{label}</label>
                  <input type="file" name={name} accept={accept} onChange={handleFile} style={FILE_INPUT_STYLE} />
                  {emp?.[urlKey] && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>A file is already uploaded. Choosing a new one resets its approval.</div>}
                </div>
              ))}
              {emp?.id && rec?.documents && (
                <div style={{ gridColumn: '1/-1', marginTop: 8 }}>
                  {sectionTitle('Document approval')}
                  <DocumentsPanel documents={rec.documents} mode="review" onReview={review} busyKey={busyKey} />
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div style={grid}>
              {sectionTitle('Bank Account Details')}
              {text('bankName', 'Bank Name')}
              {text('bankAccountHolderName', 'Account Holder Name')}
              {text('bankAccountNumber', 'Account Number')}
              {text('bankIfsc', 'IFSC Code')}
              {text('bankBranchName', 'Branch Name')}
              {sectionTitle('PF & ESIC')}
              {text('pfNumber', 'PF Number')}
              {text('esicNumber', 'ESIC Number')}
            </div>
          )}

          {step === 5 && (
            <div style={grid}>
              {text('designation', 'Designation')}
              <div className="form-group" style={{ margin: 0 }}>
                <label>Venue</label>
                <select className="form-input" name="venue" value={form.venue || ''} onChange={handleChange}>
                  <option value="">Select venue</option>
                  {venues.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                  {form.venue && !venues.some(v => v.name === form.venue) && <option value={form.venue}>{form.venue}</option>}
                </select>
              </div>
              {text('department', 'Department')}
              {text('salary', 'Monthly Salary (₹)', 'number')}
              {text('joiningDate', 'Joining Date', 'date')}
              <div style={{ gridColumn: '1/-1', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 16, marginTop: 8 }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
                  <strong>Declaration:</strong> I hereby declare that the information furnished above is true, complete and correct to the best of my knowledge and belief. I understand that in the event of my information being found false or incorrect at any point of time, I shall be liable to be terminated without notice. I consent to GrowMore Parking Solutions Pvt. Ltd. using this information for employment purposes.
                </p>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                  <input type="checkbox" name="declarationAccepted" checked={!!form.declarationAccepted}
                    onChange={handleChange} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
                  I accept the above declaration
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 1 && <button className="btn-secondary" onClick={() => setStep(s => s - 1)}>← Back</button>}
            {step < STEPS.length && <button className="btn-primary" style={{ width: 'auto', padding: '9px 20px' }} onClick={() => setStep(s => s + 1)}>Next →</button>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={() => handleSubmit(false)} disabled={loading}>
              {emp?.id ? 'Save Changes' : 'Save Draft'}
            </button>
            {step === STEPS.length && (
              <button className="btn-primary" style={{ width: 'auto', padding: '9px 20px' }}
                onClick={() => handleSubmit(true)} disabled={loading || !form.declarationAccepted}>
                {loading ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />Saving...</> : 'Submit for Verification'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HREmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDetails, setShowDetails] = useState(null);
  const [docBusy, setDocBusy] = useState('');
  const [toast, setToast] = useState('');

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      const res = await fetch(`/api/employees/fulltime?${params}`, { credentials: 'include' });
      const data = res.ok ? await res.json() : { employees: [] };
      setEmployees(data.employees || []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { loadEmployees(); }, [search, statusFilter]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleDelete = async (id) => {
    if (!confirm('Delete this employee?')) return;
    await fetch(`/api/employees/fulltime/${id}`, { method: 'DELETE', credentials: 'include' });
    showToast('Employee deleted');
    loadEmployees();
  };

  const statusBadge = (s) => {
    const map = { pending: ['badge-warning', 'Pending'], hr_approved: ['badge-info', 'Sent for Verification'], verified: ['badge-success', 'Verified'], rejected: ['badge-danger', 'Rejected'] };
    const [cls, label] = map[s] || ['badge-neutral', s];
    return <span className={`badge ${cls}`}>{label}</span>;
  };

  return (
    <div>
      {toast && <div className="toast-container"><div className="toast toast-success">{toast}</div></div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Full-Time Employees</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Manage and verify full-time employee registrations</p>
        </div>
        <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => { setSelectedEmp(null); setShowModal(true); }}>
          + Register Employee
        </button>
      </div>

      <div className="data-table-container">
        <div className="data-table-header">
          <input className="filter-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search by name or phone..." style={{ minWidth: 240 }} />
          <div className="data-table-filters">
            <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="hr_approved">Sent for Verification</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="page-loading"><div className="spinner" /><span>Loading...</span></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>Name</th><th>Phone</th><th>Designation</th><th>Profile</th>
                <th>Aadhar</th><th>PAN</th><th>Status</th><th>Registered</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr><td colSpan="10" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>No employees found</td></tr>
              ) : employees.map((emp, i) => (
                <tr key={emp.id}>
                  <td>{i + 1}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {emp.photoUrl ? (
                        <img src={emp.photoUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-glow)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                          {emp.firstName?.[0]}
                        </div>
                      )}
                      <div>
                        <strong>{emp.firstName} {emp.lastName}</strong>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{emp.phone}</td>
                  <td>{emp.designation || 'Driver'}</td>
                  <td><ProfileCompletion completion={emp.profileCompletion} compact /></td>
                  <td>
                    {emp.aadharNumber ? (
                      <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {emp.aadharNumber.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3')}
                      </span>
                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td>
                    {emp.panNumber ? (
                      <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{emp.panNumber}</span>
                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td>{statusBadge(emp.status)}</td>
                  <td style={{ fontSize: '0.78rem' }}>{new Date(emp.createdAt).toLocaleDateString('en-IN')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-secondary btn-small" onClick={() => setShowDetails(emp)}>View</button>
                      <button className="btn-secondary btn-small" onClick={() => { setSelectedEmp(emp); setShowModal(true); }}>Edit</button>
                      <button className="btn-danger btn-small btn-secondary" onClick={() => handleDelete(emp.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <EmployeeModal
          emp={selectedEmp}
          onClose={() => setShowModal(false)}
          onSave={(saved) => { showToast('Employee saved successfully!'); setShowModal(false); loadEmployees(); }}
          onChanged={loadEmployees}
        />
      )}

      {showDetails && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDetails(null)}>
          <div className="modal-content" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h2>Employee Details — {showDetails.firstName} {showDetails.lastName}</h2>
              <button className="modal-close" onClick={() => setShowDetails(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ background: 'var(--bg-input)', padding: 12, borderRadius: 'var(--radius-sm)', marginBottom: 12 }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Profile Completion</div>
                <ProfileCompletion completion={showDetails.profileCompletion} showMissing />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {showDetails.photoUrl && (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', marginBottom: 12 }}>
                    <img src={showDetails.photoUrl} alt="Profile" style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent)' }} />
                  </div>
                )}
                {[
                  ['Full Name', `${showDetails.firstName} ${showDetails.lastName}`],
                  ['Phone', showDetails.phone], ['Email', showDetails.email || '—'],
                  ['DOB', showDetails.dob ? new Date(showDetails.dob).toLocaleDateString('en-IN') : '—'],
                  ['Gender', showDetails.gender], ['Blood Group', showDetails.bloodGroup || '—'],
                  ['Address', [showDetails.addressLine1, showDetails.addressLine2, showDetails.city, showDetails.state, showDetails.pincode].filter(Boolean).join(', ') || '—'],
                  ['Aadhar No.', showDetails.aadharNumber || '—'], ['PAN No.', showDetails.panNumber || '—'],
                  ['Designation', showDetails.designation || '—'], ['Venue', showDetails.venue || '—'],
                  ['Aadhar Address', [showDetails.aadharAddressLine1, showDetails.aadharAddressLine2, showDetails.aadharCity, showDetails.aadharState, showDetails.aadharPincode].filter(Boolean).join(', ') || '—'],
                  ['Bank', [showDetails.bankName, showDetails.bankBranchName].filter(Boolean).join(' — ') || '—'],
                  ['Account Holder', showDetails.bankAccountHolderName || '—'],
                  ['Account No.', showDetails.bankAccountNumber || '—'], ['IFSC', showDetails.bankIfsc || '—'],
                  ['PF No.', showDetails.pfNumber || '—'], ['ESIC No.', showDetails.esicNumber || '—'],
                  ['Department', showDetails.department || '—'],
                  ['Salary', showDetails.salary ? `₹${showDetails.salary.toLocaleString('en-IN')}` : '—'],
                  ['Joining Date', showDetails.joiningDate ? new Date(showDetails.joiningDate).toLocaleDateString('en-IN') : '—'],
                  ['Status', showDetails.status], ['Declaration', showDetails.declarationAccepted ? 'Accepted' : 'Not accepted'],
                ].map(([label, val]) => (
                  <div key={label} style={{ background: 'var(--bg-input)', padding: 12, borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Documents</div>
                <DocumentsPanel documents={showDetails.documents} mode="review" busyKey={docBusy}
                  onReview={async (key, status, remarks) => {
                    setDocBusy(key);
                    try { setShowDetails(await reviewDocument('fulltime', showDetails.id, key, status, remarks)); loadEmployees(); }
                    catch (err) { alert(err.message); }
                    finally { setDocBusy(''); }
                  }} />
              </div>
              {showDetails.status === 'rejected' && showDetails.rejectionRemarks && (
                <div style={{ marginTop: 16, background: 'var(--danger-bg)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 'var(--radius-md)', padding: 14, color: 'var(--danger)', fontSize: '0.85rem' }}>
                  <strong>Rejection Remarks:</strong> {showDetails.rejectionRemarks}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDetails(null)}>Close</button>
              <button className="btn-primary" style={{ width: 'auto', padding: '9px 20px' }}
                onClick={() => { setSelectedEmp(showDetails); setShowModal(true); setShowDetails(null); }}>
                Edit Employee
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
