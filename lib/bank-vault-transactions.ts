export type BankAllocationHistoryInput = {
  id: string;
  allocatedDate: Date | string;
  amount: number;
  currency: string;
  notes: string | null;
  allocatedBy: string;
  status: string;
};

export type BankTellerAllocationHistoryInput = {
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

export type BankVaultTransaction = {
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

export function isBankOpeningBalance(allocation: {
  notes: string | null;
  allocatedBy: string;
}) {
  const narration = (allocation.notes ?? "").toLowerCase();
  return (
    narration.includes("opening balance") ||
    allocation.allocatedBy === "SYSTEM-IMPORT"
  );
}

export function isReturnFromTeller(allocation: { notes: string | null }) {
  const narration = (allocation.notes ?? "").toLowerCase();
  return (
    narration.includes("return from teller") ||
    narration.includes("returned from teller") ||
    narration.includes("return to bank")
  );
}

export function isBankToTellerAllocation(allocation: {
  notes: string | null;
  allocatedBy: string;
  cashierId: string | null;
  amount: number;
  fineractAllocationId: number | null;
}) {
  if (allocation.cashierId || allocation.amount <= 0) {
    return false;
  }

  const narration = (allocation.notes ?? "").toLowerCase();
  if (narration.includes("opening balance")) return false;
  if (allocation.allocatedBy === "SYSTEM-IMPORT") return false;
  if (allocation.allocatedBy === "SYSTEM-REVERSAL") return false;
  if (
    narration.includes("return from") ||
    narration.includes("session close") ||
    narration.includes("returned to vault")
  ) {
    return false;
  }

  return allocation.fineractAllocationId != null || narration.includes("from bank");
}

export function getBankTransactionType(
  allocation: { notes: string | null; allocatedBy: string },
  source: "bank" | "teller"
) {
  if (source === "teller") {
    return "TELLER_ALLOCATION";
  }

  if (isBankOpeningBalance(allocation)) {
    return "OPENING_BALANCE";
  }

  if (isReturnFromTeller(allocation)) {
    return "TELLER_RETURN";
  }

  return "ALLOCATION";
}

export function buildBankVaultTransactions(
  bankAllocations: BankAllocationHistoryInput[],
  tellerAllocations: BankTellerAllocationHistoryInput[]
) {
  let runningBalance = 0;

  const bankTransactions: BankVaultTransaction[] = bankAllocations.map((alloc) => ({
    id: `bank-${alloc.id}`,
    date: alloc.allocatedDate,
    amount: alloc.amount,
    currency: alloc.currency,
    type: getBankTransactionType(alloc, "bank"),
    notes: alloc.notes,
    allocatedBy: alloc.allocatedBy,
    status: alloc.status,
    runningBalance: 0,
  }));

  const tellerTransactions: BankVaultTransaction[] = tellerAllocations
    .filter(isBankToTellerAllocation)
    .map((alloc) => ({
      id: `teller-${alloc.id}`,
      date: alloc.allocatedDate,
      amount: -Math.abs(alloc.amount),
      currency: alloc.currency,
      type: "TELLER_ALLOCATION",
      notes: alloc.notes,
      allocatedBy: alloc.allocatedBy,
      status: alloc.status,
      runningBalance: 0,
    }));

  return [...bankTransactions, ...tellerTransactions]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((tx) => {
      runningBalance += tx.amount;
      return {
        ...tx,
        runningBalance,
      };
    });
}

export function summarizeBankVaultTransactions(
  transactions: BankVaultTransaction[]
) {
  const openingBalance = transactions
    .filter((t) => t.type === "OPENING_BALANCE")
    .reduce((sum, t) => sum + t.amount, 0);

  const allocationsToBank = transactions
    .filter((t) => t.type === "ALLOCATION")
    .reduce((sum, t) => sum + t.amount, 0);

  const tellerReturns = transactions
    .filter((t) => t.type === "TELLER_RETURN")
    .reduce((sum, t) => sum + t.amount, 0);

  const bankToTellerAllocations = transactions
    .filter((t) => t.type === "TELLER_ALLOCATION")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const currentBalance =
    transactions.length > 0 ? transactions[transactions.length - 1].runningBalance : 0;

  return {
    openingBalance,
    allocationsToBank,
    tellerReturns,
    bankToTellerAllocations,
    currentBalance,
    transactionCount: transactions.length,
  };
}
