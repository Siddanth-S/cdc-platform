import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export default function WelcomeToast({ user }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => setShow(true), 400);
      const hide = setTimeout(() => setShow(false), 4500);
      return () => { clearTimeout(timer); clearTimeout(hide); };
    }
  }, [user?.uid]);

  const name = user?.displayName || user?.email?.split('@')[0] || 'User';

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          style={{
            position: 'fixed',
            top: '0.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            padding: '0.6rem 1.25rem',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4), 0 0 20px rgba(56, 189, 248, 0.1)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            maxWidth: 'calc(100vw - 2rem)'
          }}
          onClick={() => setShow(false)}
        >
          <Sparkles size={16} style={{ color: '#38bdf8', flexShrink: 0 }} />
          <div style={{ overflow: 'hidden' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#fff' }}>
              Welcome back, {name} ✨
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
              {user?.role === 'HEAD' ? '· Admin access active' : user?.role === 'COORDINATOR' ? '· SPOC duties loaded' : '· Your drives are ready'}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
