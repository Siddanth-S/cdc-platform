import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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
const db = getFirestore(app);

async function testFirebase() {
  try {
    console.log("Attempting to connect to Firestore...");
    const snapshot = await getDocs(collection(db, 'drives'));
    console.log("Success! Found", snapshot.docs.length, "documents.");
    snapshot.forEach(doc => {
      console.log(doc.id, "=>", doc.data());
    });
  } catch (error) {
    console.error("\nFIREBASE ERROR CAUGHT:");
    console.error(error.message);
  }
  process.exit();
}

testFirebase();
