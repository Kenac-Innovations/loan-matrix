#!/usr/bin/env tsx

/**
 * One-off repair script for cashier-side repayment reversals that were already
 * reversed in Fineract loan transactions, but still need the matching cashier
 * settle entry.
 *
 * Run:
 *   npx tsx scripts/settle-known-repayment-reversals.ts
 */

const FINERACT_BASE_URL =
  process.env.FINERACT_BASE_URL ||
  "http://fineract-dev.10.10.0.24.nip.io:31778";
const FINERACT_TENANT_ID = "goodfellow";
const SERVICE_TOKEN = "bWlmb3M6cGFzc3dvcmQ=";

const TELLER_ID = 35;
const CASHIER_ID = 82;
const DATE_FORMAT = "dd MMMM yyyy";
const LOCALE = "en";
const REQUEST_TIMEOUT_MS = 20_000;

type TargetReversal = {
  loanId: number;
  transactionId: number;
  clientName: string;
  accountNo: string;
};

type LoanTransaction = {
  id: number;
  amount: number;
  currency?: {
    code?: string;
    name?: string;
  };
  transactionDate?: number[];
  type?: {
    repayment?: boolean;
    reversed?: boolean;
  };
  manuallyReversed?: boolean;
  reversed?: boolean;
  date?: number[];
  paymentDetailData?: {
    paymentType?: {
      id?: number;
      name?: string;
    };
  };
};

const TARGETS: TargetReversal[] = [
  {
    loanId: 120334,
    transactionId: 429349,
    clientName: "MUBIANA KALIMUKWA",
    accountNo: "000120334",
  },
   // {
  //   loanId: 120372,
  //   transactionId: 430147,
  //   clientName: "RUTH KACHENJELA",
  //   accountNo: "000120372",
  // },
];

async function fetchFineractAPI(endpoint: string, options: RequestInit = {}) {
  const url = `${FINERACT_BASE_URL}/fineract-provider/api/v1${
    endpoint.startsWith("/") ? endpoint : `/${endpoint}`
  }`;

  console.log(`[Fineract] ${options.method || "GET"} ${url}`);

  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      Authorization: `Basic ${SERVICE_TOKEN}`,
      "Fineract-Platform-TenantId": FINERACT_TENANT_ID,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const text = await response.text();
  return text.trim() ? JSON.parse(text) : {};
}

function formatDateForFineract(dateArray: number[]) {
  const [year, month, day] = dateArray;
  const monthNames = [
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

  return `${day} ${monthNames[month - 1]} ${year}`;
}

function normalizeAmount(value: unknown): number {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid amount: ${String(value)}`);
  }
  return amount;
}

async function getLoanTransaction(
  loanId: number,
  transactionId: number
): Promise<LoanTransaction> {
  const loan = await fetchFineractAPI(
    `/loans/${loanId}?associations=transactions`
  );
  const items: LoanTransaction[] = Array.isArray(loan?.transactions)
    ? loan.transactions
    : [];

  const transaction = items.find((item) => item.id === transactionId);
  if (!transaction) {
    throw new Error(
      `Transaction ${transactionId} not found for loan ${loanId}`
    );
  }

  return transaction;
}

async function settleRepaymentReversal(target: TargetReversal) {
  const transaction = await getLoanTransaction(target.loanId, target.transactionId);

  const isRepayment =
    transaction.type?.repayment === true ||
    transaction.type?.reversed === true ||
    transaction.manuallyReversed === true ||
    transaction.reversed === true;

  if (!isRepayment) {
    throw new Error(
      `Transaction ${target.transactionId} does not look like a repayment reversal`
    );
  }

  const isReversed =
    transaction.manuallyReversed === true ||
    transaction.reversed === true ||
    transaction.type?.reversed === true;

  if (!isReversed) {
    throw new Error(
      `Transaction ${target.transactionId} is not marked reversed in Fineract`
    );
  }

  const amount = normalizeAmount(transaction.amount);
  const dateArray = transaction.transactionDate || transaction.date;
  const currencyCode = transaction.currency?.code;

  if (!Array.isArray(dateArray) || dateArray.length < 3) {
    throw new Error(
      `Transaction ${target.transactionId} does not have a usable transaction date`
    );
  }

  if (!currencyCode) {
    throw new Error(
      `Transaction ${target.transactionId} does not have a currency code`
    );
  }

  const payload = {
    txnDate: formatDateForFineract(dateArray),
    currencyCode,
    txnAmount: amount.toFixed(2),
    txnNote: `Repayment reversal - loan ${target.loanId} repayment transaction ${target.transactionId} (${target.clientName})`,
    dateFormat: DATE_FORMAT,
    locale: LOCALE,
  };

  console.log("");
  console.log(
    `Settling repayment reversal for loan ${target.loanId} / transaction ${target.transactionId}`
  );
  console.log(`Client: ${target.clientName} (${target.accountNo})`);
  console.log(
    `Cashier: ${CASHIER_ID}, Teller: ${TELLER_ID}, Amount: ${payload.txnAmount} ${payload.currencyCode}, Date: ${payload.txnDate}`
  );

  const result = await fetchFineractAPI(
    `/tellers/${TELLER_ID}/cashiers/${CASHIER_ID}/settle`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

  console.log(
    `Settle created successfully. Result: ${JSON.stringify(result)}`
  );
}

async function main() {
  console.log("============================================================");
  console.log("Settle Known Repayment Reversals");
  console.log("============================================================");
  console.log(`Tenant: ${FINERACT_TENANT_ID}`);
  console.log(`Teller: ${TELLER_ID}`);
  console.log(`Cashier: ${CASHIER_ID} (SIMUSOKWE, STEPHEN)`);
  console.log(`Targets: ${TARGETS.map((item) => item.transactionId).join(", ")}`);
  console.log("============================================================");

  for (const target of TARGETS) {
    await settleRepaymentReversal(target);
  }

  console.log("");
  console.log("All repayment reversal settle calls completed.");
}

main().catch((error) => {
  console.error("");
  console.error("Script failed:", error);
  process.exit(1);
});
