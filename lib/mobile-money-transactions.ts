import { prisma } from "@/lib/prisma";
import { fetchFineractAPI } from "@/lib/api";
import { toFineractCurrencyCode } from "@/lib/currency-utils";
import type { TenantSettings, TenantMobileMoneySettings } from "@/shared/types/tenant";
import type { MobileMoneyTransaction, MobileMoneyTransactionType } from "@/app/generated/prisma";

export type MobileMoneyConfig = Required<
  Pick<
    TenantMobileMoneySettings,
    | "glAccountId"
    | "glAccountName"
    | "glAccountCode"
    | "defaultOfficeId"
    | "defaultOfficeName"
    | "payoutClearingGlAccountId"
    | "payoutClearingGlAccountName"
    | "payoutClearingGlAccountCode"
  >
>;

export type MobileMoneyTransactionView = MobileMoneyTransaction & {
  signedAmount: number;
  runningBalance: number;
  typeLabel: string;
  paymentTypeLabel: string;
  canReverse: boolean;
};

export type MobileMoneySummary = {
  openingBalance: number;
  topUps: number;
  payoutReversals: number;
  payouts: number;
  currentBalance: number;
  transactionCount: number;
};

export function getTenantMobileMoneySettings(
  settings: TenantSettings | Record<string, unknown> | null | undefined
): TenantMobileMoneySettings | null {
  if (!settings || typeof settings !== "object") {
    return null;
  }

  const config = (settings as TenantSettings).mobileMoney;
  if (!config || typeof config !== "object") {
    return null;
  }

  return config;
}

export function getConfiguredMobileMoney(
  settings: TenantSettings | Record<string, unknown> | null | undefined
): MobileMoneyConfig | null {
  const config = getTenantMobileMoneySettings(settings);
  if (
    !config?.glAccountId ||
    !config?.glAccountName ||
    !config?.glAccountCode ||
    !config?.defaultOfficeId ||
    !config?.defaultOfficeName ||
    !config?.payoutClearingGlAccountId ||
    !config?.payoutClearingGlAccountName ||
    !config?.payoutClearingGlAccountCode
  ) {
    return null;
  }

  return {
    glAccountId: config.glAccountId,
    glAccountName: config.glAccountName,
    glAccountCode: config.glAccountCode,
    defaultOfficeId: config.defaultOfficeId,
    defaultOfficeName: config.defaultOfficeName,
    payoutClearingGlAccountId: config.payoutClearingGlAccountId,
    payoutClearingGlAccountName: config.payoutClearingGlAccountName,
    payoutClearingGlAccountCode: config.payoutClearingGlAccountCode,
  };
}

export async function getTenantMobileMoneyConfig(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });

  return {
    settings: getTenantMobileMoneySettings(
      (tenant?.settings as TenantSettings | null | undefined) ?? null
    ),
    configured: getConfiguredMobileMoney(
      (tenant?.settings as TenantSettings | null | undefined) ?? null
    ),
  };
}

export function formatDateForFineract(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return `${value.getDate().toString().padStart(2, "0")} ${
    months[value.getMonth()]
  } ${value.getFullYear()}`;
}

