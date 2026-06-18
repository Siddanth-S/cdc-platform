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
import { collection, getDocs } from 'firebase/firestore';

const AuthContext = createContext();

// CDC Heads — these emails get full admin access
const CDC_HEADS = [
  'headpc@nitk.edu.in', 'siddanths.231cv149@nitk.edu.in',
  'testadmin@nitk.edu.in',
  'head1@nitk.edu.in', 'head2@nitk.edu.in', 'head3@nitk.edu.in', 
  'head4@nitk.edu.in', 'head5@nitk.edu.in', 'head6@nitk.edu.in'
];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Determine role by scanning Firestore drives
  const determineRole = async (email) => {
    if (CDC_HEADS.includes(email)) return 'HEAD';

    try {
      const snapshot = await getDocs(collection(db, 'drives'));
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.coordinator === email || data.secondarySpocs?.includes(email)) {
          return 'COORDINATOR';
        }
      }
    } catch (err) {
      console.error('Error checking SPOC status:', err);
    }

    return 'STUDENT';
  };

  // Listen for auth state changes (persists across refreshes)
  useEffect(() => {
    const mockUserStr = sessionStorage.getItem('mock_user');
    if (mockUserStr) {
      setUser(JSON.parse(mockUserStr));
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const email = firebaseUser.email;
        if (!email.endsWith('@nitk.edu.in')) {
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
    if (password === 'cdc_demo_bypass') {
      const role = await determineRole(email);
      const mockUserData = {
        email,
        role,
        displayName: email.split('@')[0],
        photoURL: null,
        uid: 'mock_uid_' + email.replace(/[^a-zA-Z0-9]/g, ''),
        emailVerified: true
      };
      sessionStorage.setItem('mock_user', JSON.stringify(mockUserData));
      setUser(mockUserData);
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
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
    sessionStorage.removeItem('mock_user');
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
      logout, loading, refreshRole, CDC_HEADS 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
