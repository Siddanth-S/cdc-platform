import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

// Mock CDC Heads
const CDC_HEADS = [
  'head1@nitk.edu.in', 'head2@nitk.edu.in', 'head3@nitk.edu.in', 
  'head4@nitk.edu.in', 'head5@nitk.edu.in', 'head6@nitk.edu.in'
];

const INITIAL_DMS = [
  {
    id: 'dm_demo_1',
    participants: ['student1@nitk.edu.in', 'head1@nitk.edu.in'],
    messages: [
      { id: 1, sender: 'head1@nitk.edu.in', text: 'Have you sorted out the interview links for Google?', timestamp: new Date(Date.now() - 3600000).toISOString() },
      { id: 2, sender: 'student1@nitk.edu.in', text: 'Yes, just sent them out to the shortlisted candidates!', timestamp: new Date().toISOString() }
    ]
  },
  {
    id: 'dm_demo_2',
    participants: ['student9@nitk.edu.in', 'student3@nitk.edu.in'],
    messages: [
      { id: 1, sender: 'student9@nitk.edu.in', text: 'Hi, I had a doubt regarding the Amazon OA.', timestamp: new Date(Date.now() - 7200000).toISOString() },
      { id: 2, sender: 'student3@nitk.edu.in', text: 'Sure, what is your doubt? Im the secondary SPOC.', timestamp: new Date().toISOString() }
    ]
  }
];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('cdc_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const login = (email) => {
    if (!email.endsWith('@nitk.edu.in')) {
      throw new Error('Only @nitk.edu.in emails are allowed.');
    }
    
    let role = 'STUDENT';
    if (CDC_HEADS.includes(email)) {
      role = 'HEAD';
    }
    
    const newUser = { email, role };
    setUser(newUser);
    localStorage.setItem('cdc_user', JSON.stringify(newUser));

    const savedDms = localStorage.getItem('cdc_dms');
    if (!savedDms) {
      localStorage.setItem('cdc_dms', JSON.stringify(INITIAL_DMS));
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('cdc_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, CDC_HEADS }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
