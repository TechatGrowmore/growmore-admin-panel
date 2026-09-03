'use client';

import { useState, useEffect, useCallback } from 'react';
import ClientSwitcher from '@/components/ClientSwitcher';

export default function TeamPage() {
  const [selectedClient, setSelectedClient] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('all');

  // Fetch clients on mount
  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then(d => {
        const list = d.clients || [];
        if (list.length > 0) setSelectedClient(list[0].id);
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const fetchTeam = useCallback(async () => {
    if (!selectedClient) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/proxy/${selectedClient}/users`);
      if (!res.ok) throw new Error('Failed to fetch team');
      const data = await res.json();
      setTeamData(data);
    } catch (err) {
      console.error('Team fetch error:', err);
      setTeamData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedClient]);

  useEffect(() => {
    if (selectedClient) {
      fetchTeam();
    }
  }, [selectedClient, fetchTeam]);

  const drivers = teamData?.drivers || [];
  const supervisors = teamData?.supervisors || [];
  const managers = teamData?.managers || [];

  return (
    <div className="page-body">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>Team &amp; Staff</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.87rem' }}>Drivers, supervisors, and managers per venue</p>
        </div>

        <ClientSwitcher
          selectedClient={selectedClient}
          onSelect={(id) => setSelectedClient(id)}
          showAll={false}
        />
      </div>

      {loading ? (
        <div className="page-loading">
          <div className="spinner" />
          <span>Loading staff list...</span>
        </div>
      ) : !teamData ? (
        <div className="empty-state">
          <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
          <h3>No team data available</h3>
          <p>Select a valid client to view staff members</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="stats-grid">
            <div className="stat-card" style={{ '--card-accent': '#3B82F6' }}>
              <div className="stat-card-header">
                <span className="stat-card-label">Drivers</span>
                <div className="stat-card-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>🚗</div>
              </div>
              <div className="stat-card-value">{drivers.length}</div>
              <div className="stat-card-sub">registered drivers</div>
            </div>

            <div className="stat-card" style={{ '--card-accent': '#8B5CF6' }}>
              <div className="stat-card-header">
                <span className="stat-card-label">Supervisors</span>
                <div className="stat-card-icon" style={{ background: 'var(--purple-bg)', color: 'var(--purple)' }}>👔</div>
              </div>
              <div className="stat-card-value">{supervisors.length}</div>
              <div className="stat-card-sub">shift supervisors</div>
            </div>

            <div className="stat-card" style={{ '--card-accent': '#FF6B35' }}>
              <div className="stat-card-header">
                <span className="stat-card-label">Managers</span>
                <div className="stat-card-icon">👑</div>
              </div>
              <div className="stat-card-value">{managers.length}</div>
              <div className="stat-card-sub">venue managers</div>
            </div>
          </div>

          {/* Role Filter Tabs */}
          <div className="chart-card" style={{ marginBottom: 20 }}>
            <div className="chart-tabs">
              <button
                className={`chart-tab ${roleFilter === 'all' ? 'active' : ''}`}
                onClick={() => setRoleFilter('all')}
              >
                All Staff ({drivers.length + supervisors.length + managers.length})
              </button>
              <button
                className={`chart-tab ${roleFilter === 'driver' ? 'active' : ''}`}
                onClick={() => setRoleFilter('driver')}
              >
                Drivers ({drivers.length})
              </button>
              <button
                className={`chart-tab ${roleFilter === 'supervisor' ? 'active' : ''}`}
                onClick={() => setRoleFilter('supervisor')}
              >
                Supervisors ({supervisors.length})
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Phone</th>
                  <th>Assigned Venue</th>
                  <th>Supervisor / Manager</th>
                  <th>Today&apos;s Bookings</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {/* Managers */}
                {(roleFilter === 'all' || roleFilter === 'manager') && managers.map((m) => (
                  <tr key={m._id}>
                    <td><strong>{m.name}</strong></td>
                    <td><span className="badge badge-purple">Manager</span></td>
                    <td>{m.phone}</td>
                    <td>{m.venue?.name || 'All Venues'}</td>
                    <td>-</td>
                    <td>-</td>
                    <td><span className="badge badge-success">Active</span></td>
                  </tr>
                ))}

                {/* Supervisors */}
                {(roleFilter === 'all' || roleFilter === 'supervisor') && supervisors.map((s) => (
                  <tr key={s._id}>
                    <td><strong>{s.name}</strong></td>
                    <td><span className="badge badge-warning">Supervisor</span></td>
                    <td>{s.phone}</td>
                    <td>{s.venue?.name || 'Default Venue'}</td>
                    <td>{s.manager?.name || '-'}</td>
                    <td>-</td>
                    <td><span className="badge badge-success">Active</span></td>
                  </tr>
                ))}

                {/* Drivers */}
                {(roleFilter === 'all' || roleFilter === 'driver') && drivers.map((d) => (
                  <tr key={d._id}>
                    <td><strong>{d.name}</strong></td>
                    <td><span className="badge badge-info">Driver</span></td>
                    <td>{d.phone}</td>
                    <td>{d.venue?.name || 'Default Venue'}</td>
                    <td>{d.supervisor?.name || '-'}</td>
                    <td>
                      <strong style={{ color: d.todayBookings > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                        {d.todayBookings}
                      </strong>
                    </td>
                    <td>
                      {d.isActive !== false ? (
                        <span className="badge badge-success">Active</span>
                      ) : (
                        <span className="badge badge-danger">Inactive</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
