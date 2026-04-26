/**
 * Cashier-only counter-entries must not replace loan repayment / disbursement reversal.
 * Uses Fineract-style type codes/values plus notes heuristics.
 */

function norm(s: string | undefined | null): string {
  return (s ?? "").toLowerCase();
}

/** Fineract cashier / teller txn type codes that indicate loan cash movement */
export function isLoanRepaymentOrDisbursementCashierType(
  typeCode?: string | null,
  typeValue?: string | null
): boolean {
  const code = (typeCode ?? "").toUpperCase();
  const val = norm(typeValue);
  if (
    code.includes("REPAYMENT") ||
    code.includes("DISBURS") ||
    code.includes("DISBURSE") ||
    code.includes("RECOVERY")
  ) {
    return true;
  }
  if (
    val.includes("repayment") ||
    val.includes("disbursement") ||
    val.includes("disbursal") ||
    val.includes("recovery repayment")
  ) {
    return true;
  }
  return false;
}

export function isLoanRepaymentOrDisbursementFromNotes(notes: string | undefined | null): boolean {
  const n = norm(notes);
  if (!n) return false;
  if (/\bloan\s+repayment\b/.test(n)) return true;
  if (/\brepayment\b.*\bloan\s*#/i.test(n)) return true;
  if (/\bloan\s*#\s*\d+.*\brepayment\b/i.test(n)) return true;
  if (/\bloan\s+disburs/i.test(n)) return true;
  if (/\bdisbursement\b.*\bloan\b/i.test(n)) return true;
  return false;
}

export function cannotReverseOnCashierOnly(
  typeCode?: string | null,
  typeValue?: string | null,
  ...noteFields: (string | null | undefined)[]
): boolean {
  if (isLoanRepaymentOrDisbursementCashierType(typeCode, typeValue)) return true;
  for (const f of noteFields) {
    if (isLoanRepaymentOrDisbursementFromNotes(f)) return true;
  }
  return false;
}

/** Legacy `sourceTransactionType` from older clients — coarse category string */
export function isSourceTransactionTypeFieldBlocked(
  sourceTransactionType: unknown
): boolean {
  const raw =
    typeof sourceTransactionType === "string" ? sourceTransactionType : "";
  const t = norm(raw);
  if (!t) return false;
  if (t === "repayment" || t.startsWith("repayment")) return true;
  if (t.includes("disbursement") || t.includes("disbursal")) return true;
  if (t.includes("disburs") && t.includes("loan")) return true;
  return false;
}

export type CashierCounterSourceFields = {
  sourceTxnTypeCode?: string;
  sourceTxnTypeValue?: string;
  sourceNotes?: string;
  notes?: string;
  sourceTransactionType?: string;
};

export function isCashierCounterEntryBlockedByLoanContext(
  fields: CashierCounterSourceFields
): boolean {
  if (isSourceTransactionTypeFieldBlocked(fields.sourceTransactionType)) {
    return true;
  }
  return cannotReverseOnCashierOnly(
    fields.sourceTxnTypeCode,
    fields.sourceTxnTypeValue,
    fields.sourceNotes,
    fields.notes
  );
}

type CashierRowLike = {
  txnType?: string | { value?: string; code?: string };
  transactionType?: { code?: string; value?: string };
  _isReversal?: boolean;
  id?: number | string;
};

/**
 * Original movement on the cashier: cash **in** to till vs cash **out** from till.
 * Counter-entry: cashIn → settle (out); cashOut → allocate (in).
 */
export function getOriginalCashDirectionForCounterEntry(
  row: CashierRowLike
): "cashIn" | "cashOut" | null {
  if (row.id != null && String(row.id).startsWith("reversal-")) {
    return null;
  }
  const fromObj = (o: { value?: string; code?: string } | undefined) =>
    [o?.value, o?.code].filter(Boolean).join(" ");
  const txnTypeStr =
    typeof row.txnType === "object" && row.txnType
      ? fromObj(row.txnType as { value?: string; code?: string })
      : typeof row.txnType === "string"
        ? row.txnType
        : "";
  const tt = fromObj(row.transactionType);
  const blob = `${txnTypeStr} ${tt}`.toLowerCase();

  if (row._isReversal || blob.includes("reversal")) {
    return "cashIn";
  }
  if (
    blob.includes("allocate") ||
    blob.includes("credit") ||
    blob.includes("deposit") ||
    blob.includes("cash in")
  ) {
    return "cashIn";
  }
  if (
    blob.includes("settle") ||
    blob.includes("debit") ||
    blob.includes("withdrawal") ||
    blob.includes("expense") ||
    blob.includes("cash out")
  ) {
    return "cashOut";
  }
  return null;
}
