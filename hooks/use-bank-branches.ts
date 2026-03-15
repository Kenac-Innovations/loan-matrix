"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BANK_CODE_NAME,
  BRANCH_CODE_NAME,
  parseBranchCodeValue,
  parseBanks,
  Bank,
  Branch,
} from "@/lib/bank-branch-utils";

interface UseBankBranchesOptions {
  /** Fetch on mount */
  fetchOnMount?: boolean;
  /** Include inactive banks/branches */
  includeInactive?: boolean;
}

interface UseBankBranchesReturn {
  /** List of all banks */
  banks: Bank[];
  /** List of all branches (unfiltered) */
  allBranches: Branch[];
  /** Get branches filtered by bank ID */
  getBranchesForBank: (bankId: number) => Branch[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh the data */
  refresh: () => Promise<void>;
  /** Currently selected bank ID */
  selectedBankId: number | null;
  /** Set the selected bank ID */
  setSelectedBankId: (bankId: number | null) => void;
  /** Branches for the currently selected bank */
  selectedBankBranches: Branch[];
}

/**
 * Hook for managing bank and branch dropdowns with dependent filtering
 */
export function useBankBranches(
  options: UseBankBranchesOptions = {}
): UseBankBranchesReturn {
  const { fetchOnMount = true, includeInactive = false } = options;

  const [banks, setBanks] = useState<Bank[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch banks and branches in parallel
      const [banksResponse, branchesResponse] = await Promise.all([
        fetch(
          `/api/fineract/codes/${BANK_CODE_NAME}/codevalues${
            includeInactive ? "?includeInactive=true" : ""
          }`
        ),
        fetch(
          `/api/fineract/codes/${BRANCH_CODE_NAME}/codevalues${
            includeInactive ? "?includeInactive=true" : ""
          }`
        ),
      ]);

      // Parse banks (uses parseBanks which adds missing banks like ACCESS BANK)
      if (banksResponse.ok) {
        const banksData = await banksResponse.json();
        const parsedBanks = parseBanks(Array.isArray(banksData) ? banksData : []);
        setBanks(parsedBanks);
      } else {
        // Even if API fails, still include the additional banks
        setBanks(parseBanks([]));
      }

      // Parse branches
      if (branchesResponse.ok) {
        const branchesData = await branchesResponse.json();
        const parsedBranches: Branch[] = (
          Array.isArray(branchesData) ? branchesData : []
        )
          .map((cv: any) => {
            const parsed = parseBranchCodeValue(cv.name);
            if (!parsed) return null;
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
        setAllBranches(parsedBranches);
      } else {
        setAllBranches([]);
      }
    } catch (err: any) {
      console.error("Error fetching bank/branch data:", err);
      setError(err.message || "Failed to fetch banks and branches");
    } finally {
      setIsLoading(false);
    }
  }, [includeInactive]);

  // Fetch on mount if enabled
  useEffect(() => {
    if (fetchOnMount) {
      fetchData();
    }
  }, [fetchOnMount, fetchData]);

  // Filter branches by bank ID
  const getBranchesForBank = useCallback(
    (bankId: number): Branch[] => {
      return allBranches.filter((b) => b.bankId === bankId);
    },
    [allBranches]
  );

  // Get branches for selected bank
  const selectedBankBranches = selectedBankId
    ? getBranchesForBank(selectedBankId)
    : [];

  return {
    banks,
    allBranches,
    getBranchesForBank,
    isLoading,
    error,
    refresh: fetchData,
    selectedBankId,
    setSelectedBankId,
    selectedBankBranches,
  };
}

/**
 * Get bank name by ID
 */
export function getBankName(banks: Bank[], bankId: number): string {
  const bank = banks.find((b) => b.id === bankId);
  return bank?.name || "Unknown Bank";
}

/**
 * Get branch display name by ID
 */
export function getBranchDisplayName(branches: Branch[], branchId: number): string {
  const branch = branches.find((b) => b.id === branchId);
  return branch ? `${branch.code} - ${branch.name}` : "Unknown Branch";
}

/**
 * Parse branch info from code value ID
 */
export function getBranchInfo(
  branches: Branch[],
  branchId: number
): Branch | null {
  return branches.find((b) => b.id === branchId) || null;
}

