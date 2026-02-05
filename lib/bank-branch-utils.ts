/**
 * Bank and Branch Code Utilities
 * 
 * Banks are stored as code values in the "Bank" code.
 * Branches are stored as code values in the "BranchCode" code with format:
 *   "{bankCodeValueId}|{branchCode}|{branchName}"
 * 
 * This allows filtering branches by bank while keeping everything in Fineract.
 */

export interface Bank {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface Branch {
  id: number;
  bankId: number;
  code: string;
  name: string;
  rawName: string; // Original code value name
  isActive: boolean;
}

export interface BranchCodeValue {
  bankId: number;
  code: string;
  name: string;
}

// Code names in Fineract
export const BANK_CODE_NAME = "Bank";
export const BRANCH_CODE_NAME = "BranchCode";

// Additional banks that should always be included (even if not returned by Fineract API)
// These banks exist in Fineract but may be inactive/hidden
export const ADDITIONAL_BANKS: Bank[] = [
  {
    id: -1, // Placeholder ID - will be used for display only
    name: "ACCESS BANK",
    isActive: true,
  },
  {
    id: -2, // Placeholder ID - will be used for display only
    name: "STANDARD CHARTERED BANK",
    isActive: true,
  },
];

// Delimiter used in branch code value names
export const BRANCH_DELIMITER = "|";

/**
 * Parse a branch code value name into its components
 * Format: "{bankId}|{branchCode}|{branchName}"
 */
export function parseBranchCodeValue(codeValueName: string): BranchCodeValue | null {
  const parts = codeValueName.split(BRANCH_DELIMITER);
  if (parts.length < 3) {
    return null;
  }

  const bankId = parseInt(parts[0], 10);
  if (isNaN(bankId)) {
    return null;
  }

  return {
    bankId,
    code: parts[1],
    name: parts.slice(2).join(BRANCH_DELIMITER), // In case name contains delimiter
  };
}

/**
 * Create a branch code value name from components
 * Format: "{bankId}|{branchCode}|{branchName}"
 */
export function createBranchCodeValueName(bankId: number, branchCode: string, branchName: string): string {
  return `${bankId}${BRANCH_DELIMITER}${branchCode}${BRANCH_DELIMITER}${branchName}`;
}

/**
 * Filter branches by bank ID from a list of code values
 */
export function filterBranchesByBank(branchCodeValues: any[], bankId: number): Branch[] {
  return branchCodeValues
    .map((cv: any) => {
      const parsed = parseBranchCodeValue(cv.name);
      if (!parsed || parsed.bankId !== bankId) {
        return null;
      }
      return {
        id: cv.id,
        bankId: parsed.bankId,
        code: parsed.code,
        name: parsed.name,
        rawName: cv.name,
        isActive: cv.isActive !== false,
      };
    })
    .filter((b): b is Branch => b !== null);
}

/**
 * Convert bank code values to Bank objects
 * Augments the list with additional banks that may not be returned by Fineract API
 */
export function parseBanks(bankCodeValues: any[]): Bank[] {
  const banks = bankCodeValues.map((cv: any) => ({
    id: cv.id,
    name: cv.name,
    description: cv.description,
    isActive: cv.isActive !== false,
  }));

  // Add any additional banks that are not in the Fineract response
  for (const additionalBank of ADDITIONAL_BANKS) {
    const exists = banks.some(
      (b) => b.name.toUpperCase() === additionalBank.name.toUpperCase()
    );
    if (!exists) {
      banks.push(additionalBank);
    }
  }

  // Sort banks alphabetically by name
  return banks.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Convert all branch code values to Branch objects
 */
export function parseBranches(branchCodeValues: any[]): Branch[] {
  return branchCodeValues
    .map((cv: any) => {
      const parsed = parseBranchCodeValue(cv.name);
      if (!parsed) {
        return null;
      }
      return {
        id: cv.id,
        bankId: parsed.bankId,
        code: parsed.code,
        name: parsed.name,
        rawName: cv.name,
        isActive: cv.isActive !== false,
      };
    })
    .filter((b): b is Branch => b !== null);
}

/**
 * Get display name for a branch (code - name)
 */
export function getBranchDisplayName(branch: Branch): string {
  return `${branch.code} - ${branch.name}`;
}

/**
 * Validate branch code format
 */
export function validateBranchCode(code: string): boolean {
  // Branch code should be alphanumeric, optionally with hyphens
  return /^[A-Za-z0-9-]+$/.test(code);
}

