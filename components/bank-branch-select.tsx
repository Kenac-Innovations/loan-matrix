"use client";

import { useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useBankBranches } from "@/hooks/use-bank-branches";
import { cn } from "@/lib/utils";

interface BankBranchSelectProps {
  /** Selected bank ID */
  bankId?: number | null;
  /** Selected branch ID */
  branchId?: number | null;
  /** Callback when bank changes */
  onBankChange: (bankId: number | null) => void;
  /** Callback when branch changes */
  onBranchChange: (branchId: number | null) => void;
  /** Show labels */
  showLabels?: boolean;
  /** Bank label text */
  bankLabel?: string;
  /** Branch label text */
  branchLabel?: string;
  /** Bank placeholder */
  bankPlaceholder?: string;
  /** Branch placeholder */
  branchPlaceholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Required fields */
  required?: boolean;
  /** Additional className for container */
  className?: string;
  /** Layout direction */
  direction?: "horizontal" | "vertical";
  /** Error messages */
  errors?: {
    bank?: string;
    branch?: string;
  };
}

/**
 * Reusable bank and branch selection component with dependent dropdowns
 */
export function BankBranchSelect({
  bankId,
  branchId,
  onBankChange,
  onBranchChange,
  showLabels = true,
  bankLabel = "Bank",
  branchLabel = "Branch",
  bankPlaceholder = "Select a bank",
  branchPlaceholder = "Select a branch",
  disabled = false,
  required = false,
  className,
  direction = "vertical",
  errors,
}: BankBranchSelectProps) {
  const {
    banks,
    isLoading,
    selectedBankId,
    setSelectedBankId,
    selectedBankBranches,
  } = useBankBranches();

  // Sync external bankId with internal state
  useEffect(() => {
    if (bankId !== undefined) {
      setSelectedBankId(bankId);
    }
  }, [bankId, setSelectedBankId]);

  const handleBankChange = (value: string) => {
    const newBankId = value ? parseInt(value) : null;
    setSelectedBankId(newBankId);
    onBankChange(newBankId);
    // Clear branch selection when bank changes
    onBranchChange(null);
  };

  const handleBranchChange = (value: string) => {
    const newBranchId = value ? parseInt(value) : null;
    onBranchChange(newBranchId);
  };

  const containerClass = cn(
    direction === "horizontal"
      ? "flex flex-row gap-4 items-end"
      : "flex flex-col gap-4",
    className
  );

  const itemClass = direction === "horizontal" ? "flex-1" : "";

  if (isLoading) {
    return (
      <div className={containerClass}>
        <div className={cn("space-y-2", itemClass)}>
          {showLabels && <Label>{bankLabel}</Label>}
          <div className="flex items-center justify-center h-10 border rounded-md">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        </div>
        <div className={cn("space-y-2", itemClass)}>
          {showLabels && <Label>{branchLabel}</Label>}
          <div className="flex items-center justify-center h-10 border rounded-md">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      {/* Bank Select */}
      <div className={cn("space-y-2", itemClass)}>
        {showLabels && (
          <Label>
            {bankLabel}
            {required && <span className="text-red-500 ml-1">*</span>}
          </Label>
        )}
        <Select
          value={selectedBankId?.toString() || ""}
          onValueChange={handleBankChange}
          disabled={disabled}
        >
          <SelectTrigger
            className={cn(errors?.bank && "border-red-500")}
          >
            <SelectValue placeholder={bankPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {banks.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground text-center">
                No banks configured
              </div>
            ) : (
              banks.map((bank) => (
                <SelectItem key={bank.id} value={bank.id.toString()}>
                  {bank.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        {errors?.bank && (
          <p className="text-xs text-red-500">{errors.bank}</p>
        )}
      </div>

      {/* Branch Select */}
      <div className={cn("space-y-2", itemClass)}>
        {showLabels && (
          <Label>
            {branchLabel}
            {required && <span className="text-red-500 ml-1">*</span>}
          </Label>
        )}
        <Select
          value={branchId?.toString() || ""}
          onValueChange={handleBranchChange}
          disabled={disabled || !selectedBankId}
        >
          <SelectTrigger
            className={cn(errors?.branch && "border-red-500")}
          >
            <SelectValue
              placeholder={
                !selectedBankId
                  ? "Select a bank first"
                  : selectedBankBranches.length === 0
                  ? "No branches available"
                  : branchPlaceholder
              }
            />
          </SelectTrigger>
          <SelectContent>
            {selectedBankBranches.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground text-center">
                {!selectedBankId
                  ? "Select a bank first"
                  : "No branches configured for this bank"}
              </div>
            ) : (
              selectedBankBranches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id.toString()}>
                  {branch.code} - {branch.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        {errors?.branch && (
          <p className="text-xs text-red-500">{errors.branch}</p>
        )}
      </div>
    </div>
  );
}

export default BankBranchSelect;

