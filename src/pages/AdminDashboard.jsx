import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { ShieldCheck, Building2, Users, Crown, UserCog, ArrowLeft } from 'lucide-react';
import { formatName as formatEmailName } from '../utils/profileParser';

const formatName = (email) => formatEmailName(email) || '—';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);

  // HEAD-only route
  useEffect(() => {
    if (user && user.role !== 'HEAD') navigate('/dashboard');
  }, [user, navigate]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'drives'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => Number(a.id) - Number(b.id));
      setDrives(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const openDrives = useMemo(() => drives.filter(d => d.status !== 'Closed'), [drives]);

  // Assignment counts are tallied from CURRENT state of OPEN drives only.
  // If a primary SPOC is reassigned, the previous person stops being counted;
  // once a drive is closed, it no longer contributes to anyone's count.
  const counts = useMemo(() => {
    const map = {}; // email -> { primary, secondary }
    const bump = (email, key) => {
      if (!email) return;
      if (!map[email]) map[email] = { primary: 0, secondary: 0 };
      map[email][key] += 1;
    };
    openDrives.forEach(d => {
      bump(d.coordinator, 'primary');
      (d.secondarySpocs || []).forEach(s => bump(s, 'secondary'));
    });
    return Object.entries(map)
      .map(([email, c]) => ({ email, ...c, total: c.primary + c.secondary }))
      .sort((a, b) => b.total - a.total || b.primary - a.primary);
  }, [openDrives]);

  const stats = useMemo(() => ({
    totalDrives: drives.length,
    openDrives: openDrives.length,
    closedDrives: drives.length - openDrives.length,
    uniqueSpocs: counts.length,
  }), [drives, openDrives, counts]);

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading admin overview…</div>;
  }

  const statCards = [
    { label: 'Total Drives', value: stats.totalDrives, icon: Building2, color: 'var(--primary-color)' },
    { label: 'Open Drives', value: stats.openDrives, icon: ShieldCheck, color: 'var(--success-color)' },
    { label: 'Closed Drives', value: stats.closedDrives, icon: Building2, color: 'var(--text-secondary)' },
    { label: 'Active SPOCs', value: stats.uniqueSpocs, icon: Users, color: 'var(--accent-color)' },
  ];

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      <div className="flex items-center gap-2 mb-4" style={{ gap: '0.75rem' }}>
        <button onClick={() => navigate('/dashboard')} className="btn-glass" title="Back to dashboard" style={{ padding: '0.5rem' }}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="cyber-glitch-text" style={{ fontSize: '2.2rem', marginBottom: '0.2rem' }}>Admin Overview</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>SPOC assignments and live workload across all drives.</p>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="admin-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
        {statCards.map(s => (
          <div key={s.label} className="cyber-card" style={{ padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
            <div style={{ background: 'rgba(96,165,250,0.12)', borderRadius: '12px', padding: '0.6rem', display: 'flex', color: s.color }}>
              <s.icon size={22} />
            </div>
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Assignment counts */}
      <div className="cyber-card" style={{ padding: '1.25rem', marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <UserCog size={20} className="text-primary" /> Assignment Counts
        </h2>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Counts reflect <strong>currently open drives only</strong>. Reassigning or closing a drive updates these live.
        </p>
        {counts.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '1rem 0' }}>No active SPOC assignments.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '460px' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '0.5rem 0.75rem' }}>SPOC</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Primary</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Secondary</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {counts.map(c => (
                  <tr key={c.email} style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatName(c.email)}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{c.email}</div>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: c.primary ? 'var(--primary-color)' : 'var(--text-secondary)', fontWeight: 700 }}>
                        <Crown size={13} /> {c.primary}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', color: c.secondary ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: 700 }}>{c.secondary}</td>
                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                      <span className="cyber-badge">{c.total}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SPOC per company */}
      <div className="cyber-card" style={{ padding: '1.25rem' }}>
        <h2 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Building2 size={20} className="text-primary" /> SPOCs by Company
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '560px' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '0.5rem 0.75rem' }}>Company</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Status</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Primary SPOC</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Secondary SPOCs</th>
              </tr>
            </thead>
            <tbody>
              {drives.map(d => {
                const closed = d.status === 'Closed';
                return (
                  <tr key={d.id} style={{ borderTop: '1px solid var(--border-color)', opacity: closed ? 0.6 : 1 }}>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.company}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{d.role}</div>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '0.15rem 0.5rem', borderRadius: '10px', color: closed ? '#f87171' : '#4ade80', background: closed ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', border: `1px solid ${closed ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)'}` }}>
                        {closed ? 'Closed' : 'Active'}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--primary-color)', fontWeight: 600 }}>
                        <Crown size={13} /> {formatName(d.coordinator)}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {(d.secondarySpocs || []).filter(Boolean).length === 0 ? (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>—</span>
                        ) : (
                          (d.secondarySpocs || []).filter(Boolean).map((s, i) => (
                            <span key={`${s}-${i}`} style={{ fontSize: '0.72rem', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: 'var(--accent-color)', padding: '0.15rem 0.5rem', borderRadius: '10px' }}>{formatName(s)}</span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
