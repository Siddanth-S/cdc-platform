import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBDSDHJ-I0dkAIQpipk8nuNasxl5qcySzU",
  authDomain: "cdcnitk.firebaseapp.com",
  projectId: "cdcnitk",
  storageBucket: "cdcnitk.firebasestorage.app",
  messagingSenderId: "7171781452",
  appId: "1:7171781452:web:6579859dbb5befe4a4d5e9",
  measurementId: "G-C2B5LNNEBY"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
