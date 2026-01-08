"use client";

import { useEffect, useState, useCallback } from "react";
import { Label } from "@/components/ui/label";
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
}

// Helper to normalize column names for comparison
function normalizeColumnName(name: string): string {
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

function isBranchCodeField(columnName: string): boolean {
  const normalized = normalizeColumnName(columnName);
  return (
    normalized === "bankbranchcode" ||
    normalized === "branchcode" ||
    normalized.includes("branchcode")
  );
}

function isBranchNameField(columnName: string): boolean {
  const normalized = normalizeColumnName(columnName);
  return (
    normalized === "branchname" ||
    normalized === "bankbranchname" ||
    normalized.includes("branchname")
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
}: BankDetailsFieldsProps) {
  // Find the relevant column headers
  const bankHeader = headers.find((h) => isBankField(h.columnName));
  const branchCodeHeader = headers.find((h) => isBranchCodeField(h.columnName));
  const branchNameHeader = headers.find((h) => isBranchNameField(h.columnName));

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
    if (bankName) {
      setSelectedBankName(bankName);
      const matchedBankName = matchFineractBankName(bankName);
      if (matchedBankName) {
        const branches = getBranchesForBank(matchedBankName);
        setAvailableBranches(branches);
      } else {
        // Try direct match with the name
        const branches = getBranchesForBank(bankName);
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

  // Build bank options from Fineract CODELOOKUP
  const bankOptions =
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

  // Build branch code options from our local data
  const branchCodeOptions = availableBranches.map((branch) => ({
    value: branch.branchCode,
    label: `${branch.branchCode} - ${branch.branchName}`,
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

      {/* Branch Code Field - Uses our local data, filtered by bank */}
      {branchCodeHeader && (
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {formatHeaderName(branchCodeHeader.columnName)}
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
    </>
  );
}

/**
 * Check if the datatable has bank detail fields that should use custom rendering
 */
export function hasBankDetailFields(headers: any[]): boolean {
  const hasBankField = headers.some((h) => isBankField(h.columnName));
  const hasBranchCodeField = headers.some((h) =>
    isBranchCodeField(h.columnName)
  );
  const hasBranchNameField = headers.some((h) =>
    isBranchNameField(h.columnName)
  );

  // Must have at least bank and one of branch code/name
  return hasBankField && (hasBranchCodeField || hasBranchNameField);
}

/**
 * Get the column names that are handled by BankDetailsFields
 */
export function getBankDetailColumnNames(headers: any[]): string[] {
  const names: string[] = [];

  const bankHeader = headers.find((h) => isBankField(h.columnName));
  const branchCodeHeader = headers.find((h) => isBranchCodeField(h.columnName));
  const branchNameHeader = headers.find((h) => isBranchNameField(h.columnName));

  if (bankHeader) names.push(bankHeader.columnName);
  if (branchCodeHeader) names.push(branchCodeHeader.columnName);
  if (branchNameHeader) names.push(branchNameHeader.columnName);

  return names;
}

