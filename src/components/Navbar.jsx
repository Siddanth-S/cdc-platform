import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, LogOut } from 'lucide-react';
import NotificationsDropdown from './NotificationsDropdown';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar-cyber" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Link to="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <GraduationCap className="text-primary" size={32} />
        <div>
          <h2 className="cyber-glitch-text" style={{ margin: 0, fontSize: '1.25rem' }}>NITK CDC</h2>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '2px' }}>
            Placement Portal
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success-color)', padding: '3px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <span className="live-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success-color)' }}></span> <span className="live-badge-text">LIVE REAL-TIME</span>
            </span>
          </div>
        </div>
      </Link>
      
      <div className="flex items-center gap-4">
        <NotificationsDropdown />
        <div className="navbar-user-info" style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontWeight: '500', fontSize: '0.9rem' }}>{user?.email.split('@')[0]}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--primary-color)', fontWeight: '600', letterSpacing: '0.5px' }}>{user?.role}</div>
        </div>
        <button onClick={handleLogout} className="cyber-logout-btn" title="Logout">
          <LogOut size={18} />
        </button>
      </div>
    </nav>
  );
}
