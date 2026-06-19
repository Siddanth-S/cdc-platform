// Derives a readable display name from an email's local part. NITK emails
// are "name.rollnumber@..." so splitting on the first dot already drops the
// roll number - digits are NOT stripped beyond that. Stripping all digits
// (as earlier copies of this logic across the app used to do) collapses
// distinct accounts that don't follow that pattern - e.g. test logins like
// demo1@ and demo2@ - into the same displayed name.
export function formatName(email) {
  if (!email) return '';
  const namePart = email.split('@')[0].split('.')[0];
  return namePart.charAt(0).toUpperCase() + namePart.slice(1);
}

export function parseEmailProfile(email) {
  if (!email) return null;

  const username = email.split('@')[0];
  const parts = username.split('.');
  if (parts.length < 2) {
    return { name: formatName(email), degree: '', branch: '', gradYear: '' };
  }

  const rollSection = parts[parts.length - 1];
  
  // Parse roll section, e.g., 231cv149
  const joiningYearStr = rollSection.substring(0, 2);
  const joiningYear = parseInt(`20${joiningYearStr}`);
  
  const programCode = rollSection.substring(2, 3);
  
  let additionalYears = 4; // Default BTech
  let degree = 'B.Tech';

  if (programCode === '1') {
    additionalYears = 4;
    degree = 'B.Tech';
  } else if (programCode === '2' || programCode === '3') {
    additionalYears = 2;
    degree = 'M.Tech';
  } else if (programCode === '4') {
    additionalYears = 2;
    degree = 'MCA';
  } else if (programCode === '5') {
    additionalYears = 2;
    degree = 'MBA';
  } else if (programCode === '6') {
    additionalYears = 2;
    degree = 'MSc';
  }

  const gradYear = isNaN(joiningYear) ? '' : joiningYear + additionalYears;
  
  const branchCode = rollSection.substring(3, 5).toLowerCase();
  
  const branchMap = {
    // B.Tech
    'cs': 'CSE',
    'it': 'IT',
    'ai': 'AI',
    'ds': 'DS',
    'ec': 'ECE',
    'ee': 'EEE',
    'me': 'MECH',
    'cv': 'CIVIL',
    'ch': 'CHEM',
    'mt': 'META',
    'mn': 'MINING',
    // PG
    'cm': 'Construction Tech & Management',
    'sm': 'MBA',
    'en': 'Environmental Eng',
    'gt': 'Geotechnical Eng',
    'ts': 'Transportation Eng',
    'st': 'Structural Eng',
    'pe': 'Power Electronics',
    'md': 'Mechanical Design',
    'th': 'Thermal Eng',
    'mf': 'Manufacturing Eng',
    'mc': 'Mechatronics',
    'wr': 'Water Resources',
    'ms': 'Marine Structures',
    'gf': 'Geoinformatics',
    'ca': 'MCA',
    'cy': 'Chemistry',
    'ph': 'Physics',
    'sp': 'Signal Processing & ML',
    'cn': 'Communication Eng & Networks',
    'vl': 'VLSI Design',
    'is': 'Information Security',
    'ib': 'Industrial Biotechnology',
    'es': 'Environmental Science & Tech',
    'ml': 'Materials Eng',
    'nt': 'Nanotechnology'
  };
  
  const branch = branchMap[branchCode] || branchCode.toUpperCase();
  
  return {
    name: formatName(email),
    degree,
    branch,
    gradYear: gradYear.toString()
  };
}
