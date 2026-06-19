import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, LogOut, User, Edit3, Sun, Moon } from 'lucide-react';
import { toast } from 'react-hot-toast';
import NotificationsDropdown from './NotificationsDropdown';
import { parseEmailProfile } from '../utils/profileParser';
import { db } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { playSFX } from '../utils/sfx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showHoverCard, setShowHoverCard] = useState(false);
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [profileForm, setProfileForm] = useState({ name: '', degree: '', branch: '', gradYear: '', phoneNumber: '', personalEmail: '' });

  useEffect(() => {
    if (!user?.email) return;
    if (user.role === 'HEAD') {
      setProfileData({ name: user.email.split('@')[0], degree: 'Administrator', branch: 'ADMIN', gradYear: '' });
      return;
    }
    const unsubscribe = onSnapshot(doc(db, 'users', user.email), (docSnap) => {
      if (docSnap.exists()) {
        setProfileData(docSnap.data());
      } else {
        const parsed = parseEmailProfile(user.email);
        setProfileData(parsed);
      }
    });
    return () => unsubscribe();
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleOpenProfile = async () => {
    if (user.role === 'HEAD') {
      setProfileForm({
        name: profileData?.name || '',
        degree: 'Administrator',
        branch: 'ADMIN',
        gradYear: '',
        phoneNumber: profileData?.phoneNumber || '',
        personalEmail: profileData?.personalEmail || ''
      });
      setIsEditingInline(true);
      return;
    }
    try {
      const docSnap = await getDoc(doc(db, 'users', user.email));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfileForm({
          name: data.name || '',
          degree: data.degree || '',
          branch: data.branch || '',
          gradYear: data.gradYear || '',
          phoneNumber: data.phoneNumber || '',
          personalEmail: data.personalEmail || ''
        });
      } else {
        const parsed = parseEmailProfile(user.email);
        if (parsed) setProfileForm({
          name: parsed.name || '',
          degree: parsed.degree || '',
          branch: parsed.branch || '',
          gradYear: parsed.gradYear || '',
          phoneNumber: '',
          personalEmail: ''
        });
      }
    } catch(err) {
      console.error(err);
    }
    setIsEditingInline(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileForm.branch) return;
    try {
      await setDoc(doc(db, 'users', user.email), { 
        name: profileForm.name,
        degree: profileForm.degree,
        branch: profileForm.branch,
        gradYear: profileForm.gradYear,
        phoneNumber: profileForm.phoneNumber,
        personalEmail: profileForm.personalEmail
      }, { merge: true });
      setIsEditingInline(false);
      toast.success('Profile details updated successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update profile');
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
        <div className="navbar-user-info" style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontWeight: '500', fontSize: '0.9rem' }}>{profileData?.name || user?.email.split('@')[0]}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--primary-color)', fontWeight: '600', letterSpacing: '0.5px' }}>{user?.role}</div>
        </div>

        <div style={{ position: 'relative' }}>
          <button 
            onClick={() => {
              playSFX('click');
              if (showHoverCard) {
                setShowHoverCard(false);
                setIsEditingInline(false);
              } else {
                setShowHoverCard(true);
              }
            }}
            className="cyber-logout-btn" 
            title="Edit Profile" 
            style={{ 
              padding: '0.4rem', 
              borderRadius: '50%', 
              color: 'var(--primary-color)',
              background: 'rgba(59, 130, 246, 0.1)',
              boxShadow: '0 0 15px rgba(59, 130, 246, 0.4)',
              border: '1px solid var(--primary-color)',
              transition: 'all 0.3s ease'
            }}
          >
            <User size={24} className="logo-glow" />
          </button>
          
          {showHoverCard && profileData && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => { setShowHoverCard(false); setIsEditingInline(false); }}></div>
              <div className="animate-fade-in" style={{
                position: 'absolute',
                top: 'calc(100% + 12px)',
                right: '0',
                background: 'var(--dropdown-bg)',
                backdropFilter: 'blur(12px)',
                border: '1px solid var(--primary-color)',
                borderRadius: '16px',
                padding: '1.2rem',
                width: '320px',
                maxWidth: 'calc(100vw - 2rem)',
                boxShadow: '0 10px 30px var(--glass-shadow), 0 0 20px rgba(59, 130, 246, 0.2)',
                zIndex: 1000,
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '-9px',
                  right: '18px',
                  width: '0',
                  height: '0',
                  borderLeft: '10px solid transparent',
                  borderRight: '10px solid transparent',
                  borderBottom: '10px solid var(--primary-color)'
                }}></div>
                <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '1.1rem', letterSpacing: '0.5px' }}>{profileData.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{user?.email}</div>
                </div>
                
                <div style={{ height: '1px', background: 'rgba(59, 130, 246, 0.3)', margin: '0.5rem 0' }}></div>
                
                {!isEditingInline ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.6rem 1rem', fontSize: '0.85rem', padding: '0 0.5rem' }}>
                      <span style={{ color: 'var(--primary-color)', fontWeight: '600' }}>Degree:</span>
                      <span style={{ color: 'var(--text-primary)' }}>{profileData.degree}</span>
                      
                      <span style={{ color: 'var(--primary-color)', fontWeight: '600' }}>Branch:</span>
                      <span style={{ color: 'var(--text-primary)' }}>{profileData.branch}</span>
                      
                      <span style={{ color: 'var(--primary-color)', fontWeight: '600' }}>Grad Year:</span>
                      <span style={{ color: 'var(--text-primary)' }}>{profileData.gradYear}</span>
                      
                      {profileData.phoneNumber && (
                        <>
                          <span style={{ color: 'var(--primary-color)', fontWeight: '600' }}>Phone:</span>
                          <span style={{ color: 'var(--text-primary)' }}>{profileData.phoneNumber}</span>
                        </>
                      )}
                      {profileData.personalEmail && (
                        <>
                          <span style={{ color: 'var(--primary-color)', fontWeight: '600' }}>Email:</span>
                          <span style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>{profileData.personalEmail}</span>
                        </>
                      )}
                    </div>
                    
                    <div style={{ height: '1px', background: 'rgba(59, 130, 246, 0.3)', margin: '0.5rem 0' }}></div>
                    
                    {/* Theme Toggle Switch inside Profile Menu */}
                    <button 
                      onClick={toggleTheme} 
                      style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0.6rem 0.8rem', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s ease', marginBottom: '0.5rem'
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.background = 'var(--input-bg)'; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Moon size={16} className="text-primary" />
                        <span>Dark Mode</span>
                      </div>
                      <div style={{ 
                        width: '34px', 
                        height: '20px', 
                        borderRadius: '10px', 
                        background: theme === 'dark' ? 'var(--primary-color)' : 'var(--text-secondary)',
                        position: 'relative',
                        transition: 'all 0.2s ease'
                      }}>
                        <div style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          background: '#fff',
                          position: 'absolute',
                          top: '3px',
                          left: theme === 'dark' ? '17px' : '3px',
                          transition: 'all 0.2s ease'
                        }} />
                      </div>
                    </button>

                    <div style={{ height: '1px', background: 'rgba(59, 130, 246, 0.3)', margin: '0.5rem 0' }}></div>

                    <button 
                      onClick={() => { playSFX('click'); handleOpenProfile(); }} 
                      style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '0.6rem', background: 'transparent', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s ease', marginBottom: '0.5rem'
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)'; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <Edit3 size={16} /> Edit Details
                    </button>
                    
                    <button 
                      onClick={() => { playSFX('click'); handleLogout(); }} 
                      style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '0.6rem', background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s ease'
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(244, 63, 94, 0.2)'; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(244, 63, 94, 0.1)'; }}
                    >
                      <LogOut size={16} /> Logout
                    </button>
                  </>
                ) : (
                  <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left', padding: '0 0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--primary-color)', marginBottom: '0.2rem', display: 'block' }}>Phone Number *</label>
                      <input 
                        type="tel" 
                        className="cyber-input" 
                        value={profileForm.phoneNumber}
                        onChange={e => setProfileForm({...profileForm, phoneNumber: e.target.value})}
                        required
                        pattern="^\d{10}$"
                        title="Phone number must be exactly 10 digits"
                        placeholder="9876543210"
                        style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--primary-color)', marginBottom: '0.2rem', display: 'block' }}>Personal Email *</label>
                      <input 
                        type="email" 
                        className="cyber-input" 
                        value={profileForm.personalEmail}
                        onChange={e => setProfileForm({...profileForm, personalEmail: e.target.value})}
                        required
                        pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
                        title="Please enter a valid email address"
                        placeholder="john.doe@gmail.com"
                        style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div className="flex gap-2 justify-between mt-2">
                      <button type="button" onClick={() => setIsEditingInline(false)} style={{ background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '0.5rem', borderRadius: '8px', width: '100%', cursor: 'pointer' }}>Cancel</button>
                      <button type="submit" style={{ background: 'var(--primary-color)', color: '#fff', border: 'none', padding: '0.5rem', borderRadius: '8px', width: '100%', cursor: 'pointer', fontWeight: 'bold' }}>Save</button>
                    </div>
                  </form>
                )}
              </div>
            </>
          )}

        </div>
        
        <NotificationsDropdown />
      </div>
    </nav>
  );
}
