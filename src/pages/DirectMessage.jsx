import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Send, ArrowLeft, Paperclip, X, User, Plus, Maximize2, Minimize2 } from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, deleteField } from 'firebase/firestore';
const playSFX = () => {};

export default function DirectMessage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [dmData, setDmData] = useState(null);
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [hoveredMsgId, setHoveredMsgId] = useState(null);
  const [replyToMsg, setReplyToMsg] = useState(null);
  const [showReactionPickerId, setShowReactionPickerId] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  // Capture the last read time when component mounts, so we know which messages are "new" to glow
  const [lastRead] = useState(() => Number(localStorage.getItem(`read_dm_${id}_${user?.email}`) || 0));

  useEffect(() => {
    if (!user?.email) return;
    // Continuously update the read receipt while actively viewing this DM
    const interval = setInterval(() => {
      localStorage.setItem(`read_dm_${id}_${user.email}`, Date.now());
    }, 1000);
    // Also do it immediately on mount
    localStorage.setItem(`read_dm_${id}_${user.email}`, Date.now());
    return () => clearInterval(interval);
  }, [id, user?.email]);

  useEffect(() => {
    if (!user?.email || !id) return;

    const unsubscribe = onSnapshot(doc(db, 'dms', id), (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        if (data.participants.includes(user.email)) {
          setDmData(prev => {
            if (prev && prev.messages && data.messages && data.messages.length > prev.messages.length) {
              const lastMsg = data.messages[data.messages.length - 1];
              if (lastMsg.sender !== user.email) {
                playSFX('received');
              }
            }
            return data;
          });
        } else {
          navigate('/dashboard');
        }
      } else {
        navigate('/dashboard');
      }
    });

    return () => unsubscribe();
  }, [id, user, navigate]);

  // Presence Heartbeat
  useEffect(() => {
    if (!id || !user?.email) return;
    const safeEmail = user.email.replace(/\./g, '_');

    const updatePresence = async () => {
      try {
        await updateDoc(doc(db, 'dms', id), {
          [`activeUsers.${safeEmail}`]: new Date().toISOString()
        });
      } catch (err) {
        console.error("Presence update failed", err);
      }
    };

    updatePresence();
    const interval = setInterval(updatePresence, 10000);

    return () => {
      clearInterval(interval);
      const dmRef = doc(db, 'dms', id);
      updateDoc(dmRef, {
        [`activeUsers.${safeEmail}`]: deleteField()
      }).catch(err => console.error("Presence cleanup failed", err));
    };
  }, [id, user?.email]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [dmData?.messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedFile) return;

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
      playSFX('sent');
      await updateDoc(doc(db, 'dms', id), {
        messages: arrayUnion({
          id: Date.now(),
          sender: user.email,
          text: inputText,
          fileData,
          fileName,
          timestamp: new Date().toISOString(),
          replyTo: replyToMsg ? { id: replyToMsg.id, sender: replyToMsg.sender, text: replyToMsg.text } : null
        })
      });
    } catch (err) {
      console.error("Error sending DM", err);
    }
    
    setInputText('');
    setSelectedFile(null);
    setReplyToMsg(null);
  };

  const handleReaction = async (msgId, emoji) => {
    try {
      if (!dmData || !dmData.messages) return;
      const updatedMessages = [...dmData.messages];
      const msgIndex = updatedMessages.findIndex(m => m.id === msgId);
      if (msgIndex === -1) return;
      
      const msg = updatedMessages[msgIndex];
      const safeEmail = user.email.replace(/\./g, '_');
      if (!msg.reactions) msg.reactions = {};
      
      const hasReactedWithThisEmoji = msg.reactions[safeEmail] === emoji;
      if (hasReactedWithThisEmoji) {
        delete msg.reactions[safeEmail];
      } else {
        msg.reactions[safeEmail] = emoji;
      }
      
      setShowReactionPickerId(null);
      
      await updateDoc(doc(db, 'dms', id), { messages: updatedMessages });
    } catch (err) {
      console.error("Reaction error", err);
    }
  };

  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      updateDoc(doc(db, 'dms', id), { typing: arrayUnion(user.email) });
    }
    
    if (window.dmTypingTimeout) clearTimeout(window.dmTypingTimeout);
    window.dmTypingTimeout = setTimeout(() => {
      setIsTyping(false);
      updateDoc(doc(db, 'dms', id), { typing: arrayRemove(user.email) });
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

  if (!dmData) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading Direct Message...</div>;

  const otherPerson = dmData.participants.find(p => p !== user?.email);
  const otherSafeEmail = otherPerson ? otherPerson.replace(/\./g, '_') : '';
  const otherLastSeen = dmData?.activeUsers?.[otherSafeEmail];
  const isOnline = otherLastSeen && (new Date().getTime() - new Date(otherLastSeen).getTime() < 20000);

  const formatName = (email) => {
    if (!email) return '';
    const namePart = email.split('@')[0].split('.')[0].replace(/[0-9]/g, '');
    return namePart.charAt(0).toUpperCase() + namePart.slice(1);
  };

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
      height: 'calc(100vh - 120px)',
      transition: 'all 0.3s ease'
    }}>
      {!isFullScreen && (
        <div className="glass-panel" style={{ padding: '1rem 1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
              <ArrowLeft size={24} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '45px', height: '45px', borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(37, 99, 235, 0.2))',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--primary-color)', fontWeight: 'bold', fontSize: '1.2rem', flexShrink: 0
              }}>
                {otherPerson?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{formatName(otherPerson)}</h2>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  Direct Message
                  <span style={{ 
                    display: 'inline-block', 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%', 
                    background: isOnline ? 'var(--success-color)' : '#94a3b8', 
                    boxShadow: isOnline ? '0 0 8px var(--success-color)' : 'none',
                    marginLeft: '2px'
                  }} />
                  <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="glass-panel cyber-glow-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(37, 99, 235, 0.2))',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--primary-color)', fontWeight: 'bold', fontSize: '0.9rem', flexShrink: 0
                }}>
                  {otherPerson?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600' }}>{formatName(otherPerson)}</h3>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    Direct Message
                    <span style={{ 
                      display: 'inline-block', 
                      width: '6px', 
                      height: '6px', 
                      borderRadius: '50%', 
                      background: isOnline ? 'var(--success-color)' : '#94a3b8', 
                      boxShadow: isOnline ? '0 0 5px var(--success-color)' : 'none'
                    }} />
                    <span style={{ opacity: 0.8 }}>
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                  </p>
                </div>
              </div>
            </div>

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
        )}

        {/* DM Status Bar (Normal Mode) */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Status:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ 
                  display: 'inline-block', 
                  width: '7px', 
                  height: '7px', 
                  borderRadius: '50%', 
                  background: isOnline ? 'var(--success-color)' : '#94a3b8', 
                  boxShadow: isOnline ? '0 0 6px var(--success-color)' : 'none'
                }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: '500' }}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
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
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', zIndex: 10 }}>
          {dmData.messages?.map(msg => {
            const isMe = msg.sender === user?.email;
            const msgTime = new Date(msg.timestamp).getTime();
            const isNew = !isMe && msg.timestamp && msgTime > lastRead;
            
            const isImage = msg.fileName && msg.fileName.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i);
            const isImageOnly = isImage && !msg.text;
            
            return (
              <div 
                key={msg.id} 
                className={`drive-msg-container msg-wrapper ${isNew ? 'new-msg-glow' : ''}`}
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
                style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', position: 'relative', alignItems: 'flex-start' }}
              >
                
                <div className="drive-msg-bubble" style={{ 
                  background: isImageOnly ? 'transparent' : (isMe ? 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))' : 'var(--chat-bubble-incoming-bg)'), 
                  color: isMe ? '#fff' : 'var(--text-primary)',
                  border: isImageOnly ? 'none' : (isMe ? 'none' : '1px solid var(--chat-bubble-incoming-border)'),
                  padding: isImageOnly ? '0' : '0.5rem 0.75rem', 
                  borderRadius: '16px', 
                  borderBottomRightRadius: isMe ? '4px' : '16px',
                  borderBottomLeftRadius: !isMe ? '4px' : '16px',
                  maxWidth: isImageOnly ? '320px' : '65%',
                  width: isImageOnly ? '100%' : 'fit-content',
                  wordBreak: 'break-word',
                  boxShadow: isImageOnly ? 'none' : (isMe ? '0 4px 15px rgba(59, 130, 246, 0.3)' : 'var(--glass-shadow)'),
                  backdropFilter: isImageOnly ? 'none' : 'blur(8px)',
                  marginTop: '0.2rem',
                  position: 'relative'
                }}>
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
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ) : (
                    <div style={{ position: 'relative', display: 'block' }}>
                      <span className="msg-text" style={{ lineHeight: '1.4', color: 'inherit', wordBreak: 'break-word' }}>
                        {msg.text}
                        {msg.fileName && (
                          (() => {
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
                                      fontSize: '0.7rem',
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
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                  
                  {isNew && <span style={{ position: 'absolute', top: '-5px', right: '-5px', color: '#fff', fontWeight: 'bold', fontSize: '0.55rem', background: '#38bdf8', padding: '0.1rem 0.3rem', borderRadius: '4px', boxShadow: '0 0 5px #38bdf8' }}>NEW</span>}

                  {hoveredMsgId === msg.id && (
                    <div className={`msg-action-toolbar ${isMe ? 'is-me' : 'not-me'}`}>
                      <button onClick={() => setReplyToMsg(msg)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#38bdf8', padding: '0 0.3rem', fontWeight: 'bold' }}>Reply</button>
                      <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.2)', margin: '0 0.2rem' }} />
                      {['👍', '❤️', '😂'].map(emoji => (
                        <button key={emoji} onClick={() => handleReaction(msg.id, emoji)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '0 0.2rem', transition: 'transform 0.1s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>{emoji}</button>
                      ))}
                      <div style={{ position: 'relative' }}>
                        <button onClick={() => setShowReactionPickerId(showReactionPickerId === msg.id ? null : msg.id)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', fontSize: '0.9rem', color: '#fff', padding: '0.2rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '0.2rem' }}><Plus size={14} /></button>
                        {showReactionPickerId === msg.id && (
                          <div className="reaction-picker">
                            {['🎉', '🔥', '👀', '💯', '🙏'].map(emoji => (
                              <button key={emoji} onClick={() => handleReaction(msg.id, emoji)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0.2rem', transition: 'transform 0.1s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.3)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>{emoji}</button>
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

        <div className="glass-panel" style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', background: 'var(--navbar-bg)' }}>
        {dmData?.typing?.filter(e => e !== user.email).length > 0 && (
          <div style={{ fontSize: '0.75rem', color: '#38bdf8', padding: '0 0.5rem 0.5rem 0.5rem', fontStyle: 'italic', animation: 'fadeIn 0.3s' }}>
            {dmData.typing.filter(e => e !== user.email).map(e => e.split('@')[0]).join(', ')} is typing...
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
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.75rem', position: 'relative' }}>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
            <button type="button" onClick={() => fileInputRef.current.click()} className="btn btn-secondary" style={{ padding: '0.85rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Attach File">
              <Paperclip size={18} />
            </button>
            <input 
              type="text" 
              value={inputText}
              onChange={e => { setInputText(e.target.value); handleTyping(); }}
              placeholder="Type a message..."
              className="cyber-input"
              style={{ flex: 1, padding: '0.85rem 1.25rem', borderRadius: '30px' }}
            />
            <button type="submit" className="cyber-btn" style={{ padding: '0.85rem 1.25rem', borderRadius: '24px' }}>
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>

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
