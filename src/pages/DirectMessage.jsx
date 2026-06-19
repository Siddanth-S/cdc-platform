import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Send, ArrowLeft, Paperclip, X, User, Plus } from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, deleteField } from 'firebase/firestore';
import { playSFX } from '../utils/sfx';

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
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <div className="glass-panel" style={{ padding: '1rem 1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
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

      <div className="glass-panel cyber-glow-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', zIndex: 10 }}>
          {dmData.messages?.map(msg => {
            const isMe = msg.sender === user?.email;
            const msgTime = new Date(msg.timestamp).getTime();
            const isNew = !isMe && msg.timestamp && msgTime > lastRead;
            
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
                  marginTop: '0.2rem',
                  position: 'relative'
                }}>
                  {msg.replyTo && (
                    <div style={{ background: 'rgba(0,0,0,0.2)', borderLeft: '3px solid rgba(255,255,255,0.4)', padding: '0.3rem 0.5rem', borderRadius: '4px', marginBottom: '0.3rem', fontSize: '0.75rem', opacity: 0.8 }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '0.1rem' }}>{formatName(msg.replyTo.sender)}</div>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.replyTo.text}</div>
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div className="msg-text" style={{ lineHeight: '1.3' }}>
                      {msg.text}
                      {msg.fileName && (
                        (() => {
                          const isImage = msg.fileName.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i);
                          const isPdf = msg.fileName.match(/\.pdf$/i);
                          const isExcel = msg.fileName.match(/\.(xls|xlsx|csv)$/i);

                          if (isImage) {
                            return (
                              <div style={{ marginTop: msg.text ? '0.5rem' : '0', overflow: 'hidden', borderRadius: '8px' }}>
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
                                  onClick={() => {
                                    playSFX('click');
                                    window.open(msg.fileData, '_blank');
                                  }}
                                />
                              </div>
                            );
                          } else if (isPdf) {
                            return (
                              <div style={{ 
                                marginTop: msg.text ? '0.5rem' : '0', 
                                background: 'rgba(239, 68, 68, 0.08)', 
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                padding: '0.6rem 0.85rem', 
                                borderRadius: '8px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                gap: '1rem',
                                fontSize: '0.85rem'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                                  <span style={{ fontSize: '1.2rem', color: '#f87171', fontWeight: 'bold' }}>📕</span>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }} title={msg.fileName}>
                                    {msg.fileName}
                                  </span>
                                </div>
                                <a 
                                  href={msg.fileData} 
                                  download={msg.fileName} 
                                  onClick={() => playSFX('click')}
                                  style={{ 
                                    color: '#f87171', 
                                    textDecoration: 'none', 
                                    fontWeight: 'bold',
                                    fontSize: '0.75rem',
                                    textTransform: 'uppercase',
                                    border: '1px solid rgba(239, 68, 68, 0.5)',
                                    padding: '0.2rem 0.5rem',
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
                                marginTop: msg.text ? '0.5rem' : '0', 
                                background: 'rgba(16, 185, 129, 0.08)', 
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                padding: '0.6rem 0.85rem', 
                                borderRadius: '8px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                gap: '1rem',
                                fontSize: '0.85rem'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                                  <span style={{ fontSize: '1.2rem', color: '#34d399', fontWeight: 'bold' }}>📊</span>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }} title={msg.fileName}>
                                    {msg.fileName}
                                  </span>
                                </div>
                                <a 
                                  href={msg.fileData} 
                                  download={msg.fileName} 
                                  onClick={() => playSFX('click')}
                                  style={{ 
                                    color: '#34d399', 
                                    textDecoration: 'none', 
                                    fontWeight: 'bold',
                                    fontSize: '0.75rem',
                                    textTransform: 'uppercase',
                                    border: '1px solid rgba(16, 185, 129, 0.5)',
                                    padding: '0.2rem 0.5rem',
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
                                marginTop: msg.text ? '0.5rem' : '0', 
                                background: 'rgba(96, 165, 250, 0.08)', 
                                border: '1px solid rgba(96, 165, 250, 0.3)',
                                padding: '0.6rem 0.85rem', 
                                borderRadius: '8px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                gap: '1rem',
                                fontSize: '0.85rem'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                                  <Paperclip size={14} className="text-primary" />
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }} title={msg.fileName}>
                                    {msg.fileName}
                                  </span>
                                </div>
                                <a 
                                  href={msg.fileData} 
                                  download={msg.fileName} 
                                  onClick={() => playSFX('click')}
                                  style={{ 
                                    color: 'var(--primary-color)', 
                                    textDecoration: 'none', 
                                    fontWeight: 'bold',
                                    fontSize: '0.75rem',
                                    textTransform: 'uppercase',
                                    border: '1px solid var(--primary-color)',
                                    padding: '0.2rem 0.5rem',
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
                    </div>
                    <div style={{ fontSize: '0.6rem', opacity: 0.7, textAlign: 'right', whiteSpace: 'nowrap', alignSelf: 'flex-end', marginBottom: '-2px' }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  
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
                      <span key={emoji} style={{ background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.1rem 0.4rem', fontSize: '0.75rem' }}>
                        {emoji} {count}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="glass-panel" style={{ padding: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(15, 23, 42, 0.6)' }}>
        {dmData?.typing?.filter(e => e !== user.email).length > 0 && (
          <div style={{ fontSize: '0.75rem', color: '#38bdf8', padding: '0 0.5rem 0.5rem 0.5rem', fontStyle: 'italic', animation: 'fadeIn 0.3s' }}>
            {dmData.typing.filter(e => e !== user.email).map(e => e.split('@')[0]).join(', ')} is typing...
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
    </div>
  );
}
