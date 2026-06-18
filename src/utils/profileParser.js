export function parseEmailProfile(email) {
  if (!email) return null;
  
  const username = email.split('@')[0];
  const parts = username.split('.');
  if (parts.length < 2) {
    return { name: username, branch: '', gradYear: '' };
  }
  
  const namePart = parts[0];
  const rollSection = parts[parts.length - 1];
  
  // Parse roll section, e.g., 231cv149
  const joiningYearStr = rollSection.substring(0, 2);
  const joiningYear = parseInt(`20${joiningYearStr}`);
  
  const programCode = rollSection.substring(2, 3);
  let additionalYears = 4; // Default BTech
  if (['2', '4', '5', '6'].includes(programCode)) {
    additionalYears = 2; // MTech, MCA, MBA, MSc
  }
  
  const gradYear = isNaN(joiningYear) ? '' : joiningYear + additionalYears;
  
  const branchCode = rollSection.substring(3, 5).toLowerCase();
  const branchMap = {
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
    'sm': 'MBA',
    'ca': 'MCA'
  };
  
  const branch = branchMap[branchCode] || branchCode.toUpperCase();
  
  return {
    name: namePart.charAt(0).toUpperCase() + namePart.slice(1),
    branch,
    gradYear: gradYear.toString()
  };
}
