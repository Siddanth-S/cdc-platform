import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Send, ArrowLeft, ShieldAlert, Paperclip, X, MessageSquarePlus, LogOut } from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, collection, addDoc, query, orderBy, getDocs, setDoc, arrayUnion, increment } from 'firebase/firestore';

export default function DriveRoom() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [currentDrive, setCurrentDrive] = useState(null);
  const [showSpocModal, setShowSpocModal] = useState(false);
  const [newSpocEmail, setNewSpocEmail] = useState('');
  
  // Capture the last read time when component mounts, so we know which messages are "new" to glow
  const [lastRead] = useState(() => Number(localStorage.getItem(`read_drive_${id}_${user?.email}`) || 0));

  useEffect(() => {
    if (!user?.email) return;
    // Continuously update the read receipt while actively viewing this drive
    const interval = setInterval(() => {
      localStorage.setItem(`read_drive_${id}_${user.email}`, Date.now());
    }, 1000);
    // Also do it immediately on mount
    localStorage.setItem(`read_drive_${id}_${user.email}`, Date.now());
    return () => clearInterval(interval);
  }, [id, user?.email]);

  const [showSecSpocModal, setShowSecSpocModal] = useState(false);
  const [newSecSpocEmail, setNewSecSpocEmail] = useState('');

  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Sync Current Drive
  useEffect(() => {
    if (!id) return;
    const unsubscribe = onSnapshot(doc(db, 'drives', id), (docSnap) => {
      if (docSnap.exists()) {
        setCurrentDrive({ id: docSnap.id, ...docSnap.data() });
      } else {
        navigate('/dashboard');
      }
    });
    return () => unsubscribe();
  }, [id, navigate]);

  // Sync Messages
  useEffect(() => {
    if (!id) return;
    const messagesRef = collection(db, 'drives', id, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = [];
      snapshot.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [id]);

  const isCoordinator = user?.email === currentDrive?.coordinator;
  const canMessage = user?.role === 'HEAD' || isCoordinator;

  // Enforce Access Control
  useEffect(() => {
    if (!currentDrive || !user) return;
    const savedJoined = localStorage.getItem(`joined_${user.email}`);
    const joinedList = savedJoined ? JSON.parse(savedJoined) : [];
    
    const isHead = user.role === 'HEAD';
    const isPriSpoc = currentDrive.coordinator === user.email;
    const isSecSpoc = currentDrive.secondarySpocs?.includes(user.email);
    const hasJoined = joinedList.includes(id); // id is string
    
    if (!isHead && !isPriSpoc && !isSecSpoc && !hasJoined) {
      navigate('/dashboard');
    }
  }, [currentDrive, user, id, navigate]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedFile) return;
    if (!canMessage) return;

    let fileData = null;
    let fileName = null;

    if (selectedFile) {
      const reader = new FileReader();
      const promise = new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result);
      });
      reader.readAsDataURL(selectedFile);
      fileData = await promise;
      fileName = selectedFile.name;
    }
    
    try {
      await addDoc(collection(db, 'drives', id, 'messages'), {
        sender: user.email,
        role: user.role === 'HEAD' ? 'HEAD' : 'SPOC',
        text: inputText,
        fileData,
        fileName,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error sending message", error);
    }
    
    setInputText('');
    setSelectedFile(null);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      if (e.target.files[0].size > 2 * 1024 * 1024) {
        alert("For this demo, please select a file smaller than 2MB.");
        return;
      }
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleChangeSpoc = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'drives', id), {
        coordinator: newSpocEmail
      });

      // Notify the new SPOC
      await addDoc(collection(db, 'notifications'), {
        recipient: newSpocEmail,
        message: `You have been assigned as the PRIMARY SPOC for ${currentDrive.company}.`,
        type: 'SPOC_ASSIGNED',
        read: false,
        timestamp: new Date().toISOString()
      });

      // Notify the HEAD (activity log)
      await addDoc(collection(db, 'notifications'), {
        recipient: user.email,
        message: `Activity: You assigned ${newSpocEmail} as PRIMARY SPOC for ${currentDrive.company}.`,
        type: 'ACTIVITY',
        read: false,
        timestamp: new Date().toISOString()
      });

    } catch (err) {
      console.error(err);
    }
    setShowSpocModal(false);
  };

  const handleAddSecSpoc = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'drives', id), {
        secondarySpocs: arrayUnion(newSecSpocEmail)
      });

      // Notify the new secondary SPOC
      await addDoc(collection(db, 'notifications'), {
        recipient: newSecSpocEmail,
        message: `You have been assigned as a SECONDARY SPOC for ${currentDrive.company}.`,
        type: 'SPOC_ASSIGNED',
        read: false,
        timestamp: new Date().toISOString()
      });

      // Notify the HEAD (activity log)
      await addDoc(collection(db, 'notifications'), {
        recipient: user.email,
        message: `Activity: You assigned ${newSecSpocEmail} as SECONDARY SPOC for ${currentDrive.company}.`,
        type: 'ACTIVITY',
        read: false,
        timestamp: new Date().toISOString()
      });

    } catch (err) {
      console.error(err);
    }
    setNewSecSpocEmail('');
    setShowSecSpocModal(false);
  };

  const handleInitiateDM = async (targetEmail) => {
    if (targetEmail === user.email) return; 
    
    try {
      // Find existing DM
      const dmsRef = collection(db, 'dms');
      const snapshot = await getDocs(dmsRef);
      let existingDmId = null;
      
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.participants.includes(user.email) && data.participants.includes(targetEmail) && data.participants.length === 2) {
          existingDmId = doc.id;
        }
      });
      
      if (existingDmId) {
        navigate(`/dm/${existingDmId}`);
      } else {
        // Create new DM
        const newDmRef = doc(collection(db, 'dms'));
        await setDoc(newDmRef, {
          participants: [user.email, targetEmail],
          messages: []
        });
        navigate(`/dm/${newDmRef.id}`);
      }
    } catch (error) {
      console.error("Failed to initiate DM", error);
    }
  };

  const confirmLeaveDrive = async () => {
    const savedJoined = localStorage.getItem(`joined_${user.email}`);
    let joinedList = savedJoined ? JSON.parse(savedJoined) : [];
    joinedList = joinedList.filter(j => j !== id);
    localStorage.setItem(`joined_${user.email}`, JSON.stringify(joinedList));
    
    try {
      await updateDoc(doc(db, 'drives', id), {
        joined: increment(-1)
      });
    } catch(err) {
      console.error("Error decrementing joined count", err);
    }
    
    setShowLeaveModal(false);
    navigate('/dashboard');
  };

  if (!currentDrive) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;

  const isHead = user?.role === 'HEAD';
  const isPriSpoc = currentDrive?.coordinator === user?.email;
  const isSecSpoc = currentDrive?.secondarySpocs?.includes(user?.email);
  const canLeave = !isHead && !isPriSpoc && !isSecSpoc;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <div className="glass-panel" style={{ padding: '1rem 1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 style={{ margin: 0 }}>{currentDrive.company}</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Primary SPOC: <span style={{ color: 'var(--primary-color)' }}>{currentDrive.coordinator.split('@')[0]}</span>
            </p>
          </div>
        </div>
        {user?.role === 'HEAD' && (
          <button onClick={() => { setNewSpocEmail(currentDrive.coordinator); setShowSpocModal(true); }} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
            Change Primary SPOC
          </button>
        )}
        {canLeave && (
          <button onClick={() => setShowLeaveModal(true)} className="btn" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', background: 'rgba(244, 63, 94, 0.1)', color: 'var(--warning-color)', border: '1px solid rgba(244, 63, 94, 0.2)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LogOut size={16} /> Leave Drive
          </button>
        )}
      </div>

      {/* Secondary SPOCs Bar */}
      {(currentDrive.secondarySpocs?.length > 0 || user?.role === 'HEAD') && (
        <div style={{ padding: '0.75rem 1.5rem', marginBottom: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Secondary SPOCs:</div>
          {currentDrive.secondarySpocs?.map(spoc => (
            <div key={spoc} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', padding: '0.4rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <span>{spoc.split('@')[0]}</span>
              {spoc !== user?.email && (
                <button onClick={() => handleInitiateDM(spoc)} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Message Secondary SPOC">
                  <MessageSquarePlus size={14} />
                </button>
              )}
            </div>
          ))}
          {user?.role === 'HEAD' && (
            <button onClick={() => setShowSecSpocModal(true)} style={{ background: 'none', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.35rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              + Add
            </button>
          )}
        </div>
      )}

      <div className="glass-panel cyber-glow-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', zIndex: 10 }}>
          {messages.length === 0 && (
             <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2rem' }}>
               No messages in this drive yet.
             </div>
          )}
          {messages.map(msg => {
            const isMe = msg.sender === user?.email;
            const displayRole = msg.role === 'HEAD' ? 'ADMIN' : (msg.role === 'COORDINATOR' ? 'SPOC' : msg.role);
            const msgTime = msg.timestamp && msg.timestamp.toMillis ? msg.timestamp.toMillis() : Date.now();
            const isNew = !isMe && msg.timestamp && msgTime > lastRead;
            
            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', animation: 'fadeIn 0.3s ease-out' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {msg.sender.split('@')[0]} 
                  {isNew && <span style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '0.65rem' }}>NEW</span>}
                  <span style={{ 
                    background: msg.role === 'HEAD' ? 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
                    color: '#fff', 
                    padding: '0.2rem 0.6rem', 
                    borderRadius: '12px', 
                    fontSize: '0.65rem', 
                    fontWeight: '700',
                    letterSpacing: '0.5px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}>
                    {displayRole}
                  </span>
                </div>
                <div className={`drive-msg-bubble ${isNew ? 'new-msg-glow' : ''}`} style={{ 
                  background: isMe ? 'linear-gradient(135deg, var(--primary-color), #2563eb)' : 'rgba(15, 23, 42, 0.7)', 
                  color: isMe ? '#fff' : 'var(--text-primary)',
                  border: isMe ? 'none' : '1px solid rgba(96, 165, 250, 0.15)',
                  padding: '0.85rem 1.15rem', 
                  borderRadius: '16px', 
                  borderBottomRightRadius: isMe ? '4px' : '16px',
                  borderBottomLeftRadius: !isMe ? '4px' : '16px',
                  maxWidth: '85%',
                  wordBreak: 'break-word',
                  boxShadow: isMe ? '0 4px 15px rgba(59, 130, 246, 0.3)' : '0 4px 15px rgba(0,0,0,0.2)',
                  backdropFilter: 'blur(8px)'
                }}>
                  {msg.text && <div style={{ marginBottom: msg.fileName ? '0.5rem' : 0 }}>{msg.text}</div>}
                  {msg.fileName && (
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.5rem 0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                      <Paperclip size={14} />
                      <a href={msg.fileData} download={msg.fileName} style={{ color: 'inherit', textDecoration: 'underline' }}>{msg.fileName}</a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {canMessage ? (
          <div style={{ background: 'rgba(0,0,0,0.15)', borderTop: '1px solid var(--border-color)', padding: '1.25rem' }}>
            {selectedFile && (
              <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--primary-color)', background: 'rgba(59, 130, 246, 0.1)', padding: '0.5rem', borderRadius: '8px', width: 'fit-content' }}>
                <Paperclip size={14} /> {selectedFile.name}
                <button onClick={() => setSelectedFile(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <X size={14} />
                </button>
              </div>
            )}
            <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.75rem' }}>
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileChange} 
              />
              <button type="button" onClick={() => fileInputRef.current.click()} className="btn btn-secondary" style={{ padding: '0.85rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Attach File">
                <Paperclip size={18} />
              </button>
              <input 
                type="text" 
                className="cyber-input" 
                placeholder="Type your official update here..." 
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                style={{ marginBottom: 0, borderRadius: '24px', padding: '0.85rem 1.25rem', flex: 1 }}
              />
              <button type="submit" className="cyber-btn" style={{ padding: '0.85rem 1.25rem', borderRadius: '24px' }}>
                <Send size={18} />
              </button>
            </form>
          </div>
        ) : (
          <div style={{ padding: '1.25rem', borderTop: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.15)', textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <ShieldAlert size={18} className="text-warning-color" /> Only the assigned Primary SPOC and Admins can send messages here.
          </div>
        )}
      </div>
      
      {showSpocModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
            <div className="flex justify-between items-center mb-4">
              <h2 style={{ margin: 0 }}>Change Primary SPOC</h2>
              <button onClick={() => setShowSpocModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
            </div>
            <form onSubmit={handleChangeSpoc}>
              <div className="input-group">
                <label className="input-label">New SPOC Email</label>
                <input required type="email" className="input-field" value={newSpocEmail} onChange={e => setNewSpocEmail(e.target.value)} placeholder="student@nitk.edu.in" />
              </div>
              <div className="flex gap-2 justify-between mt-4">
                <button type="button" className="btn btn-secondary w-full" onClick={() => setShowSpocModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary w-full">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSecSpocModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
            <div className="flex justify-between items-center mb-4">
              <h2 style={{ margin: 0 }}>Add Secondary SPOC</h2>
              <button onClick={() => setShowSecSpocModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
            </div>
            <form onSubmit={handleAddSecSpoc}>
              <div className="input-group">
                <label className="input-label">Secondary SPOC Email</label>
                <input required type="email" className="input-field" value={newSecSpocEmail} onChange={e => setNewSecSpocEmail(e.target.value)} placeholder="student@nitk.edu.in" />
              </div>
              <div className="flex gap-2 justify-between mt-4">
                <button type="button" className="btn btn-secondary w-full" onClick={() => setShowSecSpocModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary w-full">Add SPOC</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLeaveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem 2rem', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <div style={{ background: 'rgba(244, 63, 94, 0.1)', padding: '1rem', borderRadius: '50%', display: 'inline-flex', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
                <LogOut size={40} className="text-warning-color" />
              </div>
            </div>
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>Leave Drive?</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Are you sure you want to leave the <strong>{currentDrive.company}</strong> drive? You will stop receiving official updates and messages.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowLeaveModal(false)} className="btn btn-secondary w-full" style={{ padding: '0.8rem' }}>Cancel</button>
              <button onClick={confirmLeaveDrive} className="btn w-full" style={{ padding: '0.8rem', background: 'var(--warning-color)', color: '#fff' }}>Leave Now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
