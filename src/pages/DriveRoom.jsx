import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Send, ArrowLeft, ShieldAlert, Paperclip, X, MessageSquarePlus, LogOut, Plus, Edit3, Settings, Users, UserCog, Power } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, doc, getDocs, setDoc, updateDoc, increment, arrayUnion, arrayRemove, deleteField } from 'firebase/firestore';
import { toast } from 'react-hot-toast';

const btechBranches = ['CSE', 'IT', 'AI', 'DS', 'ECE', 'EEE', 'MECH', 'CIVIL', 'CHEM', 'META', 'MINING'];
const pgBranches = ['Construction Tech & Management', 'MBA', 'Environmental Eng', 'Geotechnical Eng', 'Transportation Eng', 'Structural Eng', 'Power Electronics', 'Mechanical Design', 'Thermal Eng', 'Manufacturing Eng', 'Mechatronics', 'Water Resources', 'Marine Structures', 'Geoinformatics', 'MCA', 'Chemistry', 'Physics', 'Signal Processing & ML', 'Communication Eng & Networks', 'VLSI Design', 'Information Security', 'Industrial Biotechnology', 'Environmental Science & Tech', 'Materials Eng', 'Nanotechnology'];

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
  const [editingSpocIndex, setEditingSpocIndex] = useState(0);

  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const [showEditBranchesModal, setShowEditBranchesModal] = useState(false);
  const [editBranches, setEditBranches] = useState([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
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


  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  
  const [hoveredMsgId, setHoveredMsgId] = useState(null);
  const [replyToMsg, setReplyToMsg] = useState(null);
  const [showReactionPickerId, setShowReactionPickerId] = useState(null);
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
        role: user.role === 'HEAD' ? 'HEAD' : (currentDrive.coordinator === user.email ? 'SPOC' : 'SEC_SPOC'),
        text: inputText,
        fileData,
        fileName,
        timestamp: new Date().toISOString(),
        replyTo: replyToMsg ? { id: replyToMsg.id, sender: replyToMsg.sender, text: replyToMsg.text } : null
      });
    } catch (error) {
      console.error("Error sending message", error);
    }
    
    setInputText('');
    setSelectedFile(null);
    setReplyToMsg(null);
  };

  const handleReaction = async (msgId, emoji, currentReactions) => {
    try {
      const safeEmail = user.email.replace(/\./g, '_');
      const hasReactedWithThisEmoji = currentReactions && currentReactions[safeEmail] === emoji;
      
      await updateDoc(doc(db, 'drives', id, 'messages', msgId), {
        [`reactions.${safeEmail}`]: hasReactedWithThisEmoji ? deleteField() : emoji
      });
      setShowReactionPickerId(null);
    } catch (err) {
      console.error("Reaction error", err);
    }
  };

  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      updateDoc(doc(db, 'drives', id), { typing: arrayUnion(user.email) });
    }
    
    if (window.typingTimeout) clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => {
      setIsTyping(false);
      updateDoc(doc(db, 'drives', id), { typing: arrayRemove(user.email) });
    }, 3000);
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

      await addDoc(collection(db, 'notifications'), {
        recipient: newSpocEmail,
        message: `You have been assigned as the new PRIMARY SPOC for ${currentDrive.company}.`,
        type: 'SPOC_ASSIGNED',
        read: false,
        timestamp: new Date().toISOString()
      });

      await addDoc(collection(db, 'notifications'), {
        recipient: user.email,
        message: `Activity: You changed the Primary SPOC to ${newSpocEmail} for ${currentDrive.company}.`,
        type: 'ACTIVITY',
        read: false,
        timestamp: new Date().toISOString()
      });

      triggerToast("Primary SPOC changed successfully!");
    } catch (err) {
      console.error(err);
    }
    setNewSpocEmail('');
    setShowSpocModal(false);
  };

  const handleEditBranchesSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'drives', id), {
        eligibleBranches: editBranches
      });
      triggerToast("Eligibility branches updated successfully!");
      setShowEditBranchesModal(false);
    } catch(err) {
      console.error(err);
    }
  };

  const handleChangeSecSpoc = async (e) => {
    e.preventDefault();
    try {
      const updatedSpocs = [...(currentDrive.secondarySpocs || ['', ''])];
      updatedSpocs[editingSpocIndex] = newSecSpocEmail;
      
      await updateDoc(doc(db, 'drives', id), {
        secondarySpocs: updatedSpocs
      });

      // Notify the new secondary SPOC
      await addDoc(collection(db, 'notifications'), {
        recipient: newSecSpocEmail,
        message: `You have been assigned as Secondary SPOC ${editingSpocIndex + 1} for ${currentDrive.company}.`,
        type: 'SPOC_ASSIGNED',
        read: false,
        timestamp: new Date().toISOString()
      });

      // Notify the HEAD (activity log)
      await addDoc(collection(db, 'notifications'), {
        recipient: user.email,
        message: `Activity: You changed Secondary SPOC ${editingSpocIndex + 1} to ${newSecSpocEmail} for ${currentDrive.company}.`,
        type: 'ACTIVITY',
        read: false,
        timestamp: new Date().toISOString()
      });

      triggerToast(`Secondary SPOC ${editingSpocIndex + 1} updated!`);
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
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {(isHead || isPriSpoc) && (
            <button 
              onClick={() => setShowSettingsModal(true)}
              className="btn-glass primary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem' }}
            >
              <Settings size={18} /> Manage Drive
            </button>
          )}
          {canLeave && (
            <button onClick={() => setShowLeaveModal(true)} className="btn-glass danger">
              <LogOut size={16} /> Leave Drive
            </button>
          )}
        </div>
      </div>

      {/* Secondary SPOCs Bar */}
      {(currentDrive.secondarySpocs?.length > 0 || user?.role === 'HEAD') && (
        <div style={{ padding: '0.75rem 1.5rem', marginBottom: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Secondary SPOCs:</div>
          {currentDrive.secondarySpocs?.map((spoc, index) => (
            <div key={`${spoc}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', padding: '0.4rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <span>{spoc ? spoc.split('@')[0] : `Pending SPOC ${index + 1}`}</span>
              
              {spoc && spoc !== user?.email && (
                <button onClick={() => handleInitiateDM(spoc)} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Message Secondary SPOC">
                  <MessageSquarePlus size={14} />
                </button>
              )}
            </div>
          ))}
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
            const displayRole = msg.role === 'HEAD' ? 'ADMIN' : (msg.role === 'SPOC' || msg.role === 'COORDINATOR' ? 'SPOC' : 'SEC SPOC');
            const msgTime = msg.timestamp && msg.timestamp.toMillis ? msg.timestamp.toMillis() : Date.now();
            const isNew = !isMe && msg.timestamp && msgTime > lastRead;
            
            const formatName = (email) => {
              if (!email) return '';
              const namePart = email.split('@')[0].split('.')[0].replace(/[0-9]/g, '');
              return namePart.charAt(0).toUpperCase() + namePart.slice(1);
            };
            
            return (
              <div 
                key={msg.id} 
                className={`drive-msg-container ${msg.id === id ? 'new-msg-glow' : ''}`}
                onMouseEnter={() => { if (window.innerWidth > 768) setHoveredMsgId(msg.id); }}
                onMouseLeave={() => { 
                  if (window.innerWidth > 768) {
                    setHoveredMsgId(null); 
                    setShowReactionPickerId(null); 
                  }
                }}
                onClick={(e) => {
                  if (window.innerWidth <= 768 && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A') {
                    setHoveredMsgId(hoveredMsgId === msg.id ? null : msg.id);
                  }
                }}
                style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', gap: '0.75rem', marginBottom: '1.5rem', position: 'relative', alignItems: 'flex-start' }}
              >
                <div className="drive-msg-bubble" style={{ 
                  background: isMe ? 'linear-gradient(135deg, var(--primary-color), #2563eb)' : 'rgba(15, 23, 42, 0.7)', 
                  color: isMe ? '#fff' : 'var(--text-primary)',
                  border: isMe ? 'none' : '1px solid rgba(96, 165, 250, 0.15)',
                  padding: '0.5rem 0.75rem', 
                  borderRadius: '16px', 
                  borderBottomRightRadius: isMe ? '4px' : '16px',
                  borderBottomLeftRadius: !isMe ? '4px' : '16px',
                  maxWidth: '75%',
                  wordBreak: 'break-word',
                  boxShadow: isMe ? '0 4px 15px rgba(59, 130, 246, 0.3)' : '0 4px 15px rgba(0,0,0,0.2)',
                  backdropFilter: 'blur(8px)',
                  position: 'relative',
                  marginTop: '0.2rem'
                }}>
                  {/* Internal Sender Tag */}
                  {(msg.role === 'HEAD' || msg.role === 'SPOC' || msg.role === 'SEC_SPOC' || msg.role === 'COORDINATOR' || (!isMe && msg.role !== 'HEAD' && msg.role !== 'SPOC' && msg.role !== 'SEC_SPOC' && msg.role !== 'COORDINATOR')) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem', opacity: 0.9 }}>
                      {(!isMe && msg.role !== 'HEAD' && msg.role !== 'SPOC' && msg.role !== 'SEC_SPOC' && msg.role !== 'COORDINATOR') && (
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#38bdf8' }}>
                          {formatName(msg.sender)}
                        </span>
                      )}
                      {(msg.role === 'HEAD' || msg.role === 'SPOC' || msg.role === 'SEC_SPOC' || msg.role === 'COORDINATOR') && (
                        <span style={{ 
                          background: 'rgba(56, 189, 248, 0.15)', 
                          color: '#38bdf8', 
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          padding: '0.1rem 0.3rem', 
                          borderRadius: '6px', 
                          fontSize: '0.55rem', 
                          fontWeight: '800',
                          letterSpacing: '0.5px'
                        }}>
                          {displayRole}
                        </span>
                      )}
                    </div>
                  )}
                  {msg.replyTo && (
                    <div style={{ background: 'rgba(0,0,0,0.2)', borderLeft: '3px solid rgba(255,255,255,0.4)', padding: '0.3rem 0.5rem', borderRadius: '4px', marginBottom: '0.3rem', fontSize: '0.75rem', opacity: 0.8 }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '0.1rem' }}>{formatName(msg.replyTo.sender)}</div>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.replyTo.text}</div>
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '0.9rem', lineHeight: '1.3' }}>
                      {msg.text}
                      {msg.fileName && (
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.3rem 0.5rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', marginTop: msg.text ? '0.3rem' : '0' }}>
                          <Paperclip size={12} />
                          <a href={msg.fileData} download={msg.fileName} style={{ color: 'inherit', textDecoration: 'underline' }}>{msg.fileName}</a>
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: '0.6rem', opacity: 0.7, textAlign: 'right', whiteSpace: 'nowrap', alignSelf: 'flex-end', marginBottom: '-2px' }}>
                      {msg.timestamp ? new Date(msg.timestamp.toMillis ? msg.timestamp.toMillis() : msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  </div>

                  {hoveredMsgId === msg.id && (
                    <div className={`msg-action-toolbar ${isMe ? 'is-me' : 'not-me'}`}>
                      <button onClick={() => setReplyToMsg(msg)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#38bdf8', padding: '0 0.3rem', fontWeight: 'bold' }}>Reply</button>
                      <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.2)', margin: '0 0.2rem' }} />
                      {['👍', '❤️', '😂'].map(emoji => (
                        <button key={emoji} onClick={() => handleReaction(msg.id, emoji, msg.reactions)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '0 0.2rem', transition: 'transform 0.1s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>{emoji}</button>
                      ))}
                      <div style={{ position: 'relative' }}>
                        <button onClick={() => setShowReactionPickerId(showReactionPickerId === msg.id ? null : msg.id)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', fontSize: '0.9rem', color: '#fff', padding: '0.2rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '0.2rem' }}><Plus size={14} /></button>
                        {showReactionPickerId === msg.id && (
                          <div className="reaction-picker">
                            {['🎉', '🔥', '👀', '💯', '🙏'].map(emoji => (
                              <button key={emoji} onClick={() => handleReaction(msg.id, emoji, msg.reactions)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0.2rem', transition: 'transform 0.1s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.3)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>{emoji}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem', padding: '0 0.5rem', alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
                    {Object.entries(
                      Object.values(msg.reactions).reduce((acc, emoji) => {
                        acc[emoji] = (acc[emoji] || 0) + 1;
                        return acc;
                      }, {})
                    ).map(([emoji, count]) => (
                      <span key={emoji} style={{ background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.1rem 0.4rem', fontSize: '0.75rem' }}>
                        {emoji} {count}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {canMessage ? (
          <div className="glass-panel" style={{ padding: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(15, 23, 42, 0.6)' }}>
            {currentDrive?.typing?.filter(e => e !== user.email).length > 0 && (
              <div style={{ fontSize: '0.75rem', color: '#38bdf8', padding: '0 0.5rem 0.5rem 0.5rem', fontStyle: 'italic', animation: 'fadeIn 0.3s' }}>
                {currentDrive.typing.filter(e => e !== user.email).map(e => e.split('@')[0]).join(', ')} is typing...
              </div>
            )}
            {replyToMsg && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '0.5rem 1rem', borderRadius: '8px', marginBottom: '0.5rem', borderLeft: '3px solid #38bdf8' }}>
                <div style={{ fontSize: '0.85rem' }}>
                  <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>Replying to {replyToMsg.sender.split('@')[0]}</span>
                  <div style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{replyToMsg.text}</div>
                </div>
                <button onClick={() => setReplyToMsg(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
              </div>
            )}
            {selectedFile && (
              <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--primary-color)', background: 'rgba(59, 130, 246, 0.1)', padding: '0.5rem', borderRadius: '8px', width: 'fit-content' }}>
                <Paperclip size={14} /> {selectedFile.name}
                <button onClick={() => setSelectedFile(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <X size={14} />
                </button>
              </div>
            )}
            <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.75rem', position: 'relative' }}>
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
                onChange={e => { setInputText(e.target.value); handleTyping(); }}
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

      {showSettingsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card cyber-modal-container animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem' }}>
            <div className="flex justify-between items-center mb-8" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.75rem', fontWeight: '700', letterSpacing: '0.5px' }}>
                <Settings className="text-primary" size={28} /> Manage Drive
              </h2>
              <button onClick={() => setShowSettingsModal(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.5)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}><X size={18} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(isHead || isPriSpoc) && (
                <button onClick={() => { setShowSettingsModal(false); setEditBranches(currentDrive.eligibleBranches || []); setShowEditBranchesModal(true); }} className="cyber-menu-btn">
                  <Edit3 size={20} className="text-primary" /> Edit Eligibility
                </button>
              )}
              
              {isHead && (
                <>
                  <button onClick={() => { setShowSettingsModal(false); setNewSpocEmail(currentDrive.coordinator); setShowSpocModal(true); }} className="cyber-menu-btn">
                    <UserCog size={20} className="text-primary" /> Change Primary SPOC
                  </button>
                  <button onClick={() => { setShowSettingsModal(false); setEditingSpocIndex(0); setNewSecSpocEmail(currentDrive.secondarySpocs?.[0] || ''); setShowSecSpocModal(true); }} className="cyber-menu-btn">
                    <Users size={20} className="text-primary" /> Change Secondary SPOC 1
                  </button>
                  <button onClick={() => { setShowSettingsModal(false); setEditingSpocIndex(1); setNewSecSpocEmail(currentDrive.secondarySpocs?.[1] || ''); setShowSecSpocModal(true); }} className="cyber-menu-btn">
                    <Users size={20} className="text-primary" /> Change Secondary SPOC 2
                  </button>
                </>
              )}

              {(isHead || isPriSpoc) && (
                <button 
                  onClick={async () => {
                    try {
                      await updateDoc(doc(db, 'drives', id), { status: currentDrive.status === 'Closed' ? 'Active' : 'Closed' });
                      setShowSettingsModal(false);
                      triggerToast(`Drive ${currentDrive.status === 'Closed' ? 'Reopened' : 'Closed'}!`);
                    } catch(err) { console.error(err); }
                  }}
                  className={`cyber-menu-btn ${currentDrive.status === 'Closed' ? '' : 'danger'}`}
                  style={{ marginTop: '0.5rem' }}
                >
                  <Power size={20} className={currentDrive.status === 'Closed' ? 'text-primary' : 'text-danger'} /> {currentDrive.status === 'Closed' ? 'Reopen Drive' : 'Close Drive'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {showSpocModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card cyber-modal-container animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
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
          <div className="glass-card cyber-modal-container animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
            <div className="flex justify-between items-center mb-4">
              <h2 style={{ margin: 0 }}>Change Secondary SPOC {editingSpocIndex + 1}</h2>
              <button onClick={() => setShowSecSpocModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
            </div>
            <form onSubmit={handleChangeSecSpoc}>
              <div className="input-group">
                <label className="input-label">New SPOC Email</label>
                <input required type="email" className="input-field" value={newSecSpocEmail} onChange={e => setNewSecSpocEmail(e.target.value)} placeholder="student@nitk.edu.in" />
              </div>
              <div className="flex gap-2 justify-between mt-4">
                <button type="button" className="btn btn-secondary w-full" onClick={() => setShowSecSpocModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary w-full">Update SPOC</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditBranchesModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card cyber-modal-container animate-fade-in" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
            <div className="flex justify-between items-center mb-4">
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Edit3 size={20} className="text-primary" /> Edit Eligibility</h2>
              <button onClick={() => setShowEditBranchesModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
            </div>
            <form onSubmit={handleEditBranchesSubmit}>
              <div style={{ maxHeight: '350px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '1rem' }}>
                  
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--primary-color)', fontSize: '0.85rem' }}>B.Tech Branches</div>
                  <button type="button" onClick={() => {
                    const hasAllBtech = btechBranches.every(b => editBranches.includes(b));
                    if (hasAllBtech) {
                      setEditBranches(editBranches.filter(b => !btechBranches.includes(b)));
                    } else {
                      setEditBranches([...new Set([...editBranches, ...btechBranches])]);
                    }
                  }} style={{ fontSize: '0.7rem', background: 'none', border: '1px solid var(--primary-color)', color: 'var(--primary-color)', borderRadius: '4px', cursor: 'pointer', padding: '0.1rem 0.4rem' }}>
                    Toggle B.Tech
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                  {btechBranches.map(b => (
                    <label key={b} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={editBranches.includes(b)} onChange={(e) => {
                        if (e.target.checked) setEditBranches([...editBranches, b]);
                        else setEditBranches(editBranches.filter(eb => eb !== b));
                      }} style={{ accentColor: 'var(--primary-color)', cursor: 'pointer' }} />
                      {b}
                    </label>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--primary-color)', fontSize: '0.85rem' }}>PG Branches</div>
                  <button type="button" onClick={() => {
                    const hasAllPg = pgBranches.every(b => editBranches.includes(b));
                    if (hasAllPg) {
                      setEditBranches(editBranches.filter(b => !pgBranches.includes(b)));
                    } else {
                      setEditBranches([...new Set([...editBranches, ...pgBranches])]);
                    }
                  }} style={{ fontSize: '0.7rem', background: 'none', border: '1px solid var(--primary-color)', color: 'var(--primary-color)', borderRadius: '4px', cursor: 'pointer', padding: '0.1rem 0.4rem' }}>
                    Toggle PG
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {pgBranches.map(b => (
                    <label key={b} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={editBranches.includes(b)} onChange={(e) => {
                        if (e.target.checked) setEditBranches([...editBranches, b]);
                        else setEditBranches(editBranches.filter(eb => eb !== b));
                      }} style={{ accentColor: 'var(--primary-color)', cursor: 'pointer' }} />
                      {b.length > 25 ? b.substring(0, 22) + '...' : b}
                    </label>
                  ))}
                </div>
                
              </div>
              <div className="flex gap-3 justify-center">
                <button type="button" onClick={() => setShowEditBranchesModal(false)} className="btn btn-secondary w-full" style={{ padding: '0.8rem' }}>Cancel</button>
                <button type="submit" className="btn btn-primary w-full" style={{ padding: '0.8rem' }}>Save Eligibility</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLeaveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card cyber-modal-container animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem 2rem', textAlign: 'center' }}>
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
