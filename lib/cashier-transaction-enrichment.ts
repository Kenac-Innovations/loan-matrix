export type CashierTransactionForLoanContext = {
  id: number | string;
  txnAmount?: number | null;
  amount?: number | null;
  txnDate?: string | number[] | null;
  createdDate?: string | number[] | null;
  transactionDate?: string | number[] | null;
  txnNote?: string | null;
  notes?: string | null;
  entityType?: string | null;
  [key: string]: unknown;
};

export type CashierLoanPayoutReference = {
  id: string;
  fineractLoanId: number;
  fineractClientId: number;
  clientName: string;
  loanAccountNo: string;
  amount: number;
  paidAt: Date | null;
  voidedAt: Date | null;
  createdAt: Date;
};

export type CashierLeadReference = {
  id: string;
  fineractLoanId?: number | null;
  fineractClientId?: number | null;
  externalId?: string | null;
  fullname?: string | null;
  firstname?: string | null;
  middlename?: string | null;
  lastname?: string | null;
};

export type CashierTransactionLoanContext = {
  linkedLoanId: number | null;
  linkedClientId: number | null;
  linkedLeadId: string | null;
  linkedNrc: string | null;
  linkedFullName: string | null;
  loanDetailHref: string | null;
};

const LOAN_REPAYMENT_NOTE_REGEX = /loan repayment\s*#\s*(\d+)/i;
const FINERACT_LOAN_NOTE_REGEX = /\bloan\s*:\s*(\d+)(?:\s*[-,]|\b)/i;
const HASHED_LOAN_NOTE_REGEX = /\bloan\s*#\s*(\d+)(?:\s*[-,]|\b)/i;

export function extractLoanIdFromCashierTransactionNotes(
  notes: string | null | undefined
): number | null {
  if (!notes) return null;

  const match =
    notes.match(LOAN_REPAYMENT_NOTE_REGEX) ??
    notes.match(FINERACT_LOAN_NOTE_REGEX) ??
    notes.match(HASHED_LOAN_NOTE_REGEX);
  if (!match) return null;

  const loanId = Number(match[1]);
  return Number.isFinite(loanId) ? loanId : null;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function getTransactionDate(value: unknown): Date | null {
  if (Array.isArray(value) && value.length >= 3) {
    const [year, month, day] = value;
    if (
      typeof year === "number" &&
      typeof month === "number" &&
      typeof day === "number"
    ) {
      return new Date(year, month - 1, day);
    }
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function isSameCalendarDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function buildCashierLeadFullName(
  lead: Pick<
    CashierLeadReference,
    "fullname" | "firstname" | "middlename" | "lastname"
  >
): string | null {
  const explicit = lead.fullname?.trim();
  if (explicit) return explicit;

  const joined = [lead.firstname, lead.middlename, lead.lastname]
    .filter(Boolean)
    .join(" ")
    .trim();

  return joined || null;
}

function isLoanRelatedCashierTransaction(
  tx: CashierTransactionForLoanContext
): boolean {
  const note = String(tx?.txnNote ?? tx?.notes ?? "");
  const noteLower = normalizeText(note);
  const entityTypeLower = normalizeText(tx.entityType);

  return (
    entityTypeLower === "loans" ||
    noteLower.includes("loan disbursement") ||
    noteLower.includes("payout") ||
    noteLower.includes("credit balance refund") ||
    FINERACT_LOAN_NOTE_REGEX.test(note)
  );
}

export function matchLoanPayoutForCashierTransaction(
  tx: CashierTransactionForLoanContext,
  payouts: CashierLoanPayoutReference[]
): CashierLoanPayoutReference | null {
  const note = String(tx?.txnNote ?? tx?.notes ?? "");
  const noteLoanId = extractLoanIdFromCashierTransactionNotes(note);
  if (noteLoanId != null) {
    const exactPayout = payouts.find(
      (payout) => payout.fineractLoanId === noteLoanId
    );
    if (exactPayout) return exactPayout;
  }

  if (!isLoanRelatedCashierTransaction(tx)) {
    return null;
  }

  const noteLower = normalizeText(note);
  const amount = Math.abs(Number(tx?.txnAmount ?? tx?.amount ?? 0));
  const txDate = getTransactionDate(
    tx?.txnDate ?? tx?.transactionDate ?? tx?.createdDate
  );

  let candidates = payouts.filter(
    (payout) => Math.abs(Math.abs(payout.amount) - amount) < 0.01
  );

  if (txDate) {
    const sameDay = candidates.filter((payout) =>
      isSameCalendarDay(txDate, payout.paidAt ?? payout.voidedAt ?? payout.createdAt)
    );
    if (sameDay.length > 0) {
      candidates = sameDay;
    }
  }

  const byNarration = candidates.filter((payout) => {
    const clientName = normalizeText(payout.clientName);
    const accountNo = normalizeText(payout.loanAccountNo);
    return (
      (!!clientName && noteLower.includes(clientName)) ||
      (!!accountNo && noteLower.includes(accountNo))
    );
  });

  return byNarration[0] ?? candidates[0] ?? null;
}

export function buildCashierTransactionLoanContext({
  tx,
  repaymentLoanId = null,
  payoutMatch = null,
  lead = null,
}: {
  tx: CashierTransactionForLoanContext;
  repaymentLoanId?: number | null;
  payoutMatch?: CashierLoanPayoutReference | null;
  lead?: CashierLeadReference | null;
}): CashierTransactionLoanContext {
  const noteLoanId = extractLoanIdFromCashierTransactionNotes(
    tx?.txnNote ?? tx?.notes
  );
  const linkedLoanId =
    noteLoanId ?? repaymentLoanId ?? payoutMatch?.fineractLoanId ?? null;
  const linkedClientId =
    lead?.fineractClientId ?? payoutMatch?.fineractClientId ?? null;
  const linkedFullName =
    buildCashierLeadFullName(lead ?? {}) ?? payoutMatch?.clientName?.trim() ?? null;
  const loanDetailHref =
    linkedLoanId != null && linkedClientId != null
      ? `/clients/${linkedClientId}/loans/${linkedLoanId}`
      : lead?.id
        ? `/leads/${lead.id}`
        : null;

  return {
    linkedLoanId,
    linkedClientId,
    linkedLeadId: lead?.id ?? null,
    linkedNrc: lead?.externalId ?? null,
    linkedFullName,
    loanDetailHref,
  };
}
