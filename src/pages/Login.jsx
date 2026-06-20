import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Login() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { loginWithGoogle, loginWithEmail, signUp, resetPassword, logout, user } = useAuth();
  const navigate = useNavigate();
  // createUserWithEmailAndPassword auto-signs the new user in, which would
  // otherwise race this redirect and skip straight to the dashboard before
  // they ever see the "verification email sent" message - suppress it while
  // signup is wrapping up and signing them back out.
  const [skipAutoRedirect, setSkipAutoRedirect] = useState(false);

  // Navigate AFTER user state is fully set by onAuthStateChanged
  useEffect(() => {
    if (user && !skipAutoRedirect) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, skipAutoRedirect, navigate]);

  const handleGoogleSignIn = async () => {
    setError('');
    setSuccess('');
    setIsLoading(true);
    try {
      await loginWithGoogle();
      // navigation handled by useEffect when user state updates
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);
    try {
      await loginWithEmail(email, password);
      // navigation handled by useEffect when user state updates
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    setSkipAutoRedirect(true);
    try {
      await signUp(email, password);
      // signUp leaves the new account signed in client-side; sign back out
      // so they land on the sign-in form and actually see this message
      // instead of being whisked straight to the dashboard unverified.
      await logout();
      setSuccess('Account created! A verification email has been sent to your inbox. Please verify your email, then sign in below.');
      setMode('signin');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setSkipAutoRedirect(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);
    try {
      await resetPassword(email);
      setSuccess('Password reset email sent! Check your inbox and follow the link to reset your password.');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
  };

  const inputStyle = {
    width: '100%',
    padding: '0.85rem 1rem 0.85rem 2.75rem',
    // 16px floor: under that, iOS Safari auto-zooms the page on focus.
    fontSize: '1rem',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
    background: 'var(--input-bg)',
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'all 0.3s ease',
    boxSizing: 'border-box'
  };

  const iconStyle = {
    position: 'absolute',
    left: '0.85rem',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-secondary)',
    pointerEvents: 'none'
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'var(--bg-color)', position: 'relative', overflow: 'hidden' }}>
      
      {/* Decorative background elements */}
      <div className="floating-orb" style={{ position: 'absolute', top: '10%', left: '15%', width: 'min(80vw, 300px)', height: 'min(80vw, 300px)', background: 'var(--primary-color)', borderRadius: '50%', filter: 'blur(100px)', opacity: 0.25, zIndex: 0 }}></div>
      <div className="floating-orb" style={{ position: 'absolute', bottom: '15%', right: '15%', width: 'min(60vw, 250px)', height: 'min(60vw, 250px)', background: 'var(--accent-color)', borderRadius: '50%', filter: 'blur(100px)', opacity: 0.2, animationDelay: '-4s', zIndex: 0 }}></div>

      <motion.div 
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
        className="magic-border-container" 
        style={{ width: '100%', maxWidth: '440px', zIndex: 10, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
      >
        <div className="magic-border-content login-content-pad" style={{ textAlign: 'center' }}>
          
          {/* Logo */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
            <span className="cdc-logo-mark cdc-logo-mark-breathe" style={{ width: 84, height: 80 }} aria-hidden="true" />
          </div>
          <h1 style={{ marginBottom: '0.25rem', fontSize: '1.6rem', letterSpacing: '-0.5px' }}>NITK CDC Portal</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.75rem' }}>Career Development Center</p>
        
          {/* Alerts */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ color: 'var(--danger-color)', fontSize: '0.85rem', marginBottom: '1.25rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', textAlign: 'left' }}
              >
                {error}
              </motion.div>
            )}
            {success && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ color: '#34d399', fontSize: '0.85rem', marginBottom: '1.25rem', background: 'rgba(52, 211, 153, 0.1)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(52, 211, 153, 0.2)', textAlign: 'left' }}
              >
                {success}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Google Sign-In */}
          <button 
            onClick={handleGoogleSignIn} 
            disabled={isLoading}
            style={{ 
              width: '100%', padding: '0.85rem 1.5rem', fontSize: '0.95rem', fontWeight: '600',
              borderRadius: '10px', border: '1px solid var(--border-color)',
              background: 'linear-gradient(135deg, rgba(66, 133, 244, 0.15), rgba(66, 133, 244, 0.05))',
              color: 'var(--text-primary)', cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
              transition: 'all 0.3s ease', opacity: isLoading ? 0.7 : 1,
              boxShadow: '0 4px 15px rgba(66, 133, 244, 0.15)'
            }}
            onMouseOver={e => { if (!isLoading) { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(66, 133, 244, 0.25), rgba(66, 133, 244, 0.1))'; e.currentTarget.style.transform = 'translateY(-2px)'; }}}
            onMouseOut={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(66, 133, 244, 0.15), rgba(66, 133, 244, 0.05))'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Sign in with Google
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.5rem 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
          </div>

          {/* Email/Password Form */}
          <AnimatePresence mode="wait">
            {mode === 'signin' && (
              <motion.form 
                key="signin"
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleEmailSignIn}
                noValidate
              >
                <div style={{ position: 'relative', marginBottom: '0.85rem' }}>
                  <Mail size={16} style={iconStyle} />
                  <input 
                    type="email" placeholder="yourname@nitk.edu.in" value={email}
                    onChange={e => setEmail(e.target.value)} required
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>
                <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                  <Lock size={16} style={iconStyle} />
                  <input 
                    type={showPassword ? 'text' : 'password'} placeholder="Password" value={password}
                    onChange={e => setPassword(e.target.value)} required
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', padding: '0.25rem' }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <div style={{ textAlign: 'right', marginBottom: '1.25rem' }}>
                  <button type="button" onClick={() => switchMode('forgot')} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}>
                    Forgot password?
                  </button>
                </div>

                <button type="submit" disabled={isLoading} className="btn btn-primary" style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: isLoading ? 0.7 : 1 }}>
                  {isLoading ? 'Signing in...' : <><span>Sign In</span> <ArrowRight size={16} /></>}
                </button>

                <p style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Don't have an account?{' '}
                  <button type="button" onClick={() => switchMode('signup')} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.85rem', cursor: 'pointer', fontWeight: '600', padding: 0 }}>
                    Create one
                  </button>
                </p>
              </motion.form>
            )}

            {mode === 'signup' && (
              <motion.form 
                key="signup"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleSignUp}
                noValidate
              >
                <div style={{ position: 'relative', marginBottom: '0.85rem' }}>
                  <Mail size={16} style={iconStyle} />
                  <input 
                    type="email" placeholder="yourname@nitk.edu.in" value={email}
                    onChange={e => setEmail(e.target.value)} required
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>
                <div style={{ position: 'relative', marginBottom: '0.85rem' }}>
                  <Lock size={16} style={iconStyle} />
                  <input 
                    type={showPassword ? 'text' : 'password'} placeholder="Password (min 6 characters)" value={password}
                    onChange={e => setPassword(e.target.value)} required minLength={6}
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', padding: '0.25rem' }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
                  <Lock size={16} style={iconStyle} />
                  <input 
                    type={showPassword ? 'text' : 'password'} placeholder="Confirm password" value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)} required minLength={6}
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>

                <button type="submit" disabled={isLoading} className="btn btn-primary" style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: isLoading ? 0.7 : 1 }}>
                  {isLoading ? 'Creating account...' : <><span>Create Account</span> <ArrowRight size={16} /></>}
                </button>

                <p style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Already have an account?{' '}
                  <button type="button" onClick={() => switchMode('signin')} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.85rem', cursor: 'pointer', fontWeight: '600', padding: 0 }}>
                    Sign in
                  </button>
                </p>
              </motion.form>
            )}

            {mode === 'forgot' && (
              <motion.form 
                key="forgot"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleForgotPassword}
                noValidate
              >
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', textAlign: 'left' }}>
                  Enter your institutional email and we'll send you a link to reset your password.
                </p>
                <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
                  <Mail size={16} style={iconStyle} />
                  <input 
                    type="email" placeholder="yourname@nitk.edu.in" value={email}
                    onChange={e => setEmail(e.target.value)} required
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>

                <button type="submit" disabled={isLoading} className="btn btn-primary" style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: isLoading ? 0.7 : 1 }}>
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </button>

                <p style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <button type="button" onClick={() => switchMode('signin')} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.85rem', cursor: 'pointer', fontWeight: '600', padding: 0 }}>
                    ← Back to Sign In
                  </button>
                </p>
              </motion.form>
            )}
          </AnimatePresence>

          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '1.5rem' }}>
            Only students and staff with <strong>@nitk.edu.in</strong> accounts can access this platform.
          </div>
        </div>
      </motion.div>
    </div>
  );
}
