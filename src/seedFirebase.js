import { db } from './firebase';
import { collection, getDocs, doc, setDoc, addDoc, getDoc } from 'firebase/firestore';

const BTECH_BRANCHES = ['CSE', 'IT', 'AI', 'DS', 'ECE', 'EEE', 'MECH', 'CIVIL', 'CHEM', 'META', 'MINING'];
const PG_BRANCHES = ['MBA', 'MCA', 'Construction Tech & Management', 'Structural Eng', 'Power Electronics', 'Thermal Eng', 'Mechatronics', 'VLSI Design', 'Information Security'];

const ALL_BRANCHES = [...BTECH_BRANCHES, ...PG_BRANCHES];

const COMPANIES = [
  { name: 'Google', roles: ['Software Engineer', 'SDE Intern'], branches: ['CSE', 'IT', 'AI', 'DS', 'ECE', 'MCA'] },
  { name: 'Microsoft', roles: ['SDE Intern', 'Program Manager'], branches: ['CSE', 'IT', 'AI', 'DS', 'ECE', 'EEE', 'MCA'] },
  { name: 'Amazon', roles: ['SDE Intern', 'Business Analyst'], branches: ['CSE', 'IT', 'AI', 'DS', 'ECE', 'EEE', 'MECH', 'MBA', 'MCA'] },
  { name: 'Meta', roles: ['Production Engineer', 'Data Scientist'], branches: ['CSE', 'IT', 'AI', 'DS', 'ECE', 'MCA'] },
  { name: 'Apple', roles: ['Hardware Engineer', 'Silicon Design'], branches: ['ECE', 'EEE', 'VLSI Design', 'Power Electronics'] },
  { name: 'Goldman Sachs', roles: ['Analyst', 'Quant'], branches: ALL_BRANCHES },
  { name: 'Uber', roles: ['Backend Engineer', 'Data Analyst'], branches: ['CSE', 'IT', 'AI', 'DS', 'ECE', 'MCA'] },
  { name: 'Adobe', roles: ['MTS-1', 'Product Intern'], branches: ['CSE', 'IT', 'AI', 'DS'] },
  { name: 'Oracle', roles: ['Server Technology', 'Application Engineer'], branches: ['CSE', 'IT', 'AI', 'DS', 'ECE', 'EEE', 'MCA'] },
  { name: 'Texas Instruments', roles: ['Analog Engineer', 'Digital Design'], branches: ['ECE', 'EEE', 'VLSI Design', 'Power Electronics'] },
  { name: 'Qualcomm', roles: ['Firmware Engineer', 'Modem Systems'], branches: ['ECE', 'EEE', 'CSE', 'IT', 'VLSI Design'] },
  { name: 'Intel', roles: ['Silicon Architecture', 'Systems Engineer'], branches: ['ECE', 'EEE', 'MECH', 'VLSI Design'] },
  { name: 'Nvidia', roles: ['Deep Learning Engineer', 'GPU Architect'], branches: ['CSE', 'IT', 'AI', 'DS', 'ECE', 'VLSI Design'] },
  { name: 'AMD', roles: ['Physical Design Engineer', 'RTL Design'], branches: ['ECE', 'EEE', 'VLSI Design'] },
  { name: 'Cisco', roles: ['Network Engineer', 'Software Engineer'], branches: ['CSE', 'IT', 'ECE', 'EEE', 'Information Security'] },
  { name: 'L&T Construction', roles: ['Graduate Engineer Trainee', 'Site Engineer'], branches: ['CIVIL', 'MECH', 'Construction Tech & Management', 'Structural Eng'] },
  { name: 'Tata Motors', roles: ['Design Engineer', 'Manufacturing Trainee'], branches: ['MECH', 'EEE', 'Thermal Eng', 'Mechatronics'] },
  { name: 'Mahindra & Mahindra', roles: ['Automotive Engineer', 'Supply Chain Analyst'], branches: ['MECH', 'EEE', 'META', 'MBA'] },
  { name: 'Reliance Industries', roles: ['Process Engineer', 'Operations Manager'], branches: ['CHEM', 'MECH', 'CIVIL', 'EEE', 'MBA'] },
  { name: 'ITC', roles: ['Supply Chain Manager', 'FMCG Associate'], branches: ['MECH', 'CHEM', 'MBA'] },
  { name: 'Hindustan Unilever', roles: ['Management Trainee', 'Supply Chain'], branches: ['CHEM', 'MECH', 'MBA'] },
  { name: 'JPMC', roles: ['Software Engineer', 'Quantitative Analyst'], branches: ['CSE', 'IT', 'AI', 'DS', 'ECE', 'EEE', 'MCA', 'MBA'] },
  { name: 'Morgan Stanley', roles: ['Technology Analyst', 'Finance Analyst'], branches: ['CSE', 'IT', 'AI', 'DS', 'ECE', 'EEE', 'MCA', 'MBA'] },
  { name: 'Barclays', roles: ['BA3 Analyst', 'Risk Manager'], branches: ALL_BRANCHES },
  { name: 'Deutsche Bank', roles: ['Technology Graduate', 'Corporate Finance'], branches: ['CSE', 'IT', 'AI', 'DS', 'ECE', 'MCA', 'MBA'] },
  { name: 'McKinsey', roles: ['Business Analyst', 'Strategy Consultant'], branches: ALL_BRANCHES },
  { name: 'BCG', roles: ['Associate', 'Consultant'], branches: ALL_BRANCHES },
  { name: 'Bain & Company', roles: ['Associate Consultant'], branches: ALL_BRANCHES },
  { name: 'Deloitte', roles: ['Technology Consultant', 'Risk Advisory'], branches: ALL_BRANCHES },
  { name: 'PwC', roles: ['Consulting Associate', 'Data Analyst'], branches: ALL_BRANCHES },
  { name: 'KPMG', roles: ['Analyst', 'Tax Associate'], branches: ALL_BRANCHES },
  { name: 'EY', roles: ['Tech Consultant', 'Audit Trainee'], branches: ALL_BRANCHES },
  { name: 'Zomato', roles: ['SDE-1', 'Product Analyst'], branches: ['CSE', 'IT', 'AI', 'DS', 'ECE'] },
  { name: 'Swiggy', roles: ['SDE-1', 'Operations Manager'], branches: ['CSE', 'IT', 'AI', 'DS', 'ECE', 'MBA'] },
  { name: 'Cred', roles: ['Frontend Engineer', 'Backend Engineer'], branches: ['CSE', 'IT', 'AI', 'DS', 'ECE'] },
  { name: 'Razorpay', roles: ['SDE', 'Product Manager'], branches: ['CSE', 'IT', 'AI', 'DS', 'ECE', 'MBA'] },
  { name: 'Ola', roles: ['SDE-1', 'Mechanical Design'], branches: ['CSE', 'IT', 'AI', 'DS', 'ECE', 'MECH', 'Mechatronics'] },
  { name: 'Ather Energy', roles: ['Battery Engineer', 'Vehicle Dynamics'], branches: ['MECH', 'EEE', 'CHEM', 'Thermal Eng', 'Power Electronics'] },
  { name: 'ISRO', roles: ['Scientist/Engineer SC'], branches: ['CSE', 'ECE', 'MECH', 'CIVIL', 'EEE', 'CHEM', 'META'] },
  { name: 'DRDO', roles: ['Scientist B'], branches: ['CSE', 'ECE', 'MECH', 'CIVIL', 'EEE', 'CHEM', 'META'] },
  { name: 'ONGC', roles: ['AEE (Production)', 'AEE (Drilling)'], branches: ['MECH', 'CHEM', 'MINING'] },
  { name: 'Coal India', roles: ['Management Trainee (Mining)'], branches: ['MINING'] },
  { name: 'Tata Steel', roles: ['Management Trainee (Technical)'], branches: ['META', 'MECH', 'EEE', 'CHEM', 'MINING'] },
  { name: 'JSW Steel', roles: ['Graduate Engineer Trainee'], branches: ['META', 'MECH', 'EEE', 'CHEM'] },
  { name: 'Vedanta', roles: ['GET - Mining', 'GET - Metallurgy'], branches: ['MINING', 'META'] },
  { name: 'Schlumberger', roles: ['Field Engineer'], branches: ['MECH', 'EEE', 'CIVIL', 'CHEM', 'MINING'] },
  { name: 'Baker Hughes', roles: ['Field Specialist'], branches: ['MECH', 'EEE', 'CHEM', 'MINING'] },
  { name: 'ExxonMobil', roles: ['Data Scientist', 'Process Engineer'], branches: ['CHEM', 'MECH', 'CSE', 'AI', 'DS'] },
  { name: 'Shell', roles: ['Process Engineer', 'IT Graduate'], branches: ['CHEM', 'MECH', 'CSE', 'IT'] },
  { name: 'BP', roles: ['Energy Analyst', 'Mechanical Engineer'], branches: ['CHEM', 'MECH', 'MBA'] },
  { name: 'Airbus', roles: ['Aerodynamics Engineer', 'Avionics Engineer'], branches: ['MECH', 'ECE', 'EEE', 'CSE'] }
];

