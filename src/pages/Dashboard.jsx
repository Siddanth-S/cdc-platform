import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Users, Search, Pin, CheckCircle2 } from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, increment } from 'firebase/firestore';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);

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
  const [newDrive, setNewDrive] = useState({ company: '', role: '', coordinator: '' });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('ALL');

  const [pinnedDrives, setPinnedDrives] = useState(() => {
    const saved = localStorage.getItem(`pinned_${user?.email}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.length > 0) return parsed.map(String);
    }
    return ['1', '3', '6']; 
  });

  const [joinedDrives, setJoinedDrives] = useState(() => {
    const saved = localStorage.getItem(`joined_${user?.email}`);
    if (saved) return JSON.parse(saved).map(String);
    return [];
  });

  const [driveToJoin, setDriveToJoin] = useState(null);

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
      secondarySpocs: [],
      joined: 0
    });
    setShowModal(false);
    setNewDrive({ company: '', role: '', coordinator: '' });
  };

  const isDrivePinned = (drive) => {
    const isSpoc = drive.coordinator === user?.email || drive.secondarySpocs?.includes(user?.email);
    return isSpoc || pinnedDrives.includes(String(drive.id));
  };

  const togglePin = (e, drive) => {
    e.stopPropagation();
    const strId = String(drive.id);
    const isSpoc = drive.coordinator === user?.email || drive.secondarySpocs?.includes(user?.email);
    if (isSpoc) return; // SPOC drives cannot be unpinned
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
    const hasJoined = joinedDrives.includes(strId) || user?.role === 'HEAD';
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
      return true;
    })
    .sort((a, b) => {
      const aPinned = isDrivePinned(a);
      const bPinned = isDrivePinned(b);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}>Syncing with Firebase Cloud...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="cyber-glitch-text" style={{ fontSize: '2.5rem', marginBottom: '0.25rem' }}>Company Drives</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Join drives to receive real-time updates.</p>
        </div>
        {user?.role === 'HEAD' && (
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <Plus size={18} /> Create Drive
          </button>
        )}
      </div>

      <div className="dashboard-controls" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '600px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input 
            type="text" 
            placeholder="Search for companies or roles..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="cyber-input"
          />
        </div>

        <div className="segmented-control" style={{ display: 'flex', gap: '0.25rem' }}>
          <button 
            className={`segmented-btn ${filterMode === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilterMode('ALL')}
          >
            All Drives
          </button>
          <button 
            className={`segmented-btn ${filterMode === 'JOINED' ? 'active' : ''}`}
            onClick={() => setFilterMode('JOINED')}
          >
            My Joined Drives
          </button>
          <button 
            className={`segmented-btn ${filterMode === 'SPOC' ? 'active' : ''}`}
            onClick={() => setFilterMode('SPOC')}
          >
            SPOC Duties
          </button>
        </div>
      </div>

      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {displayDrives.map(drive => {
          const isJoined = joinedDrives.includes(String(drive.id)) || user?.role === 'HEAD';
          const isPinned = isDrivePinned(drive);
          
          return (
            <div 
              key={drive.id} 
              className="cyber-card" 
              style={{ display: 'flex', flexDirection: 'column', position: 'relative', borderLeft: isJoined ? '4px solid var(--success-color)' : (isPinned ? '4px solid var(--warning-color)' : '1px solid rgba(255, 255, 255, 0.05)'), cursor: 'pointer' }}
              onClick={() => handleCardClick(drive)}
            >
              {/* Header */}
              <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Building2 className="text-primary" size={24} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', letterSpacing: '0.5px' }}>{drive.company}</h3>
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
              <div style={{ padding: '0 1.5rem', flex: 1 }}>
                <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid rgba(255, 255, 255, 0.02)', boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.2)' }}>
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
              
              <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(0,0,0,0.1)' }}>
                {!isJoined ? (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setDriveToJoin(drive); }}
                    className="cyber-btn w-full"
                    style={{ padding: '0.85rem', fontSize: '0.95rem' }}
                  >
                    Join Drive
                  </button>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
            <div className="flex justify-between items-center mb-4">
              <h2 style={{ margin: 0 }}>Create New Drive</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="input-group">
                <label className="input-label">Company Name</label>
                <input required className="input-field" value={newDrive.company} onChange={e => setNewDrive({...newDrive, company: e.target.value})} />
              </div>
              <div className="input-group">
                <label className="input-label">Role</label>
                <input required className="input-field" value={newDrive.role} onChange={e => setNewDrive({...newDrive, role: e.target.value})} />
              </div>
              <div className="input-group">
                <label className="input-label">Assign SPOC (Email)</label>
                <input required type="email" className="input-field" value={newDrive.coordinator} onChange={e => setNewDrive({...newDrive, coordinator: e.target.value})} placeholder="student@nitk.edu.in" />
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem 2rem', textAlign: 'center' }}>
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
    </div>
  );
}
