/**
 * Employer options based on client type (PDA = Private/Corporate, GRZ = Government)
 */

// PDA (Private Direct Access) - Corporate/Private Sector Employers
export const PDA_EMPLOYERS = [
  "0.P CABINET",
  "BIA ZAMBIA LTD",
  "FIRST QUANTAUM MINERALS",
  "JACHRIS HOSE AND COUPLING Z(LTD)",
  "JVCHANTENTE",
  "KANSANSHI MINE",
  "KASCCO LTD",
  "KONKOLA COPPER MINE",
  "KWAME NKURUMA UNIVERSITY",
  "LIEBHERR ZAMBIA LIMITED",
  "LUANSHYA COPPER MINE",
  "LUBAMBE MINE",
  "LUMWANA MINE",
  "MCK MINING ZAMBIA LTD",
  "ME LONGTENG GRINDING MEDIA ZAMBIA LTD",
  "MINOR HOTELS ZAMBIA LTD",
  "MOPANI",
  "MULUNGUSHI UNIVERSITY",
  "NATIONAL ASSEMBLY",
  "NATIONAL ROADS FUND AGENCY",
  "QUATTRO LTD",
  "RADISSON BLU HOTEL",
  "ROAD DEVELOPMENT AGENCY",
  "SHOPRITE MZ",
  "SHOPRITE MX",
  "SPECIAL CLIENTS",
  "TOYOTA ZAMBIA",
  "TRADE KINGS",
  "TRIDENT LTD",
  "UNIVERSAL MINING",
  "ZAFFICO",
  "ZAMBEEF",
  "ZAMBIA AIR FORCE",
  "ZAMBIA AIRPORTS CORPORATION",
  "ZAMBIA ARMY",
  "ZAMBIA NATIONAL SERVICE",
  "ZAMBIA RAILWAYS",
  "ZAMBIA REVENUE AUTHORITY",
  "ZAMBIA SUGAR",
  "ZESCO",
  "ZISC LIFE",
  "ZSIC GENERAL",
];

// GRZ (Government Republic of Zambia) - Government Ministries & Departments
export const GRZ_EMPLOYERS = [
  "Cabinet Office",
  "Ministry of Education",
  "Ministry of Health",
  "Ministry of Finance and National Planning",
  "Ministry of Defence",
  "Ministry of Home Affairs and Internal Security",
  "Ministry of Foreign Affairs and International Cooperation",
  "Ministry of Justice",
  "Ministry of Local Government and Rural Development",
  "Ministry of Agriculture",
  "Ministry of Fisheries and Livestock",
  "Ministry of Lands and Natural Resources",
  "Ministry of Mines and Minerals Development",
  "Ministry of Energy",
  "Ministry of Transport and Logistics",
  "Ministry of Infrastructure, Housing and Urban Development",
  "Ministry of Water Development and Sanitation",
  "Ministry of Commerce, Trade and Industry",
  "Ministry of Tourism",
  "Ministry of Labour and Social Security",
  "Ministry of Community Development and Social Services",
  "Ministry of Youth, Sport and Arts",
  "Ministry of Small and Medium Enterprise Development",
  "Ministry of Science and Technology",
  "Ministry of Information and Media",
  "Ministry of Green Economy and Environment",
  "Ministry of Technology and Science",
  "Office of the Vice-President",
  "Office of the President",
  "National Assembly",
  "Judiciary",
  "Zambia Police Service",
  "Zambia Correctional Service",
  "Drug Enforcement Commission",
  "Immigration Department",
  "Anti-Corruption Commission",
  "Zambia Revenue Authority",
  "Public Service Management Division",
  "Teaching Service Commission",
  "Electoral Commission of Zambia",
  "Human Rights Commission",
  "Office of the Auditor General",
  "Public Protector",
];

// Occupation options for Ministry of Defence employees
export const MOD_OCCUPATIONS = [
  { value: "SOLDIER", label: "Soldier" },
  { value: "CONFIDENTIAL", label: "Confidential" },
];

// Default occupations for non-MOD employees
export const DEFAULT_OCCUPATIONS = [
  { value: "EMPLOYEE", label: "Employee" },
  { value: "MANAGER", label: "Manager" },
  { value: "DIRECTOR", label: "Director" },
  { value: "EXECUTIVE", label: "Executive" },
  { value: "PROFESSIONAL", label: "Professional" },
  { value: "TECHNICIAN", label: "Technician" },
  { value: "CLERICAL", label: "Clerical" },
  { value: "OTHER", label: "Other" },
];

// Client type codes
export const CLIENT_TYPES = {
  PDA: "PDA", // Private Direct Access
  GRZ: "GRZ", // Government Republic of Zambia
  SME: "SME", // Small and Medium Enterprise (no employers - they are the business)
};

// Helper function to get employers by client type
export function getEmployersByClientType(clientType: string | undefined): string[] {
  if (!clientType) return [...PDA_EMPLOYERS, ...GRZ_EMPLOYERS];
  
  const upperType = clientType.toUpperCase();
  
  // SME clients are businesses themselves - they don't have employers
  if (upperType === CLIENT_TYPES.SME || upperType.includes("SME") || upperType.includes("ENTERPRISE") || upperType.includes("BUSINESS")) {
    return [];
  }
  
  if (upperType === CLIENT_TYPES.PDA || upperType.includes("PDA") || upperType.includes("PRIVATE")) {
    return PDA_EMPLOYERS;
  }
  if (upperType === CLIENT_TYPES.GRZ || upperType.includes("GRZ") || upperType.includes("GOVERNMENT")) {
    return GRZ_EMPLOYERS;
  }
  
  // Return all if type not recognized
  return [...PDA_EMPLOYERS, ...GRZ_EMPLOYERS];
}

// Helper function to get occupations by employer
export function getOccupationsByEmployer(employer: string | undefined): { value: string; label: string }[] {
  if (!employer) return DEFAULT_OCCUPATIONS;
  
  const upperEmployer = employer.toUpperCase();
  if (
    upperEmployer.includes("MINISTRY OF DEFENCE") ||
    upperEmployer.includes("MINISTRY OF DEFENSE") ||
    upperEmployer === "MOD"
  ) {
    return MOD_OCCUPATIONS;
  }
  
  return DEFAULT_OCCUPATIONS;
}

// Check if employer is Ministry of Defence
export function isMinistryOfDefence(employer: string | undefined): boolean {
  if (!employer) return false;
  const upperEmployer = employer.toUpperCase();
  return (
    upperEmployer.includes("MINISTRY OF DEFENCE") ||
    upperEmployer.includes("MINISTRY OF DEFENSE") ||
    upperEmployer === "MOD"
  );
}