const MOCK_USERS = [
  'student1@nitk.edu.in', 'student2@nitk.edu.in', 'student3@nitk.edu.in', 'student4@nitk.edu.in', 'student5@nitk.edu.in',
  'siddanths.231cv149@nitk.edu.in', 'john.doe@nitk.edu.in', 'jane.doe@nitk.edu.in', 'test.user@nitk.edu.in', 'demo.student@nitk.edu.in'
];

const INITIAL_DMS = [
  {
    id: 'dm_demo_1',
    participants: ['siddanths.231cv149@nitk.edu.in', 'head1@nitk.edu.in'],
    messages: [
      { id: 1, sender: 'head1@nitk.edu.in', text: 'Have you sorted out the interview links for Google?', timestamp: new Date(Date.now() - 3600000).toISOString() },
      { id: 2, sender: 'siddanths.231cv149@nitk.edu.in', text: 'Yes, just sent them out to the shortlisted candidates!', timestamp: new Date().toISOString() }
    ]
  },
  {
    id: 'dm_demo_2',
    participants: ['siddanths.231cv149@nitk.edu.in', 'student3@nitk.edu.in'],
    messages: [
      { id: 1, sender: 'student3@nitk.edu.in', text: 'Hi, I had a doubt regarding the Amazon OA.', timestamp: new Date(Date.now() - 7200000).toISOString() },
      { id: 2, sender: 'siddanths.231cv149@nitk.edu.in', text: 'Sure, what is your doubt? Im the secondary SPOC.', timestamp: new Date().toISOString() }
    ]
  },
  {
    id: 'dm_demo_3',
    participants: ['siddanths.231cv149@nitk.edu.in', 'student5@nitk.edu.in'],
    messages: [
      { id: 1, sender: 'student5@nitk.edu.in', text: 'Hey Siddanth! Are you applying for the Goldman Sachs quant role?', timestamp: new Date(Date.now() - 86400000).toISOString() },
      { id: 2, sender: 'siddanths.231cv149@nitk.edu.in', text: 'Yeah, I just submitted my resume. Fingers crossed!', timestamp: new Date().toISOString() }
    ]
  }
];

