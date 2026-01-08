/**
 * Bank Branch Data for Zambia
 * This data is used to filter branch codes and names based on selected bank
 */

export interface BankBranch {
  bankName: string;
  branchCode: string;
  branchName: string;
}

// Bank branch data from Zambian banks - exact data from official list
export const bankBranchData: BankBranch[] = [
  {
    bankName: "AB BANK",
    branchCode: "211109",
    branchName: "Chipata",
  },
  {
    bankName: "AB BANK",
    branchCode: "210108",
    branchName: "Ndola",
  },
  {
    bankName: "AB BANK",
    branchCode: "210207",
    branchName: "Kitwe",
  },
  {
    bankName: "AB BANK",
    branchCode: "210010",
    branchName: "Corporate",
  },
  {
    bankName: "AB BANK",
    branchCode: "210006",
    branchName: "Garden Branch",
  },
  {
    bankName: "AB BANK",
    branchCode: "210005",
    branchName: "Chelston",
  },
  {
    bankName: "AB BANK",
    branchCode: "210004",
    branchName: "Kalingalinga Branch",
  },
  {
    bankName: "AB BANK",
    branchCode: "210003",
    branchName: "Matero",
  },
  {
    bankName: "AB BANK",
    branchCode: "210000",
    branchName: "Head Office",
  },
  {
    bankName: "AB BANK",
    branchCode: "210002",
    branchName: "Chilenje",
  },
  {
    bankName: "AB BANK",
    branchCode: "210001",
    branchName: "Cairo Main Branch",
  },
  {
    bankName: "ABSA BANK",
    branchCode: "025247",
    branchName: "Chambishi",
  },
  {
    bankName: "ABSA BANK",
    branchCode: "025334",
    branchName: "Mumbwa",
  },
  {
    bankName: "ABSA BANK",
    branchCode: "024928",
    branchName: "Katete",
  },
  {
    bankName: "ABSA BANK",
    branchCode: "024637",
    branchName: "Chongwe",
  },
  {
    bankName: "ABSA BANK",
    branchCode: "024330",
    branchName: "Petauke",
  },
  {
    bankName: "ABSA BANK",
    branchCode: "023724",
    branchName: "Monze",
  },
  {
    bankName: "ABSA BANK",
    branchCode: "024127",
    branchName: "Kalumbila",
  },
  {
    bankName: "ABSA BANK",
    branchCode: "023621",
    branchName: "Mazabuka",
  },
  {
    bankName: "ABSA BANK",
    branchCode: "023542",
    branchName: "Chirundu",
  },
  {
    bankName: "ABSA BANK",
    branchCode: "023407",
    branchName: "Kafue",
  },
  {
    bankName: "ABSA BANK",
    branchCode: "022829",
    branchName: "Solwezi",
  },
  {
    bankName: "ABSA BANK",
    branchCode: "023135",
    branchName: "Mongu",
  },
  {
    bankName: "ABSA BANK",
    branchCode: "022622",
    branchName: "Mfuwe",
  },
  {
    bankName: "ABSA BANK",
    branchCode: "022531",
    branchName: "Lundazi",
  },
  {
    bankName: "ABSA BANK",
    branchCode: "022338",
    branchName: "Mkushi",
  },
  {
    bankName: "ABSA BANK",
    branchCode: "022411",
    branchName: "Kapiri Mposhi",
  },
  {
    bankName: "ABSA BANK",
    branchCode: "021920",
    branchName: "Mansa",
  },
  {
    bankName: "ABSA BANK",
    branchCode: "021845",
    branchName: "Mpika",
  },
  {
    bankName: "ABSA BANK",
    branchCode: "021540",
    branchName: "Nakonde",
  },
  {
    bankName: "ABSA BANK",
    branchCode: "021451",
    branchName: "Cosmopolitan",
  },
  {
    bankName: "ABSA BANK",
    branchCode: "021205",
    branchName: "Choma",
  },
  {
    bankName: "ABSA BANK",
    branchCode: "021104",
    branchName: "Chipata, Katete & Petauke",
  },
  {
    bankName: "ABSA BANK",
    branchCode: "020906",
    branchName: "Kabwe & Prestige",
  },
  {
    bankName: "ABSA BANK",
    branchCode: "021012",
    branchName: "Livingstone",
  },
  {
    bankName: "ABSA BANK",
    branchCode: "020832",
    branchName: "Kasama",
  },
];

