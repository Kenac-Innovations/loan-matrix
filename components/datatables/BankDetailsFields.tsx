"use client";

import { useEffect, useState, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/searchable-select";
import {
  getBranchesForBank,
  findBranchByCode,
  findBranchByName,
  matchFineractBankName,
  type BankBranch,
} from "@/lib/bank-branch-data";

interface BankDetailsFieldsProps {
  headers: any[];
  editedData: Record<string, any>;
  onFieldChange: (columnName: string, value: any) => void;
  clientName?: string; // Client's full name for account name field
}

// Helper to normalize column names for comparison
function normalizeColumnName(name: string | undefined | null): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[_\s-]+/g, "") // Remove underscores, spaces, hyphens
    .replace(/cd.*$/i, ""); // Remove cd suffix patterns
}

// Check if a column name matches expected bank detail field
function isBankField(columnName: string): boolean {
  const normalized = normalizeColumnName(columnName);
  return normalized === "bank" || normalized === "bankname";
}

// Check if this is the "bank branch code" field (shown as "Branch Code")
function isBankBranchCodeField(columnName: string): boolean {
  const normalized = normalizeColumnName(columnName);
  return normalized === "bankbranchcode" || normalized.includes("bankbranchcode");
}

// Check if this is just "branch code" field (to be hidden)
function isBranchCodeOnlyField(columnName: string): boolean {
  const normalized = normalizeColumnName(columnName);
  // Match "branchcode" but NOT "bankbranchcode"
  return (
    (normalized === "branchcode" || normalized.includes("branchcode")) &&
    !normalized.includes("bankbranchcode")
  );
}

function isBranchCodeField(columnName: string): boolean {
  return isBankBranchCodeField(columnName) || isBranchCodeOnlyField(columnName);
}

function isBranchNameField(columnName: string): boolean {
  const normalized = normalizeColumnName(columnName);
  return (
    normalized === "branchname" ||
    normalized === "bankbranchname" ||
    normalized.includes("branchname")
  );
}

function isAccountNumberField(columnName: string): boolean {
  const normalized = normalizeColumnName(columnName);
  return (
    normalized === "accountnumber" ||
    normalized === "bankaccountnumber" ||
    normalized.includes("accountnumber") ||
    normalized.includes("accountno")
  );
}

function isAccountNameField(columnName: string): boolean {
  const normalized = normalizeColumnName(columnName);
  return (
    normalized === "accountname" ||
    normalized === "bankaccountname" ||
    normalized.includes("accountname")
  );
}

// Format header name for display
function formatHeaderName(name: string): string {
  let formatted = name
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();

  // Handle duplicated patterns like "bank branch code cd bank branch code"
  const duplicateMatch = formatted.match(/^(.+?)\s+cd[\s-]+\1$/i);
  if (duplicateMatch && duplicateMatch[1]) {
    return duplicateMatch[1].trim();
  }

  // Pattern: "Text cd text" -> extract first part
  const cdMatch = formatted.match(/^(.+?)\s+cd[\s-]+/i);
  if (cdMatch && cdMatch[1]) {
    return cdMatch[1].trim();
  }

  return formatted;
}