export const seedDatabase = async () => {
  try {
    // Check if Firestore already has data — use a sentinel doc instead of localStorage
    const sentinelRef = doc(db, '_meta', 'seed_status');
    const sentinelSnap = await getDoc(sentinelRef);
    if (sentinelSnap.exists() && sentinelSnap.data().version === 'v3') {
      // Already seeded, do nothing
      return;
    }

    // Also check if drives collection already has 40+ docs (safety check)
    const drivesSnapshot = await getDocs(collection(db, 'drives'));
    if (drivesSnapshot.size >= 40) {
      // Mark as seeded and return
      await setDoc(sentinelRef, { version: 'v3', seededAt: new Date().toISOString() });
      return;
    }

    console.log("Seeding database with 51 companies...");

    // Seed drives (only add if doc doesn't already exist)
    let idCounter = 1;
    for (const company of COMPANIES) {
      const driveDocRef = doc(db, 'drives', String(idCounter));
      const existing = await getDoc(driveDocRef);
      
      if (!existing.exists()) {
        const branches = company.branches || BTECH_BRANCHES;
        const role = company.roles[Math.floor(Math.random() * company.roles.length)];
        
        const spocIndex = idCounter % MOCK_USERS.length;
        const sec1Index = (idCounter + 1) % MOCK_USERS.length;
        const sec2Index = (idCounter + 2) % MOCK_USERS.length;

        const driveData = {
          id: String(idCounter),
          company: company.name,
          role: role,
          coordinator: MOCK_USERS[spocIndex],
          secondarySpocs: [MOCK_USERS[sec1Index], MOCK_USERS[sec2Index]],
          joined: Math.floor(Math.random() * 400) + 50,
          eligibleBranches: branches
        };

        await setDoc(driveDocRef, driveData);

        // Seed the welcome message in the group
        const msgsRef = collection(db, 'drives', String(idCounter), 'messages');
        await addDoc(msgsRef, {
          sender: 'head1@nitk.edu.in',
          role: 'HEAD',
          text: `Welcome to the ${company.name} drive! Only admins and the assigned SPOCs can post messages here.`,
          timestamp: new Date().toISOString()
        });

        if (idCounter % 3 === 0) {
          await addDoc(msgsRef, {
            sender: MOCK_USERS[spocIndex],
            role: 'SPOC',
            text: `Hi everyone, I am the primary SPOC for ${company.name}. Please let me know if you have any questions!`,
            timestamp: new Date(Date.now() + 5000).toISOString()
          });
        }
      }

      idCounter++;
    }

    // Seed DMs (only if they don't exist)
    for (const dm of INITIAL_DMS) {
      const dmRef = doc(db, 'dms', dm.id);
      const dmSnap = await getDoc(dmRef);
      if (!dmSnap.exists()) {
        await setDoc(dmRef, dm);
      }
    }

    // Mark as seeded in Firestore
    await setDoc(sentinelRef, { version: 'v3', seededAt: new Date().toISOString() });
    console.log("Database seeded with 51 companies successfully!");

  } catch (error) {
    console.error("Error seeding database:", error);
  }
};