/**
 * Get unique bank names from the data
 */
export function getUniqueBanks(): string[] {
  const banks = new Set(bankBranchData.map((b) => b.bankName));
  return Array.from(banks).sort();
}

/**
 * Get branches for a specific bank
 * @param bankName - The bank name to filter by (can be partial match)
 */
export function getBranchesForBank(bankName: string): BankBranch[] {
  if (!bankName) return [];

  const normalizedBankName = bankName.toLowerCase().trim();

  // Try exact match first
  let branches = bankBranchData.filter(
    (b) => b.bankName.toLowerCase() === normalizedBankName
  );

  // If no exact match, try partial match
  if (branches.length === 0) {
    branches = bankBranchData.filter(
      (b) =>
        b.bankName.toLowerCase().includes(normalizedBankName) ||
        normalizedBankName.includes(b.bankName.toLowerCase())
    );
  }

  // If still no match, try matching key words
  if (branches.length === 0) {
    const keywords = normalizedBankName
      .split(/\s+/)
      .filter((k) => k.length > 2);
    branches = bankBranchData.filter((b) => {
      const bankLower = b.bankName.toLowerCase();
      return keywords.some((keyword) => bankLower.includes(keyword));
    });
  }

  return branches;
}

/**
 * Find bank branch by branch code
 * @param bankName - The bank name
 * @param branchCode - The branch code
 */
export function findBranchByCode(
  bankName: string,
  branchCode: string
): BankBranch | undefined {
  const branches = getBranchesForBank(bankName);
  return branches.find((b) => b.branchCode === branchCode);
}

/**
 * Find bank branch by branch name
 * @param bankName - The bank name
 * @param branchName - The branch name (can be partial match)
 */
export function findBranchByName(
  bankName: string,
  branchName: string
): BankBranch | undefined {
  const branches = getBranchesForBank(bankName);
  const normalizedName = branchName.toLowerCase().trim();

  // Try exact match first
  let branch = branches.find(
    (b) => b.branchName.toLowerCase() === normalizedName
  );

  // If no exact match, try partial match
  if (!branch) {
    branch = branches.find(
      (b) =>
        b.branchName.toLowerCase().includes(normalizedName) ||
        normalizedName.includes(b.branchName.toLowerCase())
    );
  }

  return branch;
}

/**
 * Match a Fineract bank name to our local data
 * Fineract might have slightly different naming
 */
export function matchFineractBankName(fineractBankName: string): string | null {
  if (!fineractBankName) return null;

  const normalized = fineractBankName.toLowerCase().trim();
  const banks = getUniqueBanks();

  // Try exact match
  const exactMatch = banks.find((b) => b.toLowerCase() === normalized);
  if (exactMatch) return exactMatch;

  // Try contains match
  const containsMatch = banks.find(
    (b) =>
      b.toLowerCase().includes(normalized) ||
      normalized.includes(b.toLowerCase())
  );
  if (containsMatch) return containsMatch;

  // Try keyword match (match first significant word)
  const keywords = normalized
    .split(/\s+/)
    .filter(
      (k) =>
        k.length > 2 &&
        !["the", "and", "ltd", "plc", "limited", "bank"].includes(k)
    );

  for (const keyword of keywords) {
    const keywordMatch = banks.find((b) => b.toLowerCase().includes(keyword));
    if (keywordMatch) return keywordMatch;
  }

  return null;
}
