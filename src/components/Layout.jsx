import { Outlet, useNavigate, useLocation, useOutlet } from 'react-router-dom';
import Navbar from './Navbar';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MessageSquare, Menu, X, ChevronLeft, MessageCircle } from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';
import WelcomeToast from './WelcomeToast';

export default function Layout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const element = useOutlet();
  const mainContentRef = useRef(null);
  const [dms, setDms] = useState([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);

  useEffect(() => {
    if (!user?.email) return;

    // Use Firebase Real-time Listener for DMs where user is a participant
    const q = query(collection(db, 'dms'), where('participants', 'array-contains', user.email));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dmsData = [];
      snapshot.forEach(doc => {
        dmsData.push({ id: doc.id, ...doc.data() });
      });
      // Sort by latest message timestamp if possible
      dmsData.sort((a, b) => {
        const lastA = a.messages?.[a.messages.length - 1]?.timestamp || 0;
        const lastB = b.messages?.[b.messages.length - 1]?.timestamp || 0;
        return new Date(lastB) - new Date(lastA);
      });
      setDms(dmsData);
    });

    return () => unsubscribe();
  }, [user]);

  // Close sidebar on navigation on mobile
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location]);

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Navbar />
      <WelcomeToast user={user} />
      
      {/* Mobile Toggle Bar */}
      <div className="mobile-toggle" style={{ padding: '0.5rem 1rem', display: 'none', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MessageSquare size={16} className="text-primary" /> Direct Messages
        </span>
        <button onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)' }}>
          {mobileSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <div className="app-body" style={{ display: 'flex', flex: 1, overflow: 'hidden', width: '100%', position: 'relative' }}>
        
        {/* Floating Action Button when sidebar is closed on desktop */}
        {!desktopSidebarOpen && (
          <button 
            className="cyber-fab animate-fade-in"
            onClick={() => setDesktopSidebarOpen(true)}
          >
            <MessageCircle size={20} />
            <span>Open Chats</span>
          </button>
        )}

        {/* Left Sidebar for Chats */}
        <div className={`sidebar cyber-sidebar ${mobileSidebarOpen ? 'mobile-open' : ''} ${!desktopSidebarOpen ? 'desktop-closed' : ''}`} style={{ margin: '0 1rem 1rem 1rem', borderRadius: '16px', height: '100%' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', fontSize: '1.1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <MessageSquare size={20} className="text-primary" /> Direct Messages
            </div>
            <button 
              className="desktop-close-btn"
              onClick={() => setDesktopSidebarOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', padding: '0.25rem', borderRadius: '4px', transition: 'background 0.2s' }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseOut={e => e.currentTarget.style.background = 'none'}
              title="Collapse Sidebar"
            >
              <ChevronLeft size={20} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
            {dms.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                No active chats yet. Click on a Secondary SPOC in a drive to message them.
              </div>
            ) : (
              dms.map(dm => {
                const otherPerson = dm.participants.find(p => p !== user?.email);
                const isActive = location.pathname === `/dm/${dm.id}`;
                const lastMessage = dm.messages.length > 0 ? dm.messages[dm.messages.length - 1] : null;
                const lastRead = Number(localStorage.getItem(`read_dm_${dm.id}_${user?.email}`) || 0);
                const isUnread = lastMessage && lastMessage.sender !== user?.email && new Date(lastMessage.timestamp).getTime() > lastRead && !isActive;

                return (
                  <div 
                    key={dm.id} 
                    className={`cyber-dm-item ${isActive ? 'active' : ''}`}
                    onClick={() => navigate(`/dm/${dm.id}`)}
                    style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem' }}
                  >
                    <div style={{
                      width: '45px', height: '45px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(37, 99, 235, 0.2))',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--primary-color)', fontWeight: 'bold', fontSize: '1.2rem', flexShrink: 0
                    }}>
                      {otherPerson?.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: isUnread ? '800' : '600', color: isUnread ? '#fff' : (isActive ? 'var(--primary-color)' : 'var(--text-primary)'), marginBottom: '0.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{otherPerson?.split('@')[0]}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                          {lastMessage && <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>
                            {new Date(lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>}
                          {isUnread && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 10px #38bdf8' }} />}
                        </div>
                      </div>
                      {lastMessage && (
                        <div style={{ fontSize: '0.8rem', color: isUnread ? '#e2e8f0' : 'var(--text-secondary)', fontWeight: isUnread ? '600' : '400', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <span style={{ color: lastMessage.sender === user?.email ? 'var(--primary-color)' : 'inherit', fontWeight: '500' }}>
                            {lastMessage.sender === user?.email ? 'You: ' : ''}
                          </span>
                          {lastMessage.text || '📎 Attachment'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <main className="main-content" style={{ overflow: 'hidden', padding: 0 }} ref={mainContentRef}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{ height: '100%', width: '100%', overflowY: 'auto', padding: '1.5rem 1.5rem 2rem 1.5rem' }}
            >
              {element}
            </motion.div>
          </AnimatePresence>
        </main>

      </div>
    </div>
  );
}
