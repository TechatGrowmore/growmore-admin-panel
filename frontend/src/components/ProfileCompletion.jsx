import { useState } from 'react';

function colorFor(percent) {
  if (percent >= 100) return 'var(--success)';
  if (percent >= 60) return 'var(--accent)';
  if (percent >= 30) return 'var(--amber, #F5A623)';
  return 'var(--danger)';
}

// Progress bar for a profileCompletion = { percent, missing: [{ key, label, weight }] }.
// With `showMissing`, a toggle lists each pending field with the % it is worth.
export default function ProfileCompletion({ completion, showMissing = false, compact = false }) {
  const [open, setOpen] = useState(false);
  if (!completion) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const { percent, missing = [] } = completion;
  const color = colorFor(percent);

  return (
    <div style={{ minWidth: compact ? 110 : 160 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 8, borderRadius: 99, background: 'var(--surface-sunken, #eee)', overflow: 'hidden' }}>
          <div style={{ width: `${percent}%`, height: '100%', background: color, transition: 'width .3s' }} />
        </div>
        <strong style={{ fontSize: '0.78rem', color, minWidth: 34, textAlign: 'right' }}>{percent}%</strong>
      </div>
      {showMissing && missing.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            style={{ background: 'none', border: 'none', padding: 0, marginTop: 6, cursor: 'pointer', color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 600 }}
          >
            {open ? 'Hide' : `${missing.length} pending field${missing.length > 1 ? 's' : ''}`}
          </button>
          {open && (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {missing.map(m => <li key={m.key}>{m.label}{m.reason ? ` — ${m.reason}` : ""} <strong>(+{m.weight}%)</strong></li>)}
            </ul>
          )}
        </>
      )}
      {showMissing && missing.length === 0 && (
        <div style={{ marginTop: 4, fontSize: '0.75rem', color: 'var(--success)' }}>Profile complete</div>
      )}
    </div>
  );
}
