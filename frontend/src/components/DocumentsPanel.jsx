import { useState } from 'react';

const STATUS_META = {
  approved: { label: 'Approved', badge: 'badge-success' },
  pending: { label: 'Pending Approval', badge: 'badge-warning' },
  rejected: { label: 'Rejected', badge: 'badge-danger' },
  missing: { label: 'Not Uploaded', badge: 'badge-info' },
};

// HR / accountant: approve or reject one document. Resolves with the updated record.
// kind: 'fulltime' | 'parttime'
export async function reviewDocument(kind, id, docKey, status, remarks = '') {
  const res = await fetch(`/api/employees/${kind}/${id}/docs/${docKey}/review`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, remarks }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Review failed');
  return data.employee || data.driver;
}

function DocRow({ doc, mode, busy, onReview, onUpload }) {
  const [rejecting, setRejecting] = useState(false);
  const [remarks, setRemarks] = useState('');
  const meta = STATUS_META[doc.status] || STATUS_META.pending;

  const submitReject = async () => {
    if (!remarks.trim()) return;
    await onReview(doc.key, 'rejected', remarks.trim());
    setRejecting(false);
    setRemarks('');
  };

  const canUpload = mode === 'driver' && (doc.status === 'missing' || doc.status === 'rejected');

  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{doc.label}</div>
          {doc.status === 'approved' && doc.reviewedBy && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              by {doc.reviewedBy}{doc.reviewedByRole ? ` (${doc.reviewedByRole})` : ''}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className={`badge ${meta.badge}`}>{meta.label}</span>
          {doc.url && (
            <a href={doc.url} target="_blank" rel="noreferrer" className="btn-secondary btn-small" style={{ textDecoration: 'none' }}>View ↗</a>
          )}
          {mode === 'review' && doc.url && doc.status !== 'approved' && (
            <button type="button" className="btn-secondary btn-small" disabled={busy}
              style={{ color: 'var(--success)', borderColor: 'var(--success)' }}
              onClick={() => onReview(doc.key, 'approved')}>Approve</button>
          )}
          {mode === 'review' && doc.url && doc.status !== 'rejected' && !rejecting && (
            <button type="button" className="btn-secondary btn-small" disabled={busy}
              style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
              onClick={() => setRejecting(true)}>Reject</button>
          )}
          {canUpload && (
            <label className="btn-primary btn-small" style={{ width: 'auto', padding: '6px 12px', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Uploading...' : doc.status === 'rejected' ? 'Re-upload' : 'Upload'}
              <input type="file" hidden disabled={busy}
                accept={doc.key === 'photo' ? 'image/*' : 'image/*,application/pdf'}
                onChange={e => { const f = e.target.files[0]; e.target.value = ''; if (f) onUpload(doc.key, f); }} />
            </label>
          )}
        </div>
      </div>

      {doc.status === 'rejected' && doc.remarks && (
        <div style={{ marginTop: 8, background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 8, padding: '8px 12px', fontSize: '0.8rem' }}>
          <strong>Rejected{doc.reviewedBy ? ` by ${doc.reviewedBy}` : ''}:</strong> {doc.remarks}
          {mode === 'driver' && <div style={{ marginTop: 4 }}>Please upload a corrected copy and it will be sent for approval again.</div>}
        </div>
      )}
      {doc.status === 'pending' && mode === 'driver' && (
        <div style={{ marginTop: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Submitted. Waiting for HR / accountant approval.</div>
      )}

      {rejecting && (
        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="form-input" style={{ flex: '1 1 200px' }} autoFocus value={remarks}
            onChange={e => setRemarks(e.target.value)} placeholder="Reason for rejection (required)" />
          <button type="button" className="btn-secondary btn-small" onClick={() => { setRejecting(false); setRemarks(''); }}>Cancel</button>
          <button type="button" className="btn-primary btn-small" disabled={busy || !remarks.trim()}
            style={{ width: 'auto', background: 'var(--danger)' }} onClick={submitReject}>Confirm Reject</button>
        </div>
      )}
    </div>
  );
}

// documents: [{ key, label, url, status, remarks, reviewedBy, reviewedByRole }]
// mode 'review' (HR / accountant): onReview(key, status, remarks)
// mode 'driver': onUpload(key, file) for missing / rejected documents
export default function DocumentsPanel({ documents = [], mode = 'review', onReview, onUpload, busyKey = '' }) {
  return (
    <div>
      {documents.map(d => (
        <DocRow key={d.key} doc={d} mode={mode} busy={busyKey === d.key} onReview={onReview} onUpload={onUpload} />
      ))}
    </div>
  );
}
