import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Send, ArrowLeft, ShieldAlert, Paperclip, X, MessageSquarePlus, LogOut, Edit3, Settings, Users, UserCog, Power, Maximize2, Minimize2, CornerUpLeft, ChevronDown, Copy, Trash2, Pin, PinOff } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, doc, getDocs, setDoc, updateDoc, increment, arrayUnion, arrayRemove, deleteField, deleteDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import EmailAutocompleteInput from '../components/EmailAutocompleteInput';
import { formatName } from '../utils/profileParser';

const btechBranches = ['CSE', 'IT', 'AI', 'DS', 'ECE', 'EEE', 'MECH', 'CIVIL', 'CHEM', 'META', 'MINING'];
const pgBranches = ['Construction Tech & Management', 'MBA', 'Environmental Eng', 'Geotechnical Eng', 'Transportation Eng', 'Structural Eng', 'Power Electronics', 'Mechanical Design', 'Thermal Eng', 'Manufacturing Eng', 'Mechatronics', 'Water Resources', 'Marine Structures', 'Geoinformatics', 'MCA', 'Chemistry', 'Physics', 'Signal Processing & ML', 'Communication Eng & Networks', 'VLSI Design', 'Information Security', 'Industrial Biotechnology', 'Environmental Science & Tech', 'Materials Eng', 'Nanotechnology'];