export async function createFineractJournalEntry(input: {
  officeId: number;
  currencyCode: string;
  debitGlAccountId: number;
  creditGlAccountId: number;
  amount: number;
  comments: string;
  transactionDate: Date | string;
  referenceNumber: string;
}) {
  const fineractCurrencyCode = await toFineractCurrencyCode(input.currencyCode);

  const payload = {
    officeId: input.officeId,
    currencyCode: fineractCurrencyCode,
    debits: [
      {
        glAccountId: input.debitGlAccountId,
        amount: input.amount,
      },
    ],
    credits: [
      {
        glAccountId: input.creditGlAccountId,
        amount: input.amount,
      },
    ],
    comments: input.comments,
    referenceNumber: input.referenceNumber,
    transactionDate: formatDateForFineract(input.transactionDate),
    locale: "en",
    dateFormat: "dd MMMM yyyy",
  };

  const result = await fetchFineractAPI("/journalentries", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const journalEntryId =
    result?.transactionId != null
      ? String(result.transactionId)
      : result?.resourceId != null
      ? String(result.resourceId)
      : null;

  return {
    result,
    journalEntryId,
  };
}

export async function reverseFineractJournalEntry(
  journalEntryId: string,
  comments: string
) {
  return fetchFineractAPI(`/journalentries/${journalEntryId}?command=reverse`, {
    method: "POST",
    body: JSON.stringify({ comments }),
  });
}

export function getMobileMoneySignedAmount(
  type: MobileMoneyTransactionType,
  amount: number
) {
  switch (type) {
    case "OPENING_BALANCE":
    case "TOP_UP":
    case "PAYOUT_REVERSAL":
      return Math.abs(amount);
    case "TOP_UP_REVERSAL":
    case "PAYOUT":
      return -Math.abs(amount);
    default:
      return amount;
  }
}

export function getMobileMoneyTypeLabel(type: MobileMoneyTransactionType) {
  switch (type) {
    case "OPENING_BALANCE":
      return "Opening Balance";
    case "TOP_UP":
      return "GL Top-Up";
    case "TOP_UP_REVERSAL":
      return "Top-Up Reversal";
    case "PAYOUT":
      return "Mobile Money Payout";
    case "PAYOUT_REVERSAL":
      return "Payout Reversal";
    default:
      return type;
  }
}

export function getMobileMoneyPaymentLabel(type: MobileMoneyTransactionType) {
  if (type === "TOP_UP" || type === "TOP_UP_REVERSAL") {
    return "GL Funding";
  }

  return "Mobile Money";
}

export function buildMobileMoneyTransactionLedger(
  rows: MobileMoneyTransaction[]
): MobileMoneyTransactionView[] {
  let runningBalance = 0;

  return [...rows]
    .sort((a, b) => {
      const dateDiff =
        new Date(a.transactionDate).getTime() -
        new Date(b.transactionDate).getTime();

      if (dateDiff !== 0) {
        return dateDiff;
      }

      return (
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    })
    .map((row) => {
      const signedAmount = getMobileMoneySignedAmount(row.type, row.amount);
      runningBalance += signedAmount;

      return {
        ...row,
        signedAmount,
        runningBalance,
        typeLabel: getMobileMoneyTypeLabel(row.type),
        paymentTypeLabel: getMobileMoneyPaymentLabel(row.type),
        canReverse: row.type === "TOP_UP" && row.status === "ACTIVE",
      };
    });
}

export function summarizeMobileMoneyTransactions(
  rows: MobileMoneyTransaction[]
): MobileMoneySummary {
  const openingBalance = rows
    .filter((row) => row.type === "OPENING_BALANCE")
    .reduce((sum, row) => sum + row.amount, 0);

  const topUps = rows
    .filter((row) => row.type === "TOP_UP")
    .reduce((sum, row) => sum + row.amount, 0);

  const payoutReversals = rows
    .filter((row) => row.type === "PAYOUT_REVERSAL")
    .reduce((sum, row) => sum + row.amount, 0);

  const payouts = rows
    .filter((row) => row.type === "PAYOUT")
    .reduce((sum, row) => sum + row.amount, 0);

  const ledger = buildMobileMoneyTransactionLedger(rows);
  const currentBalance =
    ledger.length > 0 ? ledger[ledger.length - 1].runningBalance : 0;

  return {
    openingBalance,
    topUps,
    payoutReversals,
    payouts,
    currentBalance,
    transactionCount: rows.length,
  };
}

export async function recordMobileMoneyPayout(input: {
  tenantId: string;
  loanPayoutId: string;
  fineractLoanId: number;
  fineractClientId: number;
  clientName: string;
  loanAccountNo: string;
  amount: number;
  currency: string;
  notes?: string | null;
  createdBy: string;
}) {
  const { configured } = await getTenantMobileMoneyConfig(input.tenantId);
  if (!configured) {
    throw new Error(
      "Mobile money configuration is incomplete. Please configure the mobile money GL account, clearing GL account, and office first."
    );
  }

  const existing = await prisma.mobileMoneyTransaction.findFirst({
    where: {
      tenantId: input.tenantId,
      loanPayoutId: input.loanPayoutId,
      type: "PAYOUT",
    },
  });

  if (existing) {
    return existing;
  }

  const comments =
    input.notes?.trim() ||
    `Mobile money payout for ${input.clientName} (${input.loanAccountNo || input.fineractLoanId})`;

  const journal = await createFineractJournalEntry({
    officeId: configured.defaultOfficeId,
    currencyCode: input.currency,
    debitGlAccountId: configured.payoutClearingGlAccountId,
    creditGlAccountId: configured.glAccountId,
    amount: input.amount,
    comments,
    referenceNumber: `MOMO-PAYOUT-${input.fineractLoanId}-${Date.now()}`,
    transactionDate: new Date(),
  });

  return prisma.mobileMoneyTransaction.create({
    data: {
      tenantId: input.tenantId,
      loanPayoutId: input.loanPayoutId,
      type: "PAYOUT",
      amount: input.amount,
      currency: input.currency,
      transactionDate: new Date(),
      notes: comments,
      status: "ACTIVE",
      createdBy: input.createdBy,
      fineractJournalEntryId: journal.journalEntryId,
      fineractLoanId: input.fineractLoanId,
      fineractClientId: input.fineractClientId,
      clientName: input.clientName,
      loanAccountNo: input.loanAccountNo,
      sourceGlAccountId: configured.payoutClearingGlAccountId,
      sourceGlAccountName: configured.payoutClearingGlAccountName,
      sourceGlAccountCode: configured.payoutClearingGlAccountCode,
      mobileMoneyGlAccountId: configured.glAccountId,
      mobileMoneyGlAccountName: configured.glAccountName,
      mobileMoneyGlAccountCode: configured.glAccountCode,
    },
  });
}

export async function reverseMobileMoneyPayout(input: {
  tenantId: string;
  loanPayoutId: string;
  reversedBy: string;
  reason?: string | null;
}) {
  const payoutTx = await prisma.mobileMoneyTransaction.findFirst({
    where: {
      tenantId: input.tenantId,
      loanPayoutId: input.loanPayoutId,
      type: "PAYOUT",
    },
  });

  if (!payoutTx) {
    throw new Error(
      "No mobile money payout transaction was found for this loan payout."
    );
  }

  if (payoutTx.status === "REVERSED") {
    const existingReversal = await prisma.mobileMoneyTransaction.findFirst({
      where: {
        tenantId: input.tenantId,
        reversalOfId: payoutTx.id,
        type: "PAYOUT_REVERSAL",
      },
    });

    if (existingReversal) {
      return existingReversal;
    }
  }

  if (!payoutTx.fineractJournalEntryId) {
    throw new Error(
      "The original mobile money payout does not have a journal entry reference to reverse."
    );
  }

  const reversalReason =
    input.reason?.trim() || "Mobile money payout reversed";

  if (
    !payoutTx.mobileMoneyGlAccountId ||
    !payoutTx.sourceGlAccountId ||
    !payoutTx.fineractLoanId
  ) {
    throw new Error(
      "The original mobile money payout is missing GL configuration details for reversal."
    );
  }

  const { configured } = await getTenantMobileMoneyConfig(input.tenantId);
  if (!configured) {
    throw new Error(
      "Mobile money configuration is incomplete. Please configure the mobile money GL account, clearing GL account, and office first."
    );
  }

  const journal = await createFineractJournalEntry({
    officeId: configured.defaultOfficeId,
    currencyCode: payoutTx.currency,
    debitGlAccountId: payoutTx.mobileMoneyGlAccountId,
    creditGlAccountId: payoutTx.sourceGlAccountId,
    amount: payoutTx.amount,
    comments: `${reversalReason} (${input.reversedBy})`,
    referenceNumber: `MOMO-PAYOUT-REV-${payoutTx.fineractLoanId}-${Date.now()}`,
    transactionDate: new Date(),
  });

  const reversal = await prisma.mobileMoneyTransaction.create({
    data: {
      tenantId: input.tenantId,
      loanPayoutId: payoutTx.loanPayoutId,
      type: "PAYOUT_REVERSAL",
      amount: payoutTx.amount,
      currency: payoutTx.currency,
      transactionDate: new Date(),
      notes: `${reversalReason} [Reversal of ${payoutTx.id}]`,
      status: "ACTIVE",
      createdBy: input.reversedBy,
      reversalOfId: payoutTx.id,
      fineractJournalEntryId: journal.journalEntryId,
      fineractLoanId: payoutTx.fineractLoanId,
      fineractClientId: payoutTx.fineractClientId,
      clientName: payoutTx.clientName,
      loanAccountNo: payoutTx.loanAccountNo,
      sourceGlAccountId: payoutTx.sourceGlAccountId,
      sourceGlAccountName: payoutTx.sourceGlAccountName,
      sourceGlAccountCode: payoutTx.sourceGlAccountCode,
      mobileMoneyGlAccountId: payoutTx.mobileMoneyGlAccountId,
      mobileMoneyGlAccountName: payoutTx.mobileMoneyGlAccountName,
      mobileMoneyGlAccountCode: payoutTx.mobileMoneyGlAccountCode,
    },
  });

  await prisma.mobileMoneyTransaction.update({
    where: { id: payoutTx.id },
    data: {
      status: "REVERSED",
      reversedAt: new Date(),
      reversedBy: input.reversedBy,
      reversalReason,
    },
  });

  return reversal;
}
