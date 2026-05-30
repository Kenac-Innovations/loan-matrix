"use client";

import { useState, useCallback, useRef } from "react";
import { useFeatureFlags } from "./use-feature-flags";

interface ValidationResult {
  valid: boolean;
  error?: string;
  usedAt?: string;
  usedBy?: string;
  transactionType?: string;
}

/**
 * Hook for receipt number validation against tenant receipt ranges.
 *
 * When the receiptRanges feature is disabled, validation always passes.
 * When enabled, validates that the number is within an active range and unused.
 */
export function useReceiptValidation() {
  const { isEnabled, isLoading: flagsLoading } = useFeatureFlags();
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const receiptRangesEnabled = !flagsLoading && isEnabled("receiptRanges");

  const validate = useCallback(
    async (receiptNumber: string): Promise<ValidationResult> => {
      if (!receiptRangesEnabled) {
        return { valid: true };
      }

      if (!receiptNumber.trim()) {
        const result = { valid: false, error: "Receipt number is required" };
        setValidationResult(result);
        return result;
      }

      setIsValidating(true);
      try {
        const res = await fetch("/api/receipts/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ receiptNumber: receiptNumber.trim() }),
        });

        const data: ValidationResult = await res.json();
        setValidationResult(data);
        return data;
      } catch {
        const result = { valid: false, error: "Failed to validate receipt number" };
        setValidationResult(result);
        return result;
      } finally {
        setIsValidating(false);
      }
    },
    [receiptRangesEnabled]
  );

  const validateDebounced = useCallback(
    (receiptNumber: string) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => validate(receiptNumber), 500);
    },
    [validate]
  );

  /**
   * Mark a receipt number as used after a successful transaction.
   */
  const markUsed = useCallback(
    async (params: {
      receiptNumber: string;
      transactionType: "REPAYMENT" | "DISBURSEMENT" | "CREDIT_BALANCE_REFUND";
      fineractTxnId?: string;
      loanId?: number;
      usedBy?: string;
    }): Promise<boolean> => {
      if (!receiptRangesEnabled) return true;

      try {
        const res = await fetch("/api/receipts/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...params, markUsed: true }),
        });

        const data = await res.json();
        return data.valid;
      } catch {
        console.error("Failed to mark receipt as used");
        return false;
      }
    },
    [receiptRangesEnabled]
  );

  const clearValidation = useCallback(() => {
    setValidationResult(null);
  }, []);

  return {
    receiptRangesEnabled,
    isValidating,
    validationResult,
    validate,
    validateDebounced,
    markUsed,
    clearValidation,
  };
}