export default function DriveRoom() {
  const { id } = useParams();
  const { user, CDC_HEADS } = useAuth();
  const navigate = useNavigate();
  
  const [currentDrive, setCurrentDrive] = useState(null);
  const [showSpocModal, setShowSpocModal] = useState(false);
  const [newSpocEmail, setNewSpocEmail] = useState('');
  const [showNoticeBoard, setShowNoticeBoard] = useState(false);
  const [pinnedIndex, setPinnedIndex] = useState(0);
  
  // Capture the last read time when component mounts, so we know which messages are "new" to glow
  const [lastRead] = useState(() => Number(localStorage.getItem(`read_drive_${id}_${user?.email}`) || 0));
  const typingTimeoutRef = useRef(null);

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
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeMenuMsgId, setActiveMenuMsgId] = useState(null);

  // Swipe-to-reply touch tracking
  const swipeRef = useRef({ startX: 0, startY: 0, swiping: false, msgObj: null, el: null });

  const handleTouchStart = useCallback((e, msg) => {
    const touch = e.touches[0];
    swipeRef.current = { startX: touch.clientX, startY: touch.clientY, swiping: false, msgObj: msg, el: e.currentTarget };
  }, []);

  const handleTouchMove = useCallback((e) => {
    const s = swipeRef.current;
    if (!s.startX) return;
    const touch = e.touches[0];
    const dx = s.startX - touch.clientX; // positive = swipe left
    const dy = Math.abs(touch.clientY - s.startY);
    // Only trigger swipe if horizontal movement dominates
    if (dx > 20 && dy < 40) {
      s.swiping = true;
      const offset = Math.min(dx, 80);
      if (s.el) s.el.style.transform = `translateX(-${offset}px)`;
      if (s.el) s.el.style.transition = 'none';
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    const s = swipeRef.current;
    if (s.el) {
      s.el.style.transform = 'translateX(0)';
      s.el.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    }
    if (s.swiping && s.msgObj) {
      setReplyToMsg(s.msgObj);
    }
    swipeRef.current = { startX: 0, startY: 0, swiping: false, msgObj: null, el: null };
  }, []);
  
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

  // Broadcast a management-activity entry to every HEAD's notification tab so admins
  // can monitor SPOC actions (eligibility edits, drive open/close, SPOC reassignments).
  // Chat messages are intentionally NOT logged here.
  const logActivityToHeads = async (action) => {
    try {
      const actor = user?.email?.split('@')[0] || 'Someone';
      const stamp = new Date().toISOString();
      const heads = CDC_HEADS || [];
      await Promise.all(heads.map(head => addDoc(collection(db, 'notifications'), {
        recipient: head,
        message: `${actor} ${action}`,
        type: 'ACTIVITY',
        actor: user?.email || '',
        read: false,
        timestamp: stamp
      })));
    } catch (err) {
      console.error('Activity log failed', err);
    }
  };


  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const chatBodyRef = useRef(null);

  const [hoveredMsgId, setHoveredMsgId] = useState(null);
  const [replyToMsg, setReplyToMsg] = useState(null);
  const fileInputRef = useRef(null);
  const [lightboxImg, setLightboxImg] = useState(null);

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
  }, [id, user?.email]);

  // Presence Heartbeat
  useEffect(() => {
    if (!id || !user?.email) return;
    const safeEmail = user.email.replace(/\./g, '_');

    const updatePresence = async () => {
      try {
        await updateDoc(doc(db, 'drives', id), {
          [`activeUsers.${safeEmail}`]: new Date().toISOString(),
          [`lastRead.${safeEmail}`]: new Date().toISOString()
        });
      } catch (err) {
        console.error("Presence update failed", err);
      }
    };

    updatePresence();
    const interval = setInterval(updatePresence, 10000);

    return () => {
      clearInterval(interval);
      const driveRef = doc(db, 'drives', id);
      updateDoc(driveRef, {
        [`activeUsers.${safeEmail}`]: deleteField()
      }).catch(err => console.error("Presence cleanup failed", err));
    };
  }, [id, user?.email]);

  const isCoordinator = user?.email === currentDrive?.coordinator;
  const canMessage = user?.role === 'HEAD' || isCoordinator;
  const pinnedMessages = messages.filter(m => m.pinned);
  const activePinnedIdx = pinnedMessages.length > 0 ? Math.min(pinnedIndex, pinnedMessages.length - 1) : 0;
  const activePinnedMsg = pinnedMessages[activePinnedIdx];
  const pinnedPreview = (m) => m.text ? m.text.replace(/\n/g, ' ') : (m.fileName ? `📎 ${m.fileName}` : 'Attachment');

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

  // Scroll only the inner chat body (never the outer page container) so the
  // drive header stays pinned in view when a room is opened.
  const scrollToBottom = (smooth = true) => {
    const el = chatBodyRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const [glowMsgId, setGlowMsgId] = useState(null);
  const glowTimeoutRef = useRef(null);

  // Scroll the message into view within the chat body (not scrollIntoView,
  // which would also drag every other scrollable ancestor on the page) and
  // briefly glow it so the user can spot it.
  const jumpToMessage = useCallback((msgId) => {
    const container = chatBodyRef.current;
    const target = document.getElementById(`msg-${msgId}`);
    if (container && target) {
      container.scrollTo({ top: Math.max(target.offsetTop - 24, 0), behavior: 'smooth' });
    }
    if (glowTimeoutRef.current) clearTimeout(glowTimeoutRef.current);
    setGlowMsgId(null);
    requestAnimationFrame(() => setGlowMsgId(msgId));
    glowTimeoutRef.current = setTimeout(() => setGlowMsgId(null), 1600);
  }, []);

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
    stopTyping();
  };

  const handleReaction = async (msgId, emoji, currentReactions) => {
    try {
      const safeEmail = user.email.replace(/\./g, '_');
      const hasReactedWithThisEmoji = currentReactions && currentReactions[safeEmail] === emoji;
      
      await updateDoc(doc(db, 'drives', id, 'messages', msgId), {
        [`reactions.${safeEmail}`]: hasReactedWithThisEmoji ? deleteField() : emoji
      });
    } catch (err) {
      console.error("Reaction error", err);
    }
  };

  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      updateDoc(doc(db, 'drives', id), { typing: arrayUnion(user.email) });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      updateDoc(doc(db, 'drives', id), { typing: arrayRemove(user.email) });
    }, 3000);
  };

  const stopTyping = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    setIsTyping(false);
    updateDoc(doc(db, 'drives', id), { typing: arrayRemove(user.email) }).catch(() => {});
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (user?.email && id) {
        updateDoc(doc(db, 'drives', id), { typing: arrayRemove(user.email) }).catch(() => {});
      }
    };
  }, [id, user?.email]);

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

      await logActivityToHeads(`changed the Primary SPOC of ${currentDrive.company} to ${newSpocEmail.split('@')[0]}.`);

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
      await logActivityToHeads(`updated the eligible branches for ${currentDrive.company} (${editBranches.length} branch${editBranches.length === 1 ? '' : 'es'} now eligible).`);
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

      // Broadcast the activity to all HEADs
      await logActivityToHeads(`changed Secondary SPOC ${editingSpocIndex + 1} of ${currentDrive.company} to ${newSecSpocEmail.split('@')[0]}.`);

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
      // Find existing DM. Must filter by array-contains so the query matches the
      // firestore.rules read condition (an unscoped collection scan is rejected
      // outright since rules can't validate it against every possible document).
      const dmsRef = collection(db, 'dms');
      const q = query(dmsRef, where('participants', 'array-contains', user.email));
      const snapshot = await getDocs(q);
      let existingDmId = null;

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.participants.includes(targetEmail) && data.participants.length === 2) {
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
      toast.error("Couldn't open chat. Please try again.");
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
    <div style={isFullScreen ? {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 9999,
      background: 'radial-gradient(circle at 10% 20%, var(--bg-color) 0%, var(--bg-gradient-end) 100%)',
      padding: '0.4rem',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      transition: 'all 0.3s ease'
    } : {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      transition: 'all 0.3s ease'
    }}>

      {!isFullScreen && (
        <div className="glass-panel drive-room-header" style={{ padding: '1rem 1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
              <ArrowLeft size={24} />
            </button>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{currentDrive.company}</h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Primary SPOC: <span style={{ color: 'var(--primary-color)' }}>{currentDrive.coordinator.split('@')[0]}</span>
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
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
      )}

      {/* Secondary SPOCs Bar */}
      {!isFullScreen && (currentDrive.secondarySpocs?.length > 0 || user?.role === 'HEAD') && (
        <div className="secondary-spoc-bar" style={{ padding: '0.75rem 1.5rem', marginBottom: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
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

      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        
        {/* Fullscreen top header bar */}
        {isFullScreen && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.6rem 1.25rem',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(0, 0, 0, 0.25)',
            zIndex: 11,
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button 
                onClick={() => setIsFullScreen(false)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '4px' }}
                title="Exit Full Screen"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600' }}>{currentDrive.company}</h3>
                  <span style={{ fontSize: '0.7rem', opacity: 0.6, background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>Group Chat</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  Primary SPOC: <span style={{ color: 'var(--primary-color)' }}>{currentDrive.coordinator.split('@')[0]}</span>
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {(isHead || isPriSpoc) && (
                <button 
                  onClick={() => setShowSettingsModal(true)}
                  className="btn-glass primary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                >
                  <Settings size={14} /> <span>Manage</span>
                </button>
              )}
              {canLeave && (
                <button 
                  onClick={() => setShowLeaveModal(true)} 
                  className="btn-glass danger"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                >
                  <LogOut size={14} /> <span>Leave</span>
                </button>
              )}
              <button
                onClick={() => setIsFullScreen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px',
                  borderRadius: '50%',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                title="Exit Full Screen"
              >
                <Minimize2 size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Active Users Bar (Normal Mode) */}
        {!isFullScreen && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            padding: '0.6rem 1.25rem', 
            borderBottom: '1px solid rgba(255,255,255,0.05)', 
            background: 'rgba(0, 0, 0, 0.1)',
            zIndex: 11
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Active:</span>
              <div style={{ display: 'flex', gap: '-5px', alignItems: 'center', flexWrap: 'wrap' }}>
                {currentDrive.activeUsers && Object.entries(currentDrive.activeUsers)
                  .filter(([emailKey, timestamp]) => {
                    return new Date().getTime() - new Date(timestamp).getTime() < 20000;
                  })
                  .map(([emailKey]) => {
                    const originalEmail = emailKey.replace(/_/g, '.');
                    const isMe = originalEmail === user?.email;
                    const formatInitials = (email) => {
                      const name = email.split('@')[0].split('.')[0].substring(0, 2);
                      return name.toUpperCase();
                    };
                    return (
                      <div 
                        key={emailKey}
                        title={`${originalEmail} ${isMe ? '(You)' : ''}`}
                        style={{ 
                          width: '28px', 
                          height: '28px', 
                          borderRadius: '50%', 
                          background: isMe ? 'var(--primary-color)' : 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(37, 99, 235, 0.2))',
                          border: '2px solid var(--border-color)',
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          color: isMe ? '#fff' : 'var(--primary-color)', 
                          fontWeight: 'bold', 
                          fontSize: '0.7rem',
                          position: 'relative',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                          marginLeft: '-4px',
                          zIndex: isMe ? 2 : 1,
                          cursor: 'default',
                          transition: 'transform 0.2s'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        {formatInitials(originalEmail)}
                        <span style={{ 
                          position: 'absolute', 
                          bottom: 0, 
                          right: 0, 
                          width: '7px', 
                          height: '7px', 
                          borderRadius: '50%', 
                          background: 'var(--success-color)',
                          border: '1px solid var(--bg-color)',
                          boxShadow: '0 0 5px var(--success-color)'
                        }} />
                      </div>
                    );
                  })}
                {(!currentDrive.activeUsers || Object.keys(currentDrive.activeUsers).filter(k => new Date().getTime() - new Date(currentDrive.activeUsers[k]).getTime() < 20000).length === 0) && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginLeft: '0.25rem' }}>Just you</span>
                )}
              </div>
            </div>

            <button
              onClick={() => setIsFullScreen(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                borderRadius: '50%',
                transition: 'background 0.2s, transform 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              title="Full Screen"
            >
              <Maximize2 size={18} />
            </button>
          </div>
        )}

        {/* Pinned bar - Telegram channel style */}
        {pinnedMessages.length > 0 && (
            <div style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--chat-panel-bg)', backdropFilter: 'blur(8px)', zIndex: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 1rem' }}>
                {/* Click to jump to the pinned message in the chat */}
                <div
                  onClick={() => jumpToMessage(activePinnedMsg.id)}
                  style={{ display: 'flex', alignItems: 'stretch', gap: '0.6rem', flex: 1, minWidth: 0, cursor: 'pointer' }}
                >
                  {/* Segmented accent rail (one segment per pinned message) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '3px', flexShrink: 0, alignSelf: 'stretch', minHeight: '30px' }}>
                    {pinnedMessages.slice(0, 5).map((_, i) => (
                      <div key={i} style={{ flex: 1, borderRadius: '2px', background: i === activePinnedIdx ? 'var(--primary-color)' : 'rgba(96, 165, 250, 0.25)', transition: 'background 0.2s' }} />
                    ))}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Pin size={11} fill="var(--primary-color)" />
                      Pinned Message{pinnedMessages.length > 1 ? ` (${activePinnedIdx + 1}/${pinnedMessages.length})` : ''}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '1px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{formatName(activePinnedMsg.sender)}: </span>
                      {pinnedPreview(activePinnedMsg)}
                    </div>
                  </div>
                </div>
                {/* Right controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', flexShrink: 0 }}>
                  {pinnedMessages.length > 1 && (
                    <button
                      onClick={() => setShowNoticeBoard(!showNoticeBoard)}
                      title={showNoticeBoard ? 'Hide all pinned' : 'Show all pinned'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px', borderRadius: '8px', transition: 'all 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(96, 165, 250, 0.12)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <ChevronDown size={16} style={{ transform: showNoticeBoard ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>
                  )}
                  {canMessage && (
                    <button
                      onClick={async () => {
                        try {
                          await updateDoc(doc(db, 'drives', id, 'messages', activePinnedMsg.id), { pinned: false });
                          triggerToast("Notice unpinned!");
                        } catch (err) { console.error("Error unpinning", err); }
                      }}
                      title="Unpin this message"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px', borderRadius: '8px', transition: 'all 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244, 63, 94, 0.12)'; e.currentTarget.style.color = 'var(--danger-color)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                      <PinOff size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded "all pinned" list */}
              {showNoticeBoard && pinnedMessages.length > 1 && (
                <div className="animate-fade-in" style={{ maxHeight: '180px', overflowY: 'auto', padding: '0 1rem 0.6rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {pinnedMessages.map((msg, i) => (
                    <div
                      key={msg.id}
                      onClick={() => { setPinnedIndex(i); setShowNoticeBoard(false); jumpToMessage(msg.id); }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', background: i === activePinnedIdx ? 'rgba(96, 165, 250, 0.1)' : 'var(--input-bg)', border: '1px solid var(--border-color)', borderLeft: '3px solid var(--primary-color)', borderRadius: '8px', padding: '0.45rem 0.65rem', cursor: 'pointer' }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{formatName(msg.sender)} · {new Date(msg.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pinnedPreview(msg)}</div>
                      </div>
                      {canMessage && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await updateDoc(doc(db, 'drives', id, 'messages', msg.id), { pinned: false });
                              triggerToast("Notice unpinned!");
                            } catch (err) { console.error("Error unpinning", err); }
                          }}
                          title="Unpin"
                          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', borderRadius: '6px', flexShrink: 0, display: 'flex' }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--danger-color)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                        >
                          <PinOff size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
        )}

        <div ref={chatBodyRef} className="drive-chat-body" style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', position: 'relative', zIndex: 10 }}>
          {messages.length === 0 && (
             <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2rem' }}>
               No messages in this drive yet.
             </div>
          )}
          {messages.map(msg => {
            const isMe = msg.sender === user?.email;
            const displayRole = msg.role === 'HEAD' ? 'ADMIN' : (msg.role === 'SPOC' || msg.role === 'COORDINATOR' ? 'SPOC' : 'SEC SPOC');
            const msgTime = msg.timestamp ? (msg.timestamp.toMillis ? msg.timestamp.toMillis() : new Date(msg.timestamp).getTime()) : 0;
            const isNew = !isMe && msg.timestamp && msgTime > lastRead;
            
            const isImage = msg.fileName && msg.fileName.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i);
            const isImageOnly = isImage && !msg.text;

            const allCoordinators = [
              currentDrive?.coordinator,
              ...(currentDrive?.secondarySpocs || []),
              ...(CDC_HEADS || [])
            ].filter(Boolean);
            const uniqueCoordinators = [...new Set(allCoordinators)];
            
            const readByCoordinators = uniqueCoordinators.filter(email => {
              if (email === msg.sender) return false;
              const safeEmail = email.replace(/\./g, '_');
              const readTime = currentDrive?.lastRead?.[safeEmail];
              if (!readTime) return false;
              // Firestore string date ISO comparison
              return new Date(readTime).getTime() >= new Date(msg.timestamp).getTime();
            });
            
            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                className={`drive-msg-container msg-wrapper ${isNew ? 'new-msg-glow' : ''}`}
                onMouseEnter={() => { if (window.innerWidth > 768) setHoveredMsgId(msg.id); }}
                onMouseLeave={() => {
                  if (window.innerWidth > 768 && activeMenuMsgId !== msg.id) {
                    setHoveredMsgId(null);
                  }
                }}
                onClick={(e) => {
                  if (window.innerWidth <= 768 && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A') {
                    setHoveredMsgId(hoveredMsgId === msg.id ? null : msg.id);
                  }
                }}
                onTouchStart={(e) => handleTouchStart(e, msg)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', position: 'relative', alignItems: 'flex-start', willChange: 'transform' }}
              >
                <div className={`drive-msg-bubble ${glowMsgId === msg.id ? 'jump-glow' : ''}`} style={{
                  background: isImageOnly ? 'transparent' : (isMe ? 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))' : 'var(--chat-bubble-incoming-bg)'),
                  color: isMe ? '#fff' : 'var(--text-primary)',
                  border: isImageOnly ? 'none' : (isMe ? 'none' : '1px solid var(--chat-bubble-incoming-border)'),
                  padding: isImageOnly ? '0' : '0.35rem 0.6rem',
                  borderRadius: '14px',
                  borderBottomRightRadius: isMe ? '4px' : '14px',
                  borderBottomLeftRadius: !isMe ? '4px' : '14px',
                  maxWidth: isImageOnly ? '300px' : '72%',
                  width: 'fit-content',
                  wordBreak: 'break-word',
                  boxShadow: isImageOnly ? 'none' : (isMe ? '0 4px 15px rgba(59, 130, 246, 0.3)' : 'var(--glass-shadow)'),
                  backdropFilter: isImageOnly ? 'none' : 'blur(8px)',
                  position: 'relative',
                  marginTop: '0.2rem'
                }}>
                  {/* Internal Sender Tag - Telegram Style */}
                  {!isMe && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '1px', fontSize: '0.72rem', fontWeight: 'bold' }}>
                      <span style={{ color: msg.role === 'HEAD' ? '#fb7185' : (msg.role === 'SPOC' || msg.role === 'COORDINATOR' ? '#38bdf8' : '#c084fc') }}>
                        {formatName(msg.sender)}
                      </span>
                      <span style={{ fontSize: '0.6rem', opacity: 0.6, fontWeight: 'normal', color: 'var(--text-secondary)' }}>
                        ({displayRole})
                      </span>
                    </div>
                  )}

                  {/* Reply + actions cluster, floated just outside the bubble on hover/tap */}
                  {(hoveredMsgId === msg.id || activeMenuMsgId === msg.id) && (
                  <div className="msg-actions-cluster" style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [isMe ? 'right' : 'left']: 'calc(100% + 6px)', zIndex: 12, display: 'flex', alignItems: 'center', gap: '1px', background: 'var(--dropdown-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '2px', boxShadow: '0 2px 10px var(--glass-shadow)' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setReplyToMsg(msg); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRadius: '50%', transition: 'background 0.2s, color 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(96, 165, 250, 0.15)'; e.currentTarget.style.color = 'var(--primary-color)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                      title="Reply"
                    >
                      <CornerUpLeft size={14} />
                    </button>

                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setActiveMenuMsgId(activeMenuMsgId === msg.id ? null : msg.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRadius: '50%', transition: 'background 0.2s, color 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(96, 165, 250, 0.15)'; e.currentTarget.style.color = 'var(--primary-color)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                        title="More actions"
                      >
                        <ChevronDown size={15} />
                      </button>
                      {activeMenuMsgId === msg.id && (
                        <>
                          <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={(e) => { e.stopPropagation(); setActiveMenuMsgId(null); }} />
                          <div
                            className="animate-fade-in cyber-dropdown"
                            style={{
                              position: 'absolute',
                              top: 'calc(100% + 4px)',
                              [isMe ? 'right' : 'left']: 0,
                              background: 'var(--dropdown-bg)',
                              backdropFilter: 'blur(12px)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '12px',
                              padding: '0.3rem',
                              minWidth: '160px',
                              boxShadow: '0 10px 25px var(--glass-shadow)',
                              zIndex: 999,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.1rem'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Quick reactions row */}
                            <div style={{ display: 'flex', justifyContent: 'space-around', gap: '0.1rem', padding: '0.15rem 0.2rem 0.3rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.2rem' }}>
                              {['👍', '❤️', '😂', '🎉', '🔥'].map(emoji => (
                                <button key={emoji} onClick={() => { handleReaction(msg.id, emoji, msg.reactions); setActiveMenuMsgId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '0.1rem 0.2rem', borderRadius: '8px', transition: 'transform 0.1s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.25)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>{emoji}</button>
                              ))}
                            </div>
                            {msg.text && (
                              <button
                                className="cyber-dropdown-item"
                                onClick={() => {
                                  navigator.clipboard.writeText(msg.text);
                                  toast.success("Text copied!");
                                  setActiveMenuMsgId(null);
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', color: 'var(--text-primary)' }}
                              >
                                <Copy size={14} /> Copy Text
                              </button>
                            )}
                            <button
                              className="cyber-dropdown-item"
                              onClick={() => { setReplyToMsg(msg); setActiveMenuMsgId(null); }}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', color: 'var(--text-primary)' }}
                            >
                              <CornerUpLeft size={14} /> Reply
                            </button>
                            {canMessage && (
                              <button
                                className="cyber-dropdown-item"
                                onClick={async () => {
                                  try {
                                    await updateDoc(doc(db, 'drives', id, 'messages', msg.id), {
                                      pinned: !msg.pinned
                                    });
                                    toast.success(msg.pinned ? "Notice unpinned!" : "Notice pinned!");
                                  } catch (err) {
                                    console.error("Pin error", err);
                                  }
                                  setActiveMenuMsgId(null);
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', color: '#fbbf24' }}
                              >
                                {msg.pinned ? <PinOff size={14} /> : <Pin size={14} />} {msg.pinned ? 'Unpin Message' : 'Pin Message'}
                              </button>
                            )}
                            {(isMe || isHead || isPriSpoc) && (
                              <button
                                className="cyber-dropdown-item"
                                onClick={async () => {
                                  try {
                                    await deleteDoc(doc(db, 'drives', id, 'messages', msg.id));
                                    toast.success("Message unsent");
                                  } catch (err) {
                                    console.error("Delete error", err);
                                  }
                                  setActiveMenuMsgId(null);
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', color: '#f87171' }}
                              >
                                <Trash2 size={14} /> Unsend Message
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  )}
                  {msg.replyTo && (
                    <div style={{ background: 'rgba(0,0,0,0.1)', borderLeft: '3px solid var(--primary-color)', padding: '0.3rem 0.5rem', borderRadius: '4px', marginBottom: '0.3rem', fontSize: '0.75rem', opacity: 0.8 }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '0.1rem' }}>{formatName(msg.replyTo.sender)}</div>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.replyTo.text}</div>
                    </div>
                  )}
                  
                  {isImageOnly ? (
                    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '12px', width: 'fit-content' }}>
                      <img 
                        src={msg.fileData} 
                        alt={msg.fileName} 
                        style={{ 
                          maxWidth: '100%', 
                          maxHeight: '360px', 
                          objectFit: 'contain', 
                          borderRadius: '12px',
                          cursor: 'pointer',
                          border: '1px solid var(--border-color)',
                          display: 'block'
                        }}
                        onClick={() => setLightboxImg(msg.fileData)}
                      />
                      <div style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '8px',
                        background: 'rgba(0, 0, 0, 0.55)',
                        backdropFilter: 'blur(4px)',
                        color: '#fff',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '0.65rem',
                        display: 'flex',
                        alignItems: 'center',
                        pointerEvents: 'none'
                      }}>
                        {msg.timestamp ? new Date(msg.timestamp.toMillis ? msg.timestamp.toMillis() : msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </div>
                  ) : (
                    <div style={{ position: 'relative', display: 'block' }}>
                      <span className="msg-text" style={{ lineHeight: '1.4', color: 'inherit', wordBreak: 'break-word' }}>
                        {msg.text}
                        {msg.fileName && (
                          (() => {
                            const isImage = msg.fileName.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i);
                            const isPdf = msg.fileName.match(/\.pdf$/i);
                            const isExcel = msg.fileName.match(/\.(xls|xlsx|csv)$/i);

                            if (isImage) {
                              return (
                                <div style={{ marginTop: '0.4rem', overflow: 'hidden', borderRadius: '8px', display: 'block' }}>
                                  <img 
                                    src={msg.fileData} 
                                    alt={msg.fileName} 
                                    style={{ 
                                      maxWidth: '100%', 
                                      maxHeight: '200px', 
                                      objectFit: 'cover', 
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      border: '1px solid rgba(255,255,255,0.1)',
                                      display: 'block'
                                    }}
                                    onClick={() => setLightboxImg(msg.fileData)}
                                  />
                                </div>
                              );
                            } else if (isPdf) {
                              return (
                                <div style={{ 
                                  marginTop: '0.4rem', 
                                  background: 'rgba(239, 68, 68, 0.08)', 
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  padding: '0.4rem 0.6rem', 
                                  borderRadius: '8px', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'space-between',
                                  gap: '0.75rem',
                                  fontSize: '0.8rem'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                                    <span style={{ fontSize: '1rem', color: '#f87171', fontWeight: 'bold' }}>📕</span>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }} title={msg.fileName}>
                                      {msg.fileName}
                                    </span>
                                  </div>
                                  <a 
                                    href={msg.fileData} 
                                    download={msg.fileName} 
                                    style={{ 
                                      color: '#f87171', 
                                      textDecoration: 'none', 
                                      fontWeight: 'bold',
                                      fontSize: '0.7rem',
                                      textTransform: 'uppercase',
                                      border: '1px solid rgba(239, 68, 68, 0.5)',
                                      padding: '0.15rem 0.4rem',
                                      borderRadius: '4px',
                                      background: 'rgba(239, 68, 68, 0.05)',
                                      flexShrink: 0
                                    }}
                                  >
                                    Get PDF
                                  </a>
                                </div>
                              );
                            } else if (isExcel) {
                              return (
                                <div style={{ 
                                  marginTop: '0.4rem', 
                                  background: 'rgba(16, 185, 129, 0.08)', 
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  padding: '0.4rem 0.6rem', 
                                  borderRadius: '8px', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'space-between',
                                  gap: '0.75rem',
                                  fontSize: '0.8rem'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                                    <span style={{ fontSize: '1rem', color: '#34d399', fontWeight: 'bold' }}>📊</span>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }} title={msg.fileName}>
                                      {msg.fileName}
                                    </span>
                                  </div>
                                  <a 
                                    href={msg.fileData} 
                                    download={msg.fileName} 
                                    style={{ 
                                      color: '#34d399', 
                                      textDecoration: 'none', 
                                      fontWeight: 'bold',
                                      fontSize: '0.75rem',
                                      textTransform: 'uppercase',
                                      border: '1px solid rgba(16, 185, 129, 0.5)',
                                      padding: '0.15rem 0.4rem',
                                      borderRadius: '4px',
                                      background: 'rgba(16, 185, 129, 0.05)',
                                      flexShrink: 0
                                    }}
                                  >
                                    Get Sheet
                                  </a>
                                </div>
                              );
                            } else {
                              return (
                                <div style={{ 
                                  marginTop: '0.4rem', 
                                  background: 'rgba(96, 165, 250, 0.08)', 
                                  border: '1px solid rgba(96, 165, 250, 0.3)',
                                  padding: '0.4rem 0.6rem', 
                                  borderRadius: '8px', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'space-between',
                                  gap: '0.75rem',
                                  fontSize: '0.8rem'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                                    <span style={{ fontSize: '1rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>📎</span>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }} title={msg.fileName}>
                                      {msg.fileName}
                                    </span>
                                  </div>
                                  <a 
                                    href={msg.fileData} 
                                    download={msg.fileName} 
                                    style={{ 
                                      color: 'var(--primary-color)', 
                                      textDecoration: 'none', 
                                      fontWeight: 'bold',
                                      fontSize: '0.7rem',
                                      textTransform: 'uppercase',
                                      border: '1px solid var(--primary-color)',
                                      padding: '0.15rem 0.4rem',
                                      borderRadius: '4px',
                                      background: 'rgba(96, 165, 250, 0.05)',
                                      flexShrink: 0
                                    }}
                                  >
                                    Download
                                  </a>
                                </div>
                              );
                            }
                          })()
                        )}
                      </span>
                      
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '4px',
                        fontSize: '0.6rem', 
                        color: isMe ? 'rgba(255, 255, 255, 0.7)' : 'var(--text-secondary)',
                        marginLeft: '8px',
                        float: 'right',
                        marginTop: '0.3rem',
                        whiteSpace: 'nowrap',
                        verticalAlign: 'bottom'
                      }}>
                        {msg.timestamp ? new Date(msg.timestamp.toMillis ? msg.timestamp.toMillis() : msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        
                        {/* Compact Read Receipts inline */}
                        {readByCoordinators.length > 0 && (
                          <span style={{ display: 'inline-flex', gap: '1px', marginLeft: '2px' }} title={`Seen by: ${readByCoordinators.join(', ')}`}>
                            {readByCoordinators.map(email => {
                              const nameKey = email.split('@')[0].split('.')[0].substring(0, 2).toUpperCase();
                              return (
                                <span key={email} style={{
                                  width: '12px',
                                  height: '12px',
                                  borderRadius: '50%',
                                  background: isMe ? 'rgba(255, 255, 255, 0.25)' : 'rgba(56, 189, 248, 0.25)',
                                  border: `1px solid ${isMe ? 'rgba(255, 255, 255, 0.4)' : 'rgba(56, 189, 248, 0.5)'}`,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.45rem',
                                  fontWeight: '800',
                                  color: '#fff',
                                }}>
                                  {nameKey}
                                </span>
                              );
                            })}
                          </span>
                        )}
                      </span>
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
                      <span key={emoji} style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.1rem 0.4rem', fontSize: '0.75rem', color: 'var(--text-primary)' }}>
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
          <div className="glass-panel" style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', background: 'var(--navbar-bg)' }}>
            {currentDrive?.typing?.filter(e => e !== user.email).length > 0 && (
              <div style={{ fontSize: '0.75rem', color: '#38bdf8', padding: '0 0.5rem 0.5rem 0.5rem', fontStyle: 'italic', animation: 'fadeIn 0.3s' }}>
                {currentDrive.typing.filter(e => e !== user.email).map(e => e.split('@')[0]).join(', ')} is typing...
              </div>
            )}
            {replyToMsg && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--input-bg)', padding: '0.5rem 1rem', borderRadius: '8px', marginBottom: '0.5rem', borderLeft: '3px solid var(--primary-color)' }}>
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
          <div style={{ padding: '1.25rem', borderTop: '1px solid var(--border-color)', background: 'var(--input-bg)', textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <ShieldAlert size={18} className="text-warning-color" /> Only the assigned Primary SPOC and Admins can send messages here.
          </div>
        )}
      </div>

      {showSettingsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', overflowY: 'auto', padding: '1rem', zIndex: 1000 }}>
          <div className="glass-card cyber-modal-container animate-fade-in" style={{ margin: 'auto', width: '100%', maxWidth: '420px', padding: '1.5rem' }}>
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
                      const reopening = currentDrive.status === 'Closed';
                      await updateDoc(doc(db, 'drives', id), { status: reopening ? 'Active' : 'Closed' });
                      await logActivityToHeads(`${reopening ? 'reopened' : 'closed'} the ${currentDrive.company} drive.`);
                      setShowSettingsModal(false);
                      triggerToast(`Drive ${reopening ? 'Reopened' : 'Closed'}!`);
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', overflowY: 'auto', padding: '1rem', zIndex: 1000 }}>
          <div className="glass-card cyber-modal-container animate-fade-in" style={{ margin: 'auto', width: '100%', maxWidth: '400px', padding: '1.5rem' }}>
            <div className="flex justify-between items-center mb-4">
              <h2 style={{ margin: 0 }}>Change Primary SPOC</h2>
              <button onClick={() => setShowSpocModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
            </div>
            <form onSubmit={handleChangeSpoc}>
              <div className="input-group">
                <label className="input-label">New SPOC (Name or Email)</label>
                <EmailAutocompleteInput required value={newSpocEmail} onChange={setNewSpocEmail} placeholder="Type a name or email..." />
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', overflowY: 'auto', padding: '1rem', zIndex: 1000 }}>
          <div className="glass-card cyber-modal-container animate-fade-in" style={{ margin: 'auto', width: '100%', maxWidth: '400px', padding: '1.5rem' }}>
            <div className="flex justify-between items-center mb-4">
              <h2 style={{ margin: 0 }}>Change Secondary SPOC {editingSpocIndex + 1}</h2>
              <button onClick={() => setShowSecSpocModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
            </div>
            <form onSubmit={handleChangeSecSpoc}>
              <div className="input-group">
                <label className="input-label">New SPOC (Name or Email)</label>
                <EmailAutocompleteInput required value={newSecSpocEmail} onChange={setNewSecSpocEmail} placeholder="Type a name or email..." />
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', overflowY: 'auto', padding: '1rem', zIndex: 1000 }}>
          <div className="glass-card cyber-modal-container animate-fade-in" style={{ margin: 'auto', width: '100%', maxWidth: '500px', padding: '1.5rem' }}>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', overflowY: 'auto', padding: '1rem', zIndex: 1000 }}>
          <div className="glass-card cyber-modal-container animate-fade-in" style={{ margin: 'auto', width: '100%', maxWidth: '400px', padding: '1.5rem', textAlign: 'center' }}>
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

      {/* Fullscreen Image Lightbox Overlay */}
      {lightboxImg && (
        <div 
          onClick={() => setLightboxImg(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(11, 15, 25, 0.9)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            cursor: 'zoom-out',
            animation: 'fadeIn 0.25s ease-out'
          }}
        >
          <button 
            onClick={(e) => { e.stopPropagation(); setLightboxImg(null); }}
            style={{
              position: 'absolute',
              top: '1.5rem',
              right: '1.5rem',
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#fff',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              transition: 'all 0.2s ease',
              zIndex: 1101
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.4)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
          >
            &times;
          </button>
          <img 
            src={lightboxImg} 
            alt="Full preview"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90%',
              maxHeight: '90%',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              cursor: 'default',
              animation: 'zoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          />
        </div>
      )}
    </div>
  );
}
