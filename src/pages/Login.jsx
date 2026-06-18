import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login() {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    setError('');
    setIsLoading(true);
    try {
      await login();
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'var(--bg-color)', position: 'relative', overflow: 'hidden' }}>
      
      {/* Decorative background elements */}
      <div className="floating-orb" style={{ position: 'absolute', top: '10%', left: '15%', width: '300px', height: '300px', background: 'var(--primary-color)', borderRadius: '50%', filter: 'blur(100px)', opacity: 0.25, zIndex: 0 }}></div>
      <div className="floating-orb" style={{ position: 'absolute', bottom: '15%', right: '15%', width: '250px', height: '250px', background: 'var(--accent-color)', borderRadius: '50%', filter: 'blur(100px)', opacity: 0.2, animationDelay: '-4s', zIndex: 0 }}></div>

      <motion.div 
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
        className="magic-border-container" 
        style={{ width: '100%', maxWidth: '440px', zIndex: 10, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
      >
        <div className="magic-border-content" style={{ padding: '3.5rem 2.5rem', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div className="logo-glow" style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '1.25rem', borderRadius: '50%', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
              <GraduationCap size={48} className="text-primary" />
            </div>
          </div>
        
        <h1 style={{ marginBottom: '0.5rem', fontSize: '1.75rem', letterSpacing: '-0.5px' }}>NITK CDC Portal</h1>
        <p className="mb-4 text-secondary">Career Development Center</p>
        
        <div style={{ marginTop: '2.5rem' }}>
          {error && (
            <div style={{ color: 'var(--danger-color)', fontSize: '0.875rem', marginBottom: '1.5rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              {error}
            </div>
          )}
          
          <button 
            onClick={handleGoogleSignIn} 
            disabled={isLoading}
            style={{ 
              width: '100%', 
              padding: '1rem 1.5rem', 
              fontSize: '1.05rem', 
              fontWeight: '600',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'linear-gradient(135deg, rgba(66, 133, 244, 0.15), rgba(66, 133, 244, 0.05))',
              color: '#fff',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              transition: 'all 0.3s ease',
              opacity: isLoading ? 0.7 : 1,
              boxShadow: '0 4px 15px rgba(66, 133, 244, 0.15)'
            }}
            onMouseOver={e => { if (!isLoading) { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(66, 133, 244, 0.25), rgba(66, 133, 244, 0.1))'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(66, 133, 244, 0.3)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}}
            onMouseOut={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(66, 133, 244, 0.15), rgba(66, 133, 244, 0.05))'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(66, 133, 244, 0.15)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {/* Google "G" logo */}
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            {isLoading ? 'Signing in...' : 'Sign in with Google'}
          </button>
        </div>
        
        <div className="mt-4" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2rem' }}>
          Only students and staff with <strong>@nitk.edu.in</strong> Google accounts can access this platform.
        </div>
        </div>
      </motion.div>
    </div>
  );
}
