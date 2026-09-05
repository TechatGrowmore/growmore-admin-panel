/**
 * ManageModal — reusable modal shell for add/edit forms.
 *
 * Props:
 *  title      : string — modal heading
 *  onClose    : fn     — called when cancel/X is clicked
 *  onSave     : fn     — called when Save is clicked
 *  saving     : bool   — disables Save and shows spinner
 *  saveLabel  : string — optional custom Save button text
 *  children   : node   — form content
 */
export default function ManageModal({ title, onClose, onSave, saving = false, saveLabel, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="btn-primary"
            style={{ width: 'auto', padding: '10px 24px' }}
            onClick={onSave}
            disabled={saving}
          >
            {saving ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                Saving...
              </span>
            ) : (
              saveLabel || 'Save'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