export function BankDetailsFields({
  headers,
  editedData,
  onFieldChange,
  clientName,
}: BankDetailsFieldsProps) {
  // Early return if headers is not valid
  if (!headers || !Array.isArray(headers)) {
    return null;
  }

  // Find the relevant column headers (with null-safe checks)
  const bankHeader = headers.find((h) => h?.columnName && isBankField(h.columnName));
  // "bank branch code" field - shown as "Branch Code"
  const bankBranchCodeHeader = headers.find((h) => h?.columnName && isBankBranchCodeField(h.columnName));
  // "branch code" field - hidden
  const branchCodeOnlyHeader = headers.find((h) => h?.columnName && isBranchCodeOnlyField(h.columnName));
  // Use bank branch code if available, otherwise fall back to branch code only
  const branchCodeHeader = bankBranchCodeHeader || branchCodeOnlyHeader;
  const branchNameHeader = headers.find((h) => h?.columnName && isBranchNameField(h.columnName));
  const accountNumberHeader = headers.find((h) => h?.columnName && isAccountNumberField(h.columnName));
  const accountNameHeader = headers.find((h) => h?.columnName && isAccountNameField(h.columnName));

  // Local state for available branches based on selected bank
  const [availableBranches, setAvailableBranches] = useState<BankBranch[]>([]);
  const [selectedBankName, setSelectedBankName] = useState<string>("");

  // Get current values
  const currentBankValue = bankHeader
    ? editedData[bankHeader.columnName]
    : undefined;
  const currentBranchCode = branchCodeHeader
    ? editedData[branchCodeHeader.columnName]
    : undefined;
  const currentBranchName = branchNameHeader
    ? editedData[branchNameHeader.columnName]
    : undefined;
  const currentAccountNumber = accountNumberHeader
    ? editedData[accountNumberHeader.columnName]
    : undefined;
  const currentAccountName = accountNameHeader
    ? editedData[accountNameHeader.columnName]
    : undefined;

  // Auto-fill account name with client name on mount
  useEffect(() => {
    if (accountNameHeader && clientName && !currentAccountName) {
      onFieldChange(accountNameHeader.columnName, clientName);
    }
  }, [accountNameHeader, clientName, currentAccountName, onFieldChange]);

  // Account number validation state
  const [accountNumberError, setAccountNumberError] = useState<string>("");

  // Handle account number change with 13-digit validation
  const handleAccountNumberChange = useCallback(
    (value: string) => {
      // Only allow digits
      const digitsOnly = value.replace(/\D/g, "");
      
      if (accountNumberHeader) {
        onFieldChange(accountNumberHeader.columnName, digitsOnly);
      }

      // Validate 13 digits
      if (digitsOnly.length > 0 && digitsOnly.length !== 13) {
        setAccountNumberError("Account number must be exactly 13 digits");
      } else {
        setAccountNumberError("");
      }
    },
    [accountNumberHeader, onFieldChange]
  );

  // Get the bank name from the CODELOOKUP value
  const getBankNameFromValue = useCallback(
    (value: any): string | null => {
      if (!bankHeader?.columnValues || !value) return null;

      const matchingOption = bankHeader.columnValues.find(
        (opt: any) => opt.id === value || opt.id === Number(value)
      );

      if (matchingOption) {
        // Extract the actual name
        if (matchingOption.name) {
          return matchingOption.name;
        } else if (matchingOption.value) {
          // Clean up value if it has code prefix
          const valueStr = String(matchingOption.value);
          const cdMatch = valueStr.match(/^(.+?)\s+cd_[a-z_]+\s+/i);
          if (cdMatch && cdMatch[1]) {
            return cdMatch[1].trim();
          }
          const prefixMatch = valueStr.match(/^cd_[a-z_]+\s+(.+)$/i);
          if (prefixMatch && prefixMatch[1]) {
            return prefixMatch[1].trim();
          }
          return valueStr;
        }
      }
      return null;
    },
    [bankHeader]
  );

  // When bank value changes, update available branches
  useEffect(() => {
    if (!currentBankValue) {
      setAvailableBranches([]);
      setSelectedBankName("");
      return;
    }

    const bankName = getBankNameFromValue(currentBankValue);
    console.log("=== Bank Branch Filtering Debug ===");
    console.log("Current bank value:", currentBankValue);
    console.log("Extracted bank name:", bankName);
    
    if (bankName) {
      setSelectedBankName(bankName);
      const matchedBankName = matchFineractBankName(bankName);
      console.log("Matched bank name in our data:", matchedBankName);
      
      if (matchedBankName) {
        const branches = getBranchesForBank(matchedBankName);
        console.log(`Found ${branches.length} branches for ${matchedBankName}`);
        setAvailableBranches(branches);
      } else {
        // Try direct match with the name
        const branches = getBranchesForBank(bankName);
        console.log(`Direct match: Found ${branches.length} branches for ${bankName}`);
        setAvailableBranches(branches);
      }
    }
  }, [currentBankValue, getBankNameFromValue]);

  // Handle branch code selection - auto-fill branch name
  const handleBranchCodeChange = useCallback(
    (value: string) => {
      if (branchCodeHeader) {
        onFieldChange(branchCodeHeader.columnName, value);
      }

      // Auto-fill branch name
      if (branchNameHeader && selectedBankName) {
        const matchedBankName = matchFineractBankName(selectedBankName);
        const branch = findBranchByCode(matchedBankName || selectedBankName, value);
        if (branch) {
          onFieldChange(branchNameHeader.columnName, branch.branchName);
        }
      }
    },
    [branchCodeHeader, branchNameHeader, selectedBankName, onFieldChange]
  );

  // Handle branch name selection - auto-fill branch code
  const handleBranchNameChange = useCallback(
    (value: string) => {
      if (branchNameHeader) {
        onFieldChange(branchNameHeader.columnName, value);
      }

      // Auto-fill branch code
      if (branchCodeHeader && selectedBankName) {
        const matchedBankName = matchFineractBankName(selectedBankName);
        const branch = findBranchByName(matchedBankName || selectedBankName, value);
        if (branch) {
          onFieldChange(branchCodeHeader.columnName, branch.branchCode);
        }
      }
    },
    [branchCodeHeader, branchNameHeader, selectedBankName, onFieldChange]
  );

  // Handle bank selection - clear branch fields when bank changes
  const handleBankChange = useCallback(
    (value: any) => {
      if (bankHeader) {
        const isIntegerType =
          bankHeader.columnType === "INTEGER" ||
          bankHeader.columnType === "BIGINT";
        onFieldChange(
          bankHeader.columnName,
          isIntegerType ? parseInt(value) || 0 : value
        );
      }

      // Clear branch fields when bank changes
      if (branchCodeHeader) {
        onFieldChange(branchCodeHeader.columnName, "");
      }
      if (branchNameHeader) {
        onFieldChange(branchNameHeader.columnName, "");
      }
    },
    [bankHeader, branchCodeHeader, branchNameHeader, onFieldChange]
  );

  // Additional banks that may not be returned by Fineract API but should always be available
  const ADDITIONAL_BANKS = [
    { id: -1, name: "ACCESS BANK" },
  ];

  // Build bank options from Fineract CODELOOKUP
  const bankOptionsFromFineract =
    bankHeader?.columnValues?.map((option: any) => {
      let label = option.id.toString();
      if (option.name) {
        label = option.name;
      } else if (option.value) {
        const valueStr = String(option.value);
        const cdMatch = valueStr.match(/^(.+?)\s+cd_[a-z_]+\s+/i);
        if (cdMatch && cdMatch[1]) {
          label = cdMatch[1].trim();
        } else {
          const prefixMatch = valueStr.match(/^cd_[a-z_]+\s+(.+)$/i);
          if (prefixMatch && prefixMatch[1]) {
            label = prefixMatch[1].trim();
          } else {
            label = valueStr;
          }
        }
      }
      return {
        value: option.id.toString(),
        label,
      };
    }) || [];

  // Add any missing additional banks
  const bankOptions = [...bankOptionsFromFineract];
  for (const additionalBank of ADDITIONAL_BANKS) {
    const exists = bankOptions.some(
      (opt) => opt.label.toUpperCase() === additionalBank.name.toUpperCase()
    );
    if (!exists) {
      bankOptions.push({
        value: additionalBank.id.toString(),
        label: additionalBank.name,
      });
    }
  }
  // Sort alphabetically
  bankOptions.sort((a, b) => a.label.localeCompare(b.label));

  // Build branch code options from our local data
  const branchCodeOptions = availableBranches.map((branch) => ({
    value: branch.branchCode,
    label: branch.branchCode,
  }));

  // Build branch name options from our local data
  const branchNameOptions = availableBranches.map((branch) => ({
    value: branch.branchName,
    label: branch.branchName,
  }));

  return (
    <>
      {/* Bank Field - Uses Fineract CODELOOKUP */}
      {bankHeader && (
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {formatHeaderName(bankHeader.columnName)}
          </Label>
          <SearchableSelect
            options={bankOptions}
            value={currentBankValue?.toString() ?? ""}
            onValueChange={handleBankChange}
            placeholder="Select a bank"
            emptyMessage="No banks available"
          />
        </div>
      )}

      {/* Bank Branch Code Field - Displayed as "Branch Code", uses our local data */}
      {bankBranchCodeHeader && (
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Branch Code
          </Label>
          <SearchableSelect
            options={branchCodeOptions}
            value={currentBranchCode?.toString() ?? ""}
            onValueChange={handleBranchCodeChange}
            placeholder={
              availableBranches.length > 0
                ? "Select branch code"
                : "Select a bank first"
            }
            emptyMessage={
              availableBranches.length > 0
                ? "No matching branch codes"
                : "Select a bank to see branch codes"
            }
            disabled={availableBranches.length === 0}
          />
          {availableBranches.length === 0 && selectedBankName && (
            <p className="text-xs text-amber-600">
              No branch data available for this bank. You can enter manually.
            </p>
          )}
        </div>
      )}

      {/* Branch Name Field - Uses our local data, filtered by bank */}
      {branchNameHeader && (
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {formatHeaderName(branchNameHeader.columnName)}
          </Label>
          <SearchableSelect
            options={branchNameOptions}
            value={currentBranchName?.toString() ?? ""}
            onValueChange={handleBranchNameChange}
            placeholder={
              availableBranches.length > 0
                ? "Select branch name"
                : "Select a bank first"
            }
            emptyMessage={
              availableBranches.length > 0
                ? "No matching branch names"
                : "Select a bank to see branch names"
            }
            disabled={availableBranches.length === 0}
          />
        </div>
      )}

      {/* Account Number Field - 13 digits validation */}
      {accountNumberHeader && (
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {formatHeaderName(accountNumberHeader.columnName)}
          </Label>
          <Input
            type="text"
            value={currentAccountNumber?.toString() ?? ""}
            onChange={(e) => handleAccountNumberChange(e.target.value)}
            placeholder="Enter 13-digit account number"
            maxLength={13}
            className={accountNumberError ? "border-red-500" : ""}
          />
          {accountNumberError && (
            <p className="text-xs text-red-500">{accountNumberError}</p>
          )}
        </div>
      )}

      {/* Account Name Field - Auto-filled with client name */}
      {accountNameHeader && (
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {formatHeaderName(accountNameHeader.columnName)}
          </Label>
          <Input
            type="text"
            value={currentAccountName?.toString() ?? ""}
            onChange={(e) => onFieldChange(accountNameHeader.columnName, e.target.value)}
            placeholder="Account holder name"
            className="text-sm"
          />
        </div>
      )}
    </>
  );
}

