import React, { createContext, useState, useContext, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider, db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

const AuthContext = createContext();

// CDC Heads — these emails get full admin access
const CDC_HEADS = [
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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const email = firebaseUser.email;
        if (!email.endsWith('@nitk.edu.in')) {
          // Not a college email — sign them out immediately
          await signOut(auth);
          setUser(null);
          setLoading(false);
          return;
        }
        const role = await determineRole(email);
        setUser({
          email,
          role,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          uid: firebaseUser.uid
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const email = result.user.email;

      if (!email.endsWith('@nitk.edu.in')) {
        await signOut(auth);
        throw new Error('Only @nitk.edu.in accounts can access this platform.');
      }
      // onAuthStateChanged will handle setting the user
    } catch (err) {
      // Re-throw so Login.jsx can display the error
      if (err.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in was cancelled.');
      }
      throw err;
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    // Clear any localStorage read receipts for this session
  };

  // Allow re-checking role (e.g., after being assigned as SPOC)
  const refreshRole = async () => {
    if (user?.email) {
      const role = await determineRole(user.email);
      setUser(prev => ({ ...prev, role }));
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, refreshRole, CDC_HEADS }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
