import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, LogOut, UserCircle } from 'lucide-react';
import NotificationsDropdown from './NotificationsDropdown';
import { parseEmailProfile } from '../utils/profileParser';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', branch: '', gradYear: '' });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleOpenProfile = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'users', user.email));
      if (docSnap.exists() && docSnap.data().branch !== 'ADMIN') {
        const data = docSnap.data();
        setProfileForm({ name: data.name || '', branch: data.branch || '', gradYear: data.gradYear || '' });
      } else {
        const parsed = parseEmailProfile(user.email);
        if (parsed) setProfileForm(parsed);
      }
    } catch(err) {
      console.error(err);
    }
    setShowProfileModal(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileForm.branch) return;
    try {
      await setDoc(doc(db, 'users', user.email), { 
        name: profileForm.name,
        branch: profileForm.branch,
        gradYear: profileForm.gradYear
      }, { merge: true });
      setShowProfileModal(false);
    } catch (err) {
      console.error(err);
    }
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
        <button onClick={handleOpenProfile} className="cyber-logout-btn" title="Edit Profile" style={{ padding: '0.4rem', borderRadius: '50%' }}>
          <UserCircle size={20} />
        </button>
        <button onClick={handleLogout} className="cyber-logout-btn" title="Logout" style={{ padding: '0.4rem', borderRadius: '50%' }}>
          <LogOut size={18} />
        </button>
      </div>

      {showProfileModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem 2rem', textAlign: 'center', position: 'relative' }}>
            <button onClick={() => setShowProfileModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.5rem', color: '#fff' }}>Edit Profile</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem' }}>
              Update your details.
            </p>
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>Name</label>
                <input 
                  type="text" 
                  className="cyber-input" 
                  value={profileForm.name}
                  onChange={e => setProfileForm({...profileForm, name: e.target.value})}
                  required
                />
              </div>
              
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>Branch</label>
                <select 
                  className="input-field" 
                  style={{ width: '100%' }}
                  value={profileForm.branch}
                  onChange={e => setProfileForm({...profileForm, branch: e.target.value})}
                  required
                >
                  <option value="" disabled>Select Branch</option>
                  <option value="CSE">Computer Science (CSE)</option>
                  <option value="IT">Information Technology (IT)</option>
                  <option value="AI">Artificial Intelligence (AI)</option>
                  <option value="DS">Computational Data Science (DS)</option>
                  <option value="ECE">Electronics (ECE)</option>
                  <option value="EEE">Electrical (EEE)</option>
                  <option value="MECH">Mechanical (MECH)</option>
                  <option value="CIVIL">Civil Engineering (CIVIL)</option>
                  <option value="CHEM">Chemical Engineering (CHEM)</option>
                  <option value="META">Metallurgy (META)</option>
                  <option value="MINING">Mining Engineering (MINING)</option>
                  <option value="MBA">School of Management (MBA)</option>
                  <option value="MCA">Master of Computer Applications (MCA)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>Expected Graduation Year</label>
                <input 
                  type="text" 
                  className="cyber-input" 
                  value={profileForm.gradYear}
                  onChange={e => setProfileForm({...profileForm, gradYear: e.target.value})}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary w-full" style={{ padding: '0.8rem', marginTop: '1rem' }}>Save Changes</button>
            </form>
          </div>
        </div>
      )}
    </nav>
  );
}
