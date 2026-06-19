import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCircle2, Circle } from 'lucide-react';
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export default function NotificationsDropdown() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch notifications
  useEffect(() => {
    if (!user?.email) return;

    const q = query(
      collection(db, 'notifications'),
      where('recipient', '==', user.email)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = [];
      snapshot.forEach(doc => notifs.push({ id: doc.id, ...doc.data() }));
      notifs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setNotifications(notifs);
    });

    return () => unsubscribe();
  }, [user?.email]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error("Error marking notification read", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      for (const n of unread) {
        await updateDoc(doc(db, 'notifications', n.id), { read: true });
      }
    } catch (err) {
      console.error("Error marking all read", err);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`logo-glow ${unreadCount > 0 ? 'logo-glow-pulse' : ''}`}
        style={{
          position: 'relative',
          background: isOpen ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.05)',
          border: '1px solid ' + (isOpen ? 'var(--primary-color)' : 'transparent'),
          color: 'var(--primary-color)',
          padding: '0.65rem',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          boxShadow: isOpen ? '0 0 15px rgba(59, 130, 246, 0.4)' : '0 0 8px rgba(59, 130, 246, 0.15)'
        }}
        onMouseOver={e => {
          if (!isOpen) {
            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(59, 130, 246, 0.4)';
            e.currentTarget.style.border = '1px solid var(--primary-color)';
          }
        }}
        onMouseOut={e => {
          if (!isOpen) {
            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)';
            e.currentTarget.style.boxShadow = '0 0 8px rgba(59, 130, 246, 0.15)';
            e.currentTarget.style.border = '1px solid transparent';
          }
        }}
      >
        <Bell size={24} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '0px', right: '0px',
            background: '#ef4444',
            color: '#fff',
            fontSize: '0.65rem',
            fontWeight: 'bold',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid var(--bg-color)',
            boxShadow: '0 0 10px rgba(239, 68, 68, 0.8)'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 0.5rem)',
              right: 0,
              width: '320px',
              maxWidth: 'calc(100vw - 2rem)',
              background: 'var(--dropdown-bg)',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              boxShadow: '0 10px 30px var(--glass-shadow), 0 0 20px rgba(59, 130, 246, 0.15)',
              overflow: 'hidden',
              zIndex: 100
            }}
          >
            <div style={{
              padding: '0.7rem 0.9rem',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: '600', color: 'var(--text-primary)' }}>Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} style={{
                  background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '500'
                }}>
                  Mark all as read
                </button>
              )}
            </div>

            <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  No notifications yet.
                </div>
              ) : (
                notifications.map(notif => (
                  <div 
                    key={notif.id}
                    onClick={() => !notif.read && markAsRead(notif.id)}
                    style={{
                      padding: '0.65rem 0.9rem',
                      borderBottom: '1px solid var(--border-color)',
                      display: 'flex',
                      gap: '0.6rem',
                      cursor: notif.read ? 'default' : 'pointer',
                      background: notif.read ? 'transparent' : 'rgba(59, 130, 246, 0.05)',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={e => !notif.read && (e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)')}
                    onMouseOut={e => !notif.read && (e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)')}
                  >
                    <div style={{ marginTop: '0.1rem', color: notif.read ? 'var(--text-secondary)' : 'var(--primary-color)' }}>
                      {notif.read ? <CheckCircle2 size={16} /> : <Circle size={16} fill="var(--primary-color)" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 0.2rem 0', fontSize: '0.8rem', color: notif.read ? 'var(--text-secondary)' : 'var(--text-primary)', lineHeight: '1.3' }}>
                        {notif.message}
                      </p>
                      <span style={{ fontSize: '0.66rem', color: 'var(--text-secondary)' }}>
                        {new Date(notif.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
