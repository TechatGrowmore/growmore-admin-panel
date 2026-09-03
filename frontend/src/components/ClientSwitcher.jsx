import { useState, useEffect, useRef } from 'react';

export default function ClientSwitcher({ selectedClient, onSelect, showAll = true }) {
  const [clients, setClients] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    fetch('/api/clients', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setClients(d.clients || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = selectedClient ? clients.find((c) => c.id === selectedClient) : null;

  return (
    <div className="client-switcher" ref={ref}>
      <button className="client-switcher-btn" onClick={() => setOpen(!open)}>
        <span className="dot" style={{ background: selected ? 'var(--success)' : 'var(--info)' }} />
        <span style={{ flex: 1, textAlign: 'left' }}>
          {selected ? selected.name : 'All Clients'}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>▼</span>
      </button>

      {open && (
        <div className="client-switcher-dropdown">
          {showAll && (
            <button
              className={!selectedClient ? 'active' : ''}
              onClick={() => { onSelect(null); setOpen(false); }}
            >
              <span className="dot" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--info)' }} />
              All Clients
            </button>
          )}
          {clients.map((client) => (
            <button
              key={client.id}
              className={selectedClient === client.id ? 'active' : ''}
              onClick={() => { onSelect(client.id); setOpen(false); }}
            >
              <span className="dot" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
              {client.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
