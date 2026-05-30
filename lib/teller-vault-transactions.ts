export type TellerAllocationHistoryInput = {
  id: string;
  allocatedDate: Date | string;
  amount: number;
  currency: string;
  notes: string | null;
  allocatedBy: string;
  status: string;
  cashierId: string | null;
  fineractAllocationId: number | null;
};

export type TellerVaultTransaction = {
  id: string;
  date: Date | string;
  amount: number;
  currency: string;
  type: string;
  notes: string | null;
  allocatedBy: string;
  status: string;
  runningBalance: number;
};

export function getVaultTransactionType(notes: string | null | undefined) {
  const narration = (notes ?? "").toLowerCase();

  if (narration.includes("variance")) {
    return "VARIANCE_ADJUSTMENT";
  }

  if (
    narration.includes("settlement") ||
    narration.includes("returned") ||
    narration.includes("return from") ||
    narration.includes("returned to vault") ||
    narration.includes("session close") ||
    narration.includes("session closed")
  ) {
    return "SETTLEMENT_RETURN";
  }

  if (narration.includes("opening balance")) {
    return "OPENING_BALANCE";
  }

  return "ALLOCATION";
}

export function isCashierReturnToVault(notes: string | null | undefined) {
  const narration = (notes ?? "").toLowerCase();
  return (
    narration.includes("return to vault") ||
    narration.includes("returned to vault") ||
    narration.includes("return to safe") ||
    narration.includes("returned to safe") ||
    narration.includes("return from") ||
    narration.includes("settlement")
  );
}

export function isTellerToCashierAllocation(allocation: {
  notes: string | null;
  cashierId: string | null;
  amount: number;
  fineractAllocationId: number | null;
}) {
  if (!allocation.cashierId || allocation.amount <= 0) {
    return false;
  }

  const narration = (allocation.notes ?? "").trim().toLowerCase();

  if (narration.length > 0) {
    return narration.includes("float");
  }

  return allocation.fineractAllocationId != null;
}

export function shouldIncludeInVaultHistory(allocation: {
  notes: string | null;
  cashierId: string | null;
  amount: number;
  fineractAllocationId: number | null;
}) {
  const narration = (allocation.notes ?? "").toLowerCase();

  if (
    narration.includes("loan disbursement") ||
    narration.includes("disbursement (cash out)")
  ) {
    return false;
  }

  if (!allocation.cashierId) {
    return true;
  }

  if (narration.includes("loan repayment")) {
    return false;
  }

  if (
    narration.includes("loan disbursement") ||
    narration.includes("credit balance refund")
  ) {
    return false;
  }

  if (isTellerToCashierAllocation(allocation)) {
    return true;
  }

  if (narration.includes("session close settlement")) {
    return false;
  }

  return isCashierReturnToVault(allocation.notes);
}

export function buildTellerVaultTransactions(
  allocations: TellerAllocationHistoryInput[]
) {
  let runningBalance = 0;

  return allocations
    .filter(shouldIncludeInVaultHistory)
    .sort(
      (a, b) =>
        new Date(a.allocatedDate).getTime() - new Date(b.allocatedDate).getTime()
    )
    .map((alloc): TellerVaultTransaction => {
      let amount = alloc.amount;
      let transactionType = getVaultTransactionType(alloc.notes);

      if (alloc.cashierId) {
        if (isTellerToCashierAllocation(alloc)) {
          amount = -Math.abs(alloc.amount);
          transactionType = "CASHIER_ALLOCATION";
        } else if (isCashierReturnToVault(alloc.notes)) {
          amount = Math.abs(alloc.amount);
          transactionType = "SETTLEMENT_RETURN";
        }
      }

      runningBalance += amount;

      return {
        id: alloc.id,
        date: alloc.allocatedDate,
        amount,
        currency: alloc.currency,
        type: transactionType,
        notes: alloc.notes,
        allocatedBy: alloc.allocatedBy,
        status: alloc.status,
        runningBalance,
      };
    });
}

export function summarizeTellerVaultTransactions(
  transactions: TellerVaultTransaction[]
) {
  const openingBalance = transactions
    .filter((t) => t.type === "OPENING_BALANCE")
    .reduce((sum, t) => sum + t.amount, 0);

  const allocationsFromBank = transactions
    .filter((t) => t.type === "ALLOCATION")
    .reduce((sum, t) => sum + t.amount, 0);

  const settlementReturns = transactions
    .filter((t) => t.type === "SETTLEMENT_RETURN")
    .reduce((sum, t) => sum + t.amount, 0);

  const tellerToCashierAllocations = transactions
    .filter((t) => t.type === "CASHIER_ALLOCATION")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const currentBalance =
    transactions.length > 0 ? transactions[transactions.length - 1].runningBalance : 0;

  return {
    openingBalance,
    allocationsFromBank,
    settlementReturns,
    tellerToCashierAllocations,
    currentBalance,
    transactionCount: transactions.length,
  };
}
