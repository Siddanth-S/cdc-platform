import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Users, Search, Pin, CheckCircle2, Filter, X } from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { parseEmailProfile } from '../utils/profileParser';

const btechBranches = ['CSE', 'IT', 'AI', 'DS', 'ECE', 'EEE', 'MECH', 'CIVIL', 'CHEM', 'META', 'MINING'];
const pgBranches = ['Construction Tech & Management', 'MBA', 'Environmental Eng', 'Geotechnical Eng', 'Transportation Eng', 'Structural Eng', 'Power Electronics', 'Mechanical Design', 'Thermal Eng', 'Manufacturing Eng', 'Mechatronics', 'Water Resources', 'Marine Structures', 'Geoinformatics', 'MCA', 'Chemistry', 'Physics', 'Signal Processing & ML', 'Communication Eng & Networks', 'VLSI Design', 'Information Security', 'Industrial Biotechnology', 'Environmental Science & Tech', 'Materials Eng', 'Nanotechnology'];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', degree: '', branch: '', gradYear: '', phoneNumber: '', personalEmail: '' });

  // Sync User Profile
  useEffect(() => {
    if (!user?.email) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.email), (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data());
        setShowProfileModal(false);
      } else {
        if (user.role === 'HEAD') {
          setUserProfile({ branch: 'ADMIN' });
        } else {
          const parsed = parseEmailProfile(user.email);
          if (parsed) setProfileForm({ name: parsed.name || '', degree: parsed.degree || '', branch: parsed.branch || '', gradYear: parsed.gradYear || '', phoneNumber: '', personalEmail: '' });
          setShowProfileModal(true);
        }
      }
    }, (err) => {
      console.error("Error syncing profile", err);
    });
    return () => unsubscribe();
  }, [user]);

  // Sync with Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'drives'), (snapshot) => {
      const drivesData = [];
      snapshot.forEach((doc) => {
        drivesData.push({ ...doc.data(), id: String(doc.id) }); // ensure id is string
      });
      setDrives(drivesData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const [showModal, setShowModal] = useState(false);
  const [newDrive, setNewDrive] = useState({ company: '', role: '', coordinator: '', secondarySpoc1: '', secondarySpoc2: '', eligibleBranches: [...btechBranches, ...pgBranches] });
  
  const triggerToast = (msg) => {
    toast.success(msg, {
      style: {
        background: 'rgba(15, 23, 42, 0.95)',
        color: '#fff',
        border: '1px solid var(--success-color)',
        backdropFilter: 'blur(10px)',
      },
    });
  };
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('ALL');
  const [showFilterModal, setShowFilterModal] = useState(false);

  const [pinnedDrives, setPinnedDrives] = useState(() => {
    const saved = localStorage.getItem(`pinned_${user?.email}`);
    if (saved === null) return ['1', '3', '6'];
    try {
      return JSON.parse(saved).map(String);
    } catch {
      return ['1', '3', '6'];
    }
  });

  const [joinedDrives, setJoinedDrives] = useState(() => {
    const saved = localStorage.getItem(`joined_${user?.email}`);
    if (saved) return JSON.parse(saved).map(String);
    return [];
  });

  const [driveToJoin, setDriveToJoin] = useState(null);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileForm.name || !profileForm.branch || !profileForm.degree || !profileForm.gradYear) {
      toast.error('Please fill in all fields before continuing.');
      return;
    }
    try {
      await setDoc(doc(db, 'users', user.email), { 
        name: profileForm.name,
        degree: profileForm.degree,
        branch: profileForm.branch,
        gradYear: profileForm.gradYear,
        phoneNumber: profileForm.phoneNumber,
        personalEmail: profileForm.personalEmail
      });
      setShowProfileModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user?.email) {
      localStorage.setItem(`pinned_${user.email}`, JSON.stringify(pinnedDrives));
      localStorage.setItem(`joined_${user.email}`, JSON.stringify(joinedDrives));
    }
  }, [pinnedDrives, joinedDrives, user]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const newId = String(Date.now());
    await setDoc(doc(db, 'drives', newId), {
      id: newId,
      company: newDrive.company,
      role: newDrive.role,
      coordinator: newDrive.coordinator,
      secondarySpocs: [newDrive.secondarySpoc1, newDrive.secondarySpoc2],
      joined: 0,
      eligibleBranches: newDrive.eligibleBranches,
      status: 'Active'
    });
    setShowModal(false);
    triggerToast(`Drive for ${newDrive.company} created successfully!`);
    setNewDrive({ company: '', role: '', coordinator: '', secondarySpoc1: '', secondarySpoc2: '', eligibleBranches: [...btechBranches, ...pgBranches] });
  };

  const isDrivePinned = (drive) => {
    return pinnedDrives.includes(String(drive.id));
  };

  const togglePin = (e, drive) => {
    e.stopPropagation();
    const strId = String(drive.id);
    if (pinnedDrives.includes(strId)) {
      setPinnedDrives(pinnedDrives.filter(id => id !== strId));
    } else {
      setPinnedDrives([...pinnedDrives, strId]);
    }
  };

  const handleJoinModalConfirm = async () => {
    if (!driveToJoin) return;
    const strId = String(driveToJoin.id);
    if (!joinedDrives.includes(strId)) {
      setJoinedDrives([...joinedDrives, strId]);
      
      // Update Firebase
      try {
        await updateDoc(doc(db, 'drives', strId), {
          joined: increment(1)
        });
      } catch (err) {
        console.error("Failed to increment joined count", err);
      }
    }
    setDriveToJoin(null);
    navigate(`/drive/${strId}`);
  };

  const handleCardClick = (drive) => {
    const strId = String(drive.id);
    const isSpoc = drive.coordinator === user?.email || drive.secondarySpocs?.includes(user?.email);
    const hasJoined = joinedDrives.includes(strId) || user?.role === 'HEAD' || isSpoc;
    if (hasJoined) {
      navigate(`/drive/${strId}`);
    } else {
      setDriveToJoin(drive);
    }
  };

  const displayDrives = drives
    .filter(d => {
      const strId = String(d.id);
      const matchSearch = d.company.toLowerCase().includes(searchQuery.toLowerCase()) || d.role.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;
      
      if (filterMode === 'JOINED' && !joinedDrives.includes(strId)) return false;
      const isSpoc = d.coordinator === user?.email || d.secondarySpocs?.includes(user?.email);
      if (filterMode === 'SPOC' && !isSpoc) return false;
      if (filterMode === 'ACTIVE' && d.status === 'Closed') return false;
      if (filterMode === 'CLOSED' && d.status !== 'Closed') return false;
      if (filterMode === 'ELIGIBLE' || filterMode === 'NOT_ELIGIBLE') {
        const branch = userProfile?.branch;
        const eligible = user?.role === 'HEAD' || !d.eligibleBranches || (branch && d.eligibleBranches.includes(branch)) || isSpoc;
        if (filterMode === 'ELIGIBLE' && !eligible) return false;
        if (filterMode === 'NOT_ELIGIBLE' && eligible) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aIsSpoc = a.coordinator === user?.email || a.secondarySpocs?.includes(user?.email);
      const bIsSpoc = b.coordinator === user?.email || b.secondarySpocs?.includes(user?.email);
      const aPinned = isDrivePinned(a) || aIsSpoc;
      const bPinned = isDrivePinned(b) || bIsSpoc;
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return Number(a.id) - Number(b.id);
    });

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}>Syncing with Firebase Cloud...</div>;
  }

  return (
    <div className="page-container" style={{ padding: '2rem' }}>

      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="cyber-glitch-text" style={{ fontSize: '2.5rem', marginBottom: '0.25rem' }}>Company Drives</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Join drives to receive real-time updates.</p>
        </div>
        {user?.role === 'HEAD' && (
          <button onClick={() => setShowModal(true)} className="btn btn-create-glow" style={{ padding: '0.75rem 1.5rem', fontSize: '1rem', fontWeight: 'bold' }}>
            <Plus size={18} /> Create Drive
          </button>
        )}
      </div>

      <div className="dashboard-controls" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, maxWidth: '600px', display: 'flex', gap: '0.5rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              placeholder="Search for companies or roles..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="cyber-input"
            />
          </div>
          <div>
            <button 
              onClick={() => setShowFilterModal(true)} 
              className="cyber-input" 
              style={{ 
                padding: '0 1rem', 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                cursor: 'pointer', 
                background: filterMode !== 'ALL' ? 'rgba(59, 130, 246, 0.15)' : 'transparent', 
                color: filterMode !== 'ALL' ? 'var(--primary-color)' : 'var(--text-primary)', 
                border: filterMode !== 'ALL' ? '1px solid var(--primary-color)' : '1px solid var(--border-color)', 
                boxShadow: filterMode !== 'ALL' ? '0 0 15px rgba(59, 130, 246, 0.3)' : 'none', 
                transition: 'all 0.3s ease' 
              }}
            >
              <Filter size={18} /> Filter{filterMode !== 'ALL' ? `: ${filterMode.charAt(0) + filterMode.slice(1).toLowerCase().replace('_', ' ')}` : ''}
            </button>
          </div>
        </div>
      </div>

      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {displayDrives.map(drive => {
          const isSpoc = drive.coordinator === user?.email || drive.secondarySpocs?.includes(user?.email);
          const isJoined = joinedDrives.includes(String(drive.id)) || user?.role === 'HEAD' || isSpoc;
          const isPinned = isDrivePinned(drive) || isSpoc;
          const isEligible = user?.role === 'HEAD' || !drive.eligibleBranches || (userProfile?.branch && drive.eligibleBranches.includes(userProfile.branch)) || isSpoc;
          
          return (
            <div 
              key={drive.id} 
              className="cyber-card" 
              style={{ display: 'flex', flexDirection: 'column', position: 'relative', borderLeft: isJoined ? '4px solid var(--success-color)' : (isPinned ? '4px solid var(--warning-color)' : '1px solid rgba(255, 255, 255, 0.05)'), cursor: isEligible ? 'pointer' : 'not-allowed', opacity: isEligible ? (drive.status === 'Closed' ? 0.65 : 1) : 0.4, filter: drive.status === 'Closed' ? 'grayscale(50%)' : 'none', transition: 'all 0.3s ease' }}
              onClick={() => isEligible && handleCardClick(drive)}
            >
              {/* Header */}
              <div className="cyber-card-header" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Building2 className="text-primary" size={24} />
                  <div>
                    <h3 style={{ 
                      margin: 0, 
                      fontSize: '1.25rem', 
                      letterSpacing: '0.5px', 
                      color: 'var(--text-primary)',
                      fontWeight: '700'
                    }}>
                      {drive.company}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                      <span style={{ 
                        fontSize: '0.65rem', 
                        background: drive.status === 'Closed' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)', 
                        color: drive.status === 'Closed' ? '#f87171' : '#4ade80', 
                        border: `1px solid ${drive.status === 'Closed' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(34, 197, 94, 0.5)'}`,
                        padding: '0.15rem 0.5rem', 
                        borderRadius: '12px', 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.5px',
                        boxShadow: drive.status === 'Closed' ? '0 0 8px rgba(239, 68, 68, 0.3)' : '0 0 8px rgba(34, 197, 94, 0.3)'
                      }}>
                        {drive.status === 'Closed' ? 'Closed' : 'Active'}
                      </span>
                      {isSpoc && (
                        <span style={{ 
                          fontSize: '0.65rem', 
                          background: 'rgba(168, 85, 247, 0.2)', 
                          color: '#c084fc', 
                          border: '1px solid rgba(168, 85, 247, 0.5)',
                          padding: '0.15rem 0.5rem', 
                          borderRadius: '12px', 
                          textTransform: 'uppercase', 
                          letterSpacing: '0.5px',
                          boxShadow: '0 0 8px rgba(168, 85, 247, 0.3)'
                        }}>
                          SPOC: You
                        </span>
                      )}
                      {userProfile?.branch !== 'ADMIN' && (
                        <span style={{ 
                          fontSize: '0.65rem', 
                          background: isEligible ? 'rgba(56, 189, 248, 0.15)' : 'rgba(244, 63, 94, 0.15)', 
                          color: isEligible ? '#38bdf8' : '#f43f5e', 
                          border: `1px solid ${isEligible ? 'rgba(56, 189, 248, 0.4)' : 'rgba(244, 63, 94, 0.4)'}`,
                          padding: '0.15rem 0.5rem', 
                          borderRadius: '12px', 
                          textTransform: 'uppercase', 
                          letterSpacing: '0.5px',
                          boxShadow: isEligible ? '0 0 8px rgba(56, 189, 248, 0.3)' : '0 0 8px rgba(244, 63, 94, 0.3)'
                        }}>
                          {isEligible ? 'Eligible' : 'Not Eligible'}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{drive.role}</div>
                  </div>
                </div>
                <button 
                  onClick={(e) => togglePin(e, drive)} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center', transition: 'all 0.3s ease', zIndex: 2 }}
                  title={isPinned ? "Unpin drive" : "Pin drive"}
                >
                  <Pin size={18} fill={isPinned ? 'var(--warning-color)' : 'none'} color={isPinned ? 'var(--warning-color)' : 'var(--text-secondary)'} style={{ filter: isPinned ? 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.6))' : 'none' }} />
                </button>
              </div>

              {/* Data Rows */}
              <div className="cyber-card-body" style={{ padding: '0 1.5rem', flex: 1 }}>
                <div style={{ background: 'var(--input-bg)', padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid var(--border-color)', boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.85rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>SPOC:</span>
                    <span className="cyber-badge">{drive.coordinator.split('@')[0]}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
                    <span className="flex items-center gap-1 text-primary"><Users size={14} /> {drive.joined || 0} Joined</span>
                  </div>
                </div>
              </div>
              
              <div className="cyber-card-footer" style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', background: 'var(--input-bg)' }}>
                {!isJoined ? (
                  isEligible ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setDriveToJoin(drive); }}
                      className="cyber-btn w-full"
                      style={{ padding: '0.85rem', fontSize: '0.95rem' }}
                    >
                      Join Drive
                    </button>
                  ) : (
                    <button 
                      disabled
                      className="cyber-btn w-full"
                      style={{ padding: '0.85rem', fontSize: '0.95rem', background: 'var(--input-bg)', color: 'var(--text-secondary)', cursor: 'not-allowed', border: '1px solid var(--border-color)' }}
                    >
                      Not Eligible: Branch Restriction
                    </button>
                  )
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success-color)', fontWeight: '500' }}>
                    <CheckCircle2 size={16} className="joined-icon" /> Joined
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {displayDrives.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            No companies found.
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', overflowY: 'auto', padding: '1rem', zIndex: 1000 }}>
          <div className="glass-card cyber-modal-container animate-fade-in" style={{ margin: 'auto', width: '100%', maxWidth: '500px', padding: '1.5rem' }}>
            <div className="flex justify-between items-center mb-4">
              <h2 style={{ margin: 0 }}>Create New Drive</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="input-group">
                <label className="input-label">Company Name *</label>
                <input required className="input-field" value={newDrive.company} onChange={e => setNewDrive({...newDrive, company: e.target.value})} />
              </div>
              <div className="input-group">
                <label className="input-label">Role *</label>
                <input required className="input-field" value={newDrive.role} onChange={e => setNewDrive({...newDrive, role: e.target.value})} />
              </div>
              <div className="input-group">
                <label className="input-label" style={{ marginBottom: '0.5rem' }}>Eligible Branches *</label>
                <div style={{ maxHeight: '180px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--primary-color)', fontSize: '0.85rem' }}>B.Tech Branches</div>
                    <button type="button" onClick={() => {
                      const hasAllBtech = btechBranches.every(b => newDrive.eligibleBranches.includes(b));
                      if (hasAllBtech) {
                        setNewDrive({...newDrive, eligibleBranches: newDrive.eligibleBranches.filter(b => !btechBranches.includes(b))});
                      } else {
                        const newArr = [...new Set([...newDrive.eligibleBranches, ...btechBranches])];
                        setNewDrive({...newDrive, eligibleBranches: newArr});
                      }
                    }} style={{ fontSize: '0.7rem', background: 'none', border: '1px solid var(--primary-color)', color: 'var(--primary-color)', borderRadius: '4px', cursor: 'pointer', padding: '0.1rem 0.4rem' }}>
                      Toggle B.Tech
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                    {btechBranches.map(b => (
                      <label key={b} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={newDrive.eligibleBranches.includes(b)} onChange={(e) => {
                          if (e.target.checked) setNewDrive({...newDrive, eligibleBranches: [...newDrive.eligibleBranches, b]});
                          else setNewDrive({...newDrive, eligibleBranches: newDrive.eligibleBranches.filter(eb => eb !== b)});
                        }} style={{ accentColor: 'var(--primary-color)', cursor: 'pointer' }} />
                        {b}
                      </label>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--primary-color)', fontSize: '0.85rem' }}>PG Branches</div>
                    <button type="button" onClick={() => {
                      const hasAllPg = pgBranches.every(b => newDrive.eligibleBranches.includes(b));
                      if (hasAllPg) {
                        setNewDrive({...newDrive, eligibleBranches: newDrive.eligibleBranches.filter(b => !pgBranches.includes(b))});
                      } else {
                        const newArr = [...new Set([...newDrive.eligibleBranches, ...pgBranches])];
                        setNewDrive({...newDrive, eligibleBranches: newArr});
                      }
                    }} style={{ fontSize: '0.7rem', background: 'none', border: '1px solid var(--primary-color)', color: 'var(--primary-color)', borderRadius: '4px', cursor: 'pointer', padding: '0.1rem 0.4rem' }}>
                      Toggle PG
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {pgBranches.map(b => (
                      <label key={b} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={newDrive.eligibleBranches.includes(b)} onChange={(e) => {
                          if (e.target.checked) setNewDrive({...newDrive, eligibleBranches: [...newDrive.eligibleBranches, b]});
                          else setNewDrive({...newDrive, eligibleBranches: newDrive.eligibleBranches.filter(eb => eb !== b)});
                        }} style={{ accentColor: 'var(--primary-color)', cursor: 'pointer' }} />
                        {b.length > 25 ? b.substring(0, 22) + '...' : b}
                      </label>
                    ))}
                  </div>
                  
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Primary SPOC (Email) *</label>
                <input required type="email" className="input-field" value={newDrive.coordinator} onChange={e => setNewDrive({...newDrive, coordinator: e.target.value})} placeholder="student@nitk.edu.in" />
              </div>
              <div className="mobile-stack-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Secondary SPOC 1 (Email) *</label>
                  <input required type="email" className="input-field" value={newDrive.secondarySpoc1} onChange={e => setNewDrive({...newDrive, secondarySpoc1: e.target.value})} placeholder="spoc1@nitk.edu.in" />
                </div>
                <div className="input-group">
                  <label className="input-label">Secondary SPOC 2 (Email) *</label>
                  <input required type="email" className="input-field" value={newDrive.secondarySpoc2} onChange={e => setNewDrive({...newDrive, secondarySpoc2: e.target.value})} placeholder="spoc2@nitk.edu.in" />
                </div>
              </div>
              <div className="flex gap-2 justify-between mt-4">
                <button type="button" className="btn btn-secondary w-full" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary w-full">Create Drive</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {driveToJoin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', overflowY: 'auto', padding: '1rem', zIndex: 1000 }}>
          <div className="glass-card cyber-modal-container animate-fade-in" style={{ margin: 'auto', width: '100%', maxWidth: '400px', padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '1rem', borderRadius: '50%', display: 'inline-flex', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <Building2 size={40} className="text-primary" />
              </div>
            </div>
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>Join {driveToJoin.company}?</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem', lineHeight: '1.5' }}>
              You must join the <strong>{driveToJoin.company}</strong> drive to access the live chats and official updates for the {driveToJoin.role} position.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDriveToJoin(null)} className="btn btn-secondary w-full" style={{ padding: '0.8rem' }}>Cancel</button>
              <button onClick={handleJoinModalConfirm} className="btn btn-primary w-full" style={{ padding: '0.8rem' }}>Join Now</button>
            </div>
          </div>
        </div>
      )}

      {showProfileModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', overflowY: 'auto', padding: '1rem', zIndex: 1000 }}>
          <div className="glass-card cyber-modal-container animate-fade-in" style={{ margin: 'auto', width: '100%', maxWidth: '450px', padding: '1.5rem', textAlign: 'center', border: '1px solid var(--primary-color)', boxShadow: '0 0 30px rgba(59, 130, 246, 0.2)' }}>
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.6rem', color: '#fff', textShadow: '0 0 10px rgba(255,255,255,0.3)' }}>Complete Your Profile</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem' }}>
              Please verify your details below (auto-filled where possible) and provide your contact information.
            </p>
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>

              <div className="mobile-stack-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>Name *</label>
                  <input
                    type="text"
                    className="cyber-input"
                    value={profileForm.name}
                    onChange={e => setProfileForm({...profileForm, name: e.target.value})}
                    required
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>Expected Graduation *</label>
                  <input
                    type="text"
                    className="cyber-input"
                    value={profileForm.gradYear}
                    onChange={e => setProfileForm({...profileForm, gradYear: e.target.value})}
                    required
                    placeholder="2027"
                  />
                </div>
              </div>

              <div className="mobile-stack-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>Degree *</label>
                  <input
                    type="text"
                    className="cyber-input"
                    value={profileForm.degree}
                    onChange={e => setProfileForm({...profileForm, degree: e.target.value})}
                    required
                    placeholder="B.Tech"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>Branch *</label>
                  <select
                    className="cyber-input"
                    value={profileForm.branch}
                    onChange={e => setProfileForm({...profileForm, branch: e.target.value})}
                    required
                  >
                    <option value="" disabled>Select branch</option>
                    <optgroup label="B.Tech">
                      {btechBranches.map(b => <option key={b} value={b}>{b}</option>)}
                    </optgroup>
                    <optgroup label="PG">
                      {pgBranches.map(b => <option key={b} value={b}>{b}</option>)}
                    </optgroup>
                  </select>
                </div>
              </div>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '0.5rem 0' }}></div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--primary-color)', marginBottom: '0.25rem', display: 'block' }}>Phone Number *</label>
                <input 
                  type="tel" 
                  className="cyber-input" 
                  value={profileForm.phoneNumber}
                  onChange={e => setProfileForm({...profileForm, phoneNumber: e.target.value})}
                  required
                  placeholder="+91 9876543210"
                  style={{ borderColor: 'var(--primary-color)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--primary-color)', marginBottom: '0.25rem', display: 'block' }}>Personal Email ID *</label>
                <input 
                  type="email" 
                  className="cyber-input" 
                  value={profileForm.personalEmail}
                  onChange={e => setProfileForm({...profileForm, personalEmail: e.target.value})}
                  required
                  placeholder="john.doe@gmail.com"
                  style={{ borderColor: 'var(--primary-color)' }}
                />
              </div>

              <button type="submit" className="btn btn-primary w-full" style={{ padding: '0.8rem', marginTop: '0.5rem', boxShadow: '0 0 15px rgba(59, 130, 246, 0.4)' }}>Save & Continue</button>
              
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '1rem', lineHeight: '1.4' }}>
                Couldn't auto-detect some of your details? Just fill them in above.
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filter Modal Popup */}
      {showFilterModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1000 }}>
          <div style={{ position: 'fixed', inset: 0 }} onClick={() => setShowFilterModal(false)}></div>
          <div className="cyber-modal-container animate-fade-in" style={{ width: '400px', maxWidth: '100%', padding: '1.5rem', position: 'relative', zIndex: 1001 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Filter size={20} className="text-primary" /> Filter Drives
              </h3>
              <button 
                onClick={() => setShowFilterModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { label: 'All Drives', mode: 'ALL', description: 'Show all available drives' },
                { label: 'Active', mode: 'ACTIVE', description: 'Only show currently active drives' },
                { label: 'Closed', mode: 'CLOSED', description: 'Only show closed/ended drives' },
                { label: 'Eligible', mode: 'ELIGIBLE', description: 'Show drives you are eligible for' },
                { label: 'Not Eligible', mode: 'NOT_ELIGIBLE', description: 'Show drives you are not eligible for' },
                { label: 'Joined', mode: 'JOINED', description: 'Show drives you have joined' },
                { label: 'SPOC / Coordinator', mode: 'SPOC', description: 'Show drives where you are a SPOC' }
              ].map(opt => {
                const isActive = filterMode === opt.mode;
                return (
                  <button
                    key={opt.mode}
                    onClick={() => {
                      setFilterMode(opt.mode);
                      setShowFilterModal(false);
                    }}
                    style={{
                      background: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                      border: isActive ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                      borderRadius: '10px',
                      padding: '0.75rem 1rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      width: '100%',
                      color: 'inherit'
                    }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'var(--input-bg)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '600', color: isActive ? 'var(--primary-color)' : 'var(--text-primary)', fontSize: '0.9rem' }}>{opt.label}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{opt.description}</div>
                    </div>
                    {isActive && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary-color)' }} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
