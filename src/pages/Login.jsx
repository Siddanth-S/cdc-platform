import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    try {
      login(email);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  // Mock CDC Head login helper
  const loginAsHead = () => {
    setEmail('head1@nitk.edu.in');
  }

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
        
        <form onSubmit={handleSubmit} style={{ marginTop: '2.5rem' }}>
          <div className="input-group" style={{ textAlign: 'left' }}>
            <label className="input-label" style={{ marginBottom: '0.5rem' }}>Institutional Email</label>
            <input 
              type="email" 
              className="input-field" 
              placeholder="siddanths.231cv149@nitk.edu.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          {error && (
            <div style={{ color: 'var(--danger-color)', fontSize: '0.875rem', marginBottom: '1.5rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              {error}
            </div>
          )}
          
          <button type="submit" className="btn btn-primary w-full" style={{ padding: '1rem', marginTop: '0.5rem', fontSize: '1.05rem' }}>
            Continue to Portal <ArrowRight size={18} />
          </button>
        </form>
        
        <div className="mt-4" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2rem' }}>
          Only students and staff with @nitk.edu.in emails can access this platform.
        </div>

        <button onClick={loginAsHead} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.7rem', textDecoration: 'underline', marginTop: '1.5rem', cursor: 'pointer' }}>
          Quick Login as CDC Head (Demo)
        </button>
        </div>
      </motion.div>
    </div>
  );
}