/**
 * Check if the datatable has bank detail fields that should use custom rendering
 */
export function hasBankDetailFields(headers: any[] | undefined | null): boolean {
  if (!headers || !Array.isArray(headers)) return false;
  
  const hasBankField = headers.some((h) => h?.columnName && isBankField(h.columnName));
  const hasBranchCodeField = headers.some((h) =>
    h?.columnName && isBranchCodeField(h.columnName)
  );
  const hasBranchNameField = headers.some((h) =>
    h?.columnName && isBranchNameField(h.columnName)
  );

  // Must have at least bank and one of branch code/name
  return hasBankField && (hasBranchCodeField || hasBranchNameField);
}

/**
 * Get the column names that are handled by BankDetailsFields
 */
export function getBankDetailColumnNames(headers: any[] | undefined | null): string[] {
  if (!headers || !Array.isArray(headers)) return [];
  
  const names: string[] = [];

  const bankHeader = headers.find((h) => h?.columnName && isBankField(h.columnName));
  const bankBranchCodeHeader = headers.find((h) => h?.columnName && isBankBranchCodeField(h.columnName));
  const branchCodeOnlyHeader = headers.find((h) => h?.columnName && isBranchCodeOnlyField(h.columnName));
  const branchNameHeader = headers.find((h) => h?.columnName && isBranchNameField(h.columnName));
  const accountNumberHeader = headers.find((h) => h?.columnName && isAccountNumberField(h.columnName));
  const accountNameHeader = headers.find((h) => h?.columnName && isAccountNameField(h.columnName));

  if (bankHeader) names.push(bankHeader.columnName);
  if (bankBranchCodeHeader) names.push(bankBranchCodeHeader.columnName);
  // Also include "branch code" only field so it's hidden from default rendering
  if (branchCodeOnlyHeader) names.push(branchCodeOnlyHeader.columnName);
  if (branchNameHeader) names.push(branchNameHeader.columnName);
  if (accountNumberHeader) names.push(accountNumberHeader.columnName);
  if (accountNameHeader) names.push(accountNameHeader.columnName);

  return names;
}

