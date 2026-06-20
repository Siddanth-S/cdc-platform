import React, { createContext, useState, useContext, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  sendEmailVerification
} from 'firebase/auth';
import { auth, googleProvider, db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const AuthContext = createContext();

// CDC Heads — these emails get full admin access
const CDC_HEADS = [
  'headpc@nitk.edu.in', 'siddanths.231cv149@nitk.edu.in',
  'testadmin@nitk.edu.in',
  'head1@nitk.edu.in', 'head2@nitk.edu.in', 'head3@nitk.edu.in',
  'head4@nitk.edu.in', 'head5@nitk.edu.in', 'head6@nitk.edu.in'
];

// Exempted from the emailVerified gate below - internal test/admin account,
// not a real mailbox that can click a verification link.
const VERIFICATION_EXEMPT = ['testadmin@nitk.edu.in'];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Determine role via two targeted indexed queries instead of scanning every
  // drive - keeps login cost flat as the number of drives grows across
  // placement seasons, rather than growing with it.
  const determineRole = async (email) => {
    if (CDC_HEADS.includes(email)) return 'HEAD';

    try {
      const drivesRef = collection(db, 'drives');
      const [primarySnap, secondarySnap] = await Promise.all([
        getDocs(query(drivesRef, where('coordinator', '==', email))),
        getDocs(query(drivesRef, where('secondarySpocs', 'array-contains', email)))
      ]);
      if (!primarySnap.empty || !secondarySnap.empty) return 'COORDINATOR';
    } catch (err) {
      console.error('Error checking SPOC status:', err);
    }

    return 'STUDENT';
  };

  // Listen for auth state changes (persists across refreshes)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const email = firebaseUser.email;
        if (!email.endsWith('@nitk.edu.in')) {
          await signOut(auth);
          setUser(null);
          setLoading(false);
          return;
        }
        // Google sign-in is always pre-verified by Google; only email/password
        // accounts can land here unverified. Re-checked on every reload (not
        // just at sign-in) so a session started before this gate existed
        // can't keep working indefinitely.
        if (!firebaseUser.emailVerified && !VERIFICATION_EXEMPT.includes(email)) {
          await signOut(auth);
          setUser(null);
          setLoading(false);
          return;
        }
        const role = await determineRole(email);
        setUser({
          email,
          role,
          displayName: firebaseUser.displayName || email.split('@')[0],
          photoURL: firebaseUser.photoURL,
          uid: firebaseUser.uid,
          emailVerified: firebaseUser.emailVerified
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Google Sign-In
  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const email = result.user.email;

      if (!email.endsWith('@nitk.edu.in')) {
        await signOut(auth);
        throw new Error('Only @nitk.edu.in accounts can access this platform.');
      }
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in was cancelled.');
      }
      throw err;
    }
  };

  // Email/Password Sign Up
  const signUp = async (email, password) => {
    if (!email.endsWith('@nitk.edu.in')) {
      throw new Error('Only @nitk.edu.in emails are allowed.');
    }
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      // Send verification email
      await sendEmailVerification(result.user);
      return result;
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        throw new Error('An account with this email already exists. Try signing in instead.');
      }
      if (err.code === 'auth/weak-password') {
        throw new Error('Password must be at least 6 characters long.');
      }
      throw new Error(err.message);
    }
  };

  // Email/Password Sign In
  const loginWithEmail = async (email, password) => {
    if (!email.endsWith('@nitk.edu.in')) {
      throw new Error('Only @nitk.edu.in emails are allowed.');
    }
    let result;
    try {
      result = await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        throw new Error('Invalid email or password. Please try again.');
      }
      if (err.code === 'auth/wrong-password') {
        throw new Error('Invalid email or password. Please try again.');
      }
      if (err.code === 'auth/too-many-requests') {
        throw new Error('Too many failed attempts. Please try again later.');
      }
      throw new Error(err.message);
    }
    if (!result.user.emailVerified && !VERIFICATION_EXEMPT.includes(email)) {
      await signOut(auth);
      throw new Error('VERIFICATION_REQUIRED');
    }
  };

  // Resend the verification link - reuses the credentials already entered
  // on the sign-in form, since the account must already be signed out
  // (blocked by the emailVerified gate) to need this.
  const resendVerificationEmail = async (email, password) => {
    if (!email.endsWith('@nitk.edu.in')) {
      throw new Error('Only @nitk.edu.in emails are allowed.');
    }
    let result;
    try {
      result = await signInWithEmailAndPassword(auth, email, password);
    } catch {
      throw new Error('Could not sign in with those credentials to resend the link.');
    }
    if (result.user.emailVerified) {
      await signOut(auth);
      throw new Error('This email is already verified - just sign in normally.');
    }
    await sendEmailVerification(result.user);
    await signOut(auth);
  };

  // Forgot Password
  const resetPassword = async (email) => {
    if (!email.endsWith('@nitk.edu.in')) {
      throw new Error('Only @nitk.edu.in emails are allowed.');
    }
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        throw new Error('No account found with this email.');
      }
      throw new Error(err.message);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  // Allow re-checking role (e.g., after being assigned as SPOC)
  const refreshRole = async () => {
    if (user?.email) {
      const role = await determineRole(user.email);
      setUser(prev => ({ ...prev, role }));
    }
  };

  return (
    <AuthContext.Provider value={{
      user, loginWithGoogle, loginWithEmail, signUp, resetPassword,
      resendVerificationEmail, logout, loading, refreshRole, CDC_HEADS
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
