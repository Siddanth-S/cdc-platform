import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { formatName } from '../utils/profileParser';

export default function WelcomeToast({ user }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (user && !sessionStorage.getItem('has_seen_welcome')) {
      const timer = setTimeout(() => setShow(true), 400);
      const hide = setTimeout(() => {
        setShow(false);
        sessionStorage.setItem('has_seen_welcome', 'true');
      }, 4500);
      return () => { clearTimeout(timer); clearTimeout(hide); };
    }
  }, [user]);

  const name = formatName(user?.email) || 'User';
  const subtitle = user?.role === 'HEAD' ? 'Admin access active' : user?.role === 'COORDINATOR' ? 'SPOC duties loaded' : 'Your drives are ready';

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{
            width: '100%',
            overflow: 'hidden',
            background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.08), rgba(129, 140, 248, 0.08), rgba(56, 189, 248, 0.08))',
            borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
            cursor: 'pointer',
            animation: 'welcome-glow 2s ease-in-out infinite alternate'
          }}
          onClick={() => {
            setShow(false);
            sessionStorage.setItem('has_seen_welcome', 'true');
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
          }}>
            <Sparkles size={14} style={{ color: 'var(--primary-color)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-primary)' }}>
              Welcome back, {name}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              · {subtitle}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
