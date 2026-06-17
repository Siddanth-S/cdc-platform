import { db } from './firebase';
import { collection, getDocs, doc, setDoc, addDoc, getDoc } from 'firebase/firestore';

const INITIAL_DRIVES = [
  { id: 1, company: 'Google', role: 'Software Engineer', coordinator: 'student1@nitk.edu.in', secondarySpocs: [], joined: 120 },
  { id: 2, company: 'Microsoft', role: 'SDE Intern', coordinator: 'student2@nitk.edu.in', secondarySpocs: [], joined: 340 },
  { id: 3, company: 'Amazon', role: 'SDE Intern', coordinator: 'student3@nitk.edu.in', secondarySpocs: [], joined: 280 },
  { id: 4, company: 'Meta', role: 'Production Engineer', coordinator: 'student1@nitk.edu.in', secondarySpocs: [], joined: 150 },
  { id: 5, company: 'Apple', role: 'Hardware Engineer', coordinator: 'student4@nitk.edu.in', secondarySpocs: [], joined: 210 },
  { id: 6, company: 'Goldman Sachs', role: 'Analyst', coordinator: 'student5@nitk.edu.in', secondarySpocs: [], joined: 400 },
  { id: 7, company: 'Uber', role: 'Backend Engineer', coordinator: 'student6@nitk.edu.in', secondarySpocs: [], joined: 190 },
  { id: 8, company: 'Adobe', role: 'MTS-1', coordinator: 'student2@nitk.edu.in', secondarySpocs: [], joined: 220 },
  { id: 9, company: 'Oracle', role: 'Server Technology', coordinator: 'student7@nitk.edu.in', secondarySpocs: [], joined: 310 },
  { id: 10, company: 'Texas Instruments', role: 'Analog Engineer', coordinator: 'student8@nitk.edu.in', secondarySpocs: [], joined: 140 },
  { id: 11, company: 'Qualcomm', role: 'Firmware Engineer', coordinator: 'student9@nitk.edu.in', secondarySpocs: [], joined: 260 },
  { id: 12, company: 'Intel', role: 'Silicon Design', coordinator: 'student1@nitk.edu.in', secondarySpocs: [], joined: 180 },
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

export const seedDatabase = async () => {
  try {
    for (const drive of INITIAL_DRIVES) {
      const driveDocRef = doc(db, 'drives', String(drive.id));
      const docSnap = await getDoc(driveDocRef);
      if (!docSnap.exists()) {
        await setDoc(driveDocRef, drive);
        
        // Seed the welcome message in the group
        const msgsRef = collection(db, 'drives', String(drive.id), 'messages');
        await addDoc(msgsRef, {
          sender: 'head1@nitk.edu.in',
          role: 'HEAD',
          text: 'Welcome to the drive! Only admins and the assigned SPOC can post messages here.',
          timestamp: new Date().toISOString()
        });
      }
    }
    console.log("Drives check complete!");

    // Always seed DMs if empty
    const dmsRef = collection(db, 'dms');
    const dmsSnapshot = await getDocs(dmsRef);
    if (dmsSnapshot.empty) {
      for (const dm of INITIAL_DMS) {
        await setDoc(doc(db, 'dms', dm.id), dm);
      }
      console.log("DMs seeding complete!");
    }

  } catch (error) {
    console.error("Error seeding database:", error);
  }
};
