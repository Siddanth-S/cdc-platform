import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export default function WelcomeToast({ user }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (user) {
      // Small delay so the dashboard renders first
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
          initial={{ opacity: 0, y: -60, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -40, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          style={{
            position: 'fixed',
            top: '5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            padding: '1rem 2rem',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 40px rgba(56, 189, 248, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            cursor: 'pointer',
            maxWidth: '90vw'
          }}
          onClick={() => setShow(false)}
        >
          <div style={{
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(129, 140, 248, 0.2))',
            padding: '0.5rem',
            borderRadius: '10px',
            display: 'flex',
            border: '1px solid rgba(56, 189, 248, 0.2)'
          }}>
            <Sparkles size={20} style={{ color: '#38bdf8' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#fff', letterSpacing: '-0.3px' }}>
              Welcome back, {name} ✨
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
              {user?.role === 'HEAD' ? 'Admin access active' : user?.role === 'COORDINATOR' ? 'SPOC duties loaded' : 'Your drives are ready'}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
