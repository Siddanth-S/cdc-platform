import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Send, ArrowLeft, Paperclip, X, User } from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

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
          setDmData(data);
        } else {
          navigate('/dashboard');
        }
      } else {
        navigate('/dashboard');
      }
    });

    return () => unsubscribe();
  }, [id, user, navigate]);

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
      msg.reactions[safeEmail] = emoji;
      
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

  const otherPerson = dmData.participants.find(p => p !== user.email);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <div className="glass-panel" style={{ padding: '1rem 1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
          <ArrowLeft size={24} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: 'var(--primary-color)', padding: '0.5rem', borderRadius: '50%', display: 'flex' }}>
             <User size={20} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{otherPerson?.split('@')[0]}</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Direct Message</p>
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
                onMouseEnter={() => setHoveredMsgId(msg.id)}
                onMouseLeave={() => setHoveredMsgId(null)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', animation: 'fadeIn 0.3s ease-out', position: 'relative' }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {msg.sender.split('@')[0]}
                  {isNew && <span style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '0.65rem' }}>NEW</span>}
                </div>
                
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flexDirection: isMe ? 'row-reverse' : 'row' }}>
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
                    backdropFilter: 'blur(8px)',
                    marginTop: '0.25rem'
                  }}>
                    {msg.replyTo && (
                      <div style={{ background: 'rgba(0,0,0,0.2)', borderLeft: '3px solid rgba(255,255,255,0.4)', padding: '0.4rem 0.6rem', borderRadius: '4px', marginBottom: '0.5rem', fontSize: '0.8rem', opacity: 0.8 }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '0.1rem' }}>{msg.replyTo.sender.split('@')[0]}</div>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.replyTo.text}</div>
                      </div>
                    )}
                    {msg.text && <div style={{ marginBottom: msg.fileName ? '0.5rem' : 0 }}>{msg.text}</div>}
                    {msg.fileName && (
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.5rem 0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                        <Paperclip size={14} />
                        <a href={msg.fileData} download={msg.fileName} style={{ color: 'inherit', textDecoration: 'underline' }}>{msg.fileName}</a>
                      </div>
                    )}
                  </div>

                  {hoveredMsgId === msg.id && (
                    <div style={{ 
                      display: 'flex', background: 'rgba(30, 41, 59, 0.9)', padding: '0.3rem', borderRadius: '20px', gap: '0.3rem', border: '1px solid rgba(255,255,255,0.1)', animation: 'fadeIn 0.2s', zIndex: 10,
                      position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                      [isMe ? 'right' : 'left']: 'calc(100% + 0.5rem)'
                    }}>
                      <button onClick={() => setReplyToMsg(msg)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#38bdf8', padding: '0 0.3rem' }}>Reply</button>
                      {['👍', '❤️', '🎉'].map(emoji => (
                        <button key={emoji} onClick={() => handleReaction(msg.id, emoji)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0 0.2rem' }}>{emoji}</button>
                      ))}
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
              <div style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>{replyToMsg.text}</div>
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
