import { useState } from 'react';

// Renders a "View Photo" button; the image is only requested once clicked.
export default function LazyPhoto({ src, label = 'View Photo', size = 120 }) {
  const [open, setOpen] = useState(false);
  if (!src) return <span style={{ color: 'var(--text-muted)' }}>—</span>;

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
      <button
        type="button"
        className="btn-secondary btn-small"
        onClick={() => setOpen(o => !o)}
        style={{ width: 'auto', padding: '4px 10px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
      >
        {open ? 'Hide Photo' : `📷 ${label}`}
      </button>
      {open && (
        <a href={src} target="_blank" rel="noreferrer">
          <img
            src={src}
            alt="Photo"
            style={{ width: size, height: size, maxWidth: '100%', borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border)', display: 'block' }}
          />
        </a>
      )}
    </span>
  );
}
