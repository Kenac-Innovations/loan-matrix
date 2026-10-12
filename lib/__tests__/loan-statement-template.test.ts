import assert from "node:assert/strict";
import test from "node:test";

import {
  generateLoanStatementHTML,
  transformFineractLoanToStatement,
  getPrincipalBalanceEffect,
  getRunningBalanceEffect,
} from "../loan-statement-template";

function buildRulethuLoan() {
  return {
    accountNo: "000000335",
    clientName: "Hanzala Minerals",
    annualInterestRate: 66,
    currency: { code: "USD", displaySymbol: "$" },
    summary: {
      interestCharged: 36897.84,
      principalDisbursed: 150000,
      principalOutstanding: 50000,
      totalOutstanding: 70161.09,
    },
    transactions: [
      {
        id: 1,
        date: [2026, 3, 2],
        amount: 150000,
        // Actual Fineract disbursement records commonly set this to zero.
        principalPortion: 0,
        interestPortion: 0,
        feeChargesPortion: 0,
        penaltyChargesPortion: 0,
        outstandingLoanBalance: 150000,
        type: { value: "Disbursement", disbursement: true },
      },
      {
        id: 2,
        date: [2026, 3, 3],
        amount: 36897.84,
        principalPortion: 0,
        interestPortion: 36897.84,
        feeChargesPortion: 0,
        penaltyChargesPortion: 0,
        // This is the Rulethu-shaped discrepancy: Fineract reports zero on
        // the accrual row even though the ledger movement is a debit.
        outstandingLoanBalance: 0,
        type: { value: "Accrual", accrual: true },
      },
      {
        id: 3,
        date: [2026, 3, 4],
        amount: 5000,
        principalPortion: 0,
        interestPortion: 5000,
        feeChargesPortion: 0,
        penaltyChargesPortion: 0,
        manuallyReversed: true,
        type: { value: "Accrual", accrual: true },
      },
      {
        id: 4,
        date: [2026, 3, 5],
        amount: 122749.95,
        principalPortion: 100000,
        interestPortion: 22700,
        feeChargesPortion: 30,
        penaltyChargesPortion: 19.95,
        type: { value: "Repayment", repayment: true },
      },
      {
        id: 5,
        date: [2026, 3, 6],
        // Portion fields are absent on some Fineract rows.
        type: { value: "Transfer initiated" },
      },
    ],
    timeline: { actualDisbursementDate: [2026, 3, 2] },
  };
}

function transformRulethuLoan(options = {}) {
  return transformFineractLoanToStatement(
    buildRulethuLoan(),
    { displayName: "Hanzala Minerals" },
    { name: "Rulethu Organization" },
    undefined,
    undefined,
    undefined,
    undefined,
    "annual",
    options
  );
}

test("renders component allocations and tracks principal balance using summary outstanding as closing", () => {
  const statement = transformRulethuLoan();
  const openingRow = statement.transactions[0];
  const disbursementRow = statement.transactions.find((row) => row.id === 1);
  const accrualRow = statement.transactions.find((row) => row.id === 2);
  const repaymentRow = statement.transactions.find((row) => row.id === 4);

  assert.deepEqual(
    [openingRow.principal, openingRow.interest, openingRow.fees, openingRow.penalties],
    [0, 0, 0, 0]
  );
  assert.deepEqual(
    [
      disbursementRow?.principal,
      disbursementRow?.interest,
      disbursementRow?.fees,
      disbursementRow?.penalties,
    ],
    [150000, 0, 0, 0]
  );
  assert.deepEqual(
    [accrualRow?.principal, accrualRow?.interest, accrualRow?.fees, accrualRow?.penalties],
    [0, 36897.84, 0, 0]
  );
  assert.deepEqual(
    [repaymentRow?.principal, repaymentRow?.interest, repaymentRow?.fees, repaymentRow?.penalties],
    [100000, 22700, 30, 19.95]
  );

  // Principal balance tracking (changed from ledger balance):
  // - Opening: 0
  // - Disbursement: +150,000 = 150,000
  // - Accrual: no change = 150,000
  // - Repayment: -100,000 (principal portion) = 50,000
  assert.equal(statement.openingBalance, 0);
  assert.equal(disbursementRow?.cumulativeBalance, 150000);
  assert.equal(accrualRow?.cumulativeBalance, 150000); // Accrual doesn't change principal balance
  assert.equal(repaymentRow?.cumulativeBalance, 50000); // 150,000 - 100,000

  assert.equal(statement.totalDebits.toFixed(2), "186897.84");
  assert.equal(statement.totalCredits.toFixed(2), "122749.95");
  assert.equal(statement.ledgerClosingBalance.toFixed(2), "64147.89"); // Old ledger balance for reference
  assert.equal(statement.closingBalance, 50000); // Using summary.principalOutstanding
  assert.equal(statement.closingBalanceSource, "summary");
  assert.equal(statement.totalOutstanding, 70161.09); // Total outstanding (principal + interest + fees)

  const html = generateLoanStatementHTML(statement);
  for (const header of [
    "Principal",
    "Interest",
    "Fees",
    "Penalties",
    "Principal Balance",
  ]) {
    assert.match(html, new RegExp(`>${header}<`));
  }
  assert.doesNotMatch(html, />Running Ledger Balance</);
  assert.match(html, />150,000\.00</);
  assert.match(html, />36,897\.84</);
  assert.match(html, />30\.00</);
  assert.match(html, />19\.95</);
  assert.doesNotMatch(html, />Transaction Ledger Balance</);
  assert.doesNotMatch(html, />Closing Outstanding Balance</);
  assert.match(html, />Closing Principal Balance</);
  assert.match(html, />Total Outstanding \(incl\. interest &amp; fees\)</);
  assert.match(html, /\$50,000\.00/); // Closing principal balance
  assert.match(html, /\$70,161\.09/); // Total outstanding
  assert.doesNotMatch(html, /outstandingLoanBalance/);
});

test("derives row running balances from principal movements and excludes reversed rows", () => {
  const statement = transformRulethuLoan();
  const disbursementRow = statement.transactions.find((row) => row.id === 1);
  const accrualRow = statement.transactions.find((row) => row.id === 2);
  const reversedRow = statement.transactions.find((row) => row.id === 3);

  // Principal balance tracking:
  // - Disbursement: 150,000
  // - Accrual: 150,000 (no change to principal)
  // - Reversed accrual: 150,000 (reversed rows don't affect balance)
  assert.equal(disbursementRow?.cumulativeBalance, 150000);
  assert.equal(accrualRow?.cumulativeBalance, 150000);
  assert.equal(reversedRow?.cumulativeBalance, 150000); // Reversed: no change
  assert.equal(reversedRow?.interest, 5000);
  assert.equal(reversedRow?.isReversed, true);
  assert.equal(statement.ledgerClosingBalance.toFixed(2), "64147.89");
});

test("allows filtered statements to use transaction-ledger closing balance (which is principal balance)", () => {
  const statement = transformRulethuLoan({ balanceSource: "transaction-ledger" });

  // When using transaction-ledger balance source, closing balance should be the principal balance
  // from transaction calculations: 150,000 (disbursement) - 100,000 (repayment principal) = 50,000
  assert.equal(statement.closingBalance, 50000);
  assert.equal(statement.closingBalanceSource, "transaction-ledger");
  // When filtered, totalOutstanding should be null (not included from summary)
  assert.equal(statement.totalOutstanding, null);

  const html = generateLoanStatementHTML(statement);
  assert.match(html, />Closing Principal Balance</);
  assert.doesNotMatch(html, />Closing Outstanding Balance</);
  assert.doesNotMatch(html, />Transaction Ledger Balance</);
  assert.doesNotMatch(html, />Total Outstanding \(incl\. interest &amp; fees\)/); // Should not be shown when filtered
  assert.doesNotMatch(html, />Running Ledger Balance</);
});

test("tracks principal balance for a credit-only statement", () => {
  const statement = transformFineractLoanToStatement(
    {
      accountNo: "FILTERED",
      currency: { code: "USD", displaySymbol: "$" },
      summary: { totalOutstanding: 999 },
      transactions: [
        {
          id: 99,
          date: [2026, 3, 5],
          amount: 100,
          principalPortion: 100,
          type: { value: "Repayment", repayment: true },
        },
      ],
    },
    null,
    { name: "Rulethu Organization" },
    "05 March 2026",
    "05 March 2026",
    undefined,
    undefined,
    "annual",
    { balanceSource: "transaction-ledger" }
  );

  // Principal balance starts at 0, repayment subtracts 100 principal
  assert.equal(statement.transactions[0]?.cumulativeBalance, 0); // B/Fwd
  assert.equal(statement.transactions[1]?.cumulativeBalance, -100); // After repayment
  assert.equal(statement.closingBalance, -100);

  const html = generateLoanStatementHTML(statement);
  assert.match(html, />-100\.00</);
});

test("tests getPrincipalBalanceEffect helper for various transaction types", () => {
  // Disbursement: principal increases
  const disbursement = {
    id: 1,
    date: [2026, 3, 2],
    amount: 150000,
    principalPortion: 0,
    type: { disbursement: true },
  };
  assert.equal(getPrincipalBalanceEffect(disbursement), 150000);

  // Accrual: no effect
  const accrual = {
    id: 2,
    date: [2026, 3, 3],
    amount: 8250,
    principalPortion: 0,
    interestPortion: 8250,
    type: { accrual: true },
  };
  assert.equal(getPrincipalBalanceEffect(accrual), 0);

  // Repayment: principal decreases
  const repayment = {
    id: 3,
    date: [2026, 3, 5],
    amount: 13200,
    principalPortion: 4950,
    interestPortion: 8250,
    type: { repayment: true },
  };
  assert.equal(getPrincipalBalanceEffect(repayment), -4950);

  // Reversed: no effect
  const reversedRepayment = {
    id: 4,
    date: [2026, 3, 6],
    amount: 5000,
    principalPortion: 5000,
    type: { repayment: true },
    manuallyReversed: true,
  };
  assert.equal(getPrincipalBalanceEffect(reversedRepayment), 0);

  // Charge payment: principal decreases
  const chargePayment = {
    id: 5,
    date: [2026, 3, 7],
    amount: 500,
    principalPortion: 500,
    type: { code: "chargePayment" },
  };
  assert.equal(getPrincipalBalanceEffect(chargePayment), -500);

  // Waiver: principal decreases
  const waiver = {
    id: 6,
    date: [2026, 3, 8],
    amount: 1000,
    principalPortion: 1000,
    type: { code: "waive" },
  };
  assert.equal(getPrincipalBalanceEffect(waiver), -1000);

  // Write-off: principal decreases
  const writeOff = {
    id: 7,
    date: [2026, 3, 9],
    amount: 2000,
    principalPortion: 2000,
    type: { code: "writeOff" },
  };
  assert.equal(getPrincipalBalanceEffect(writeOff), -2000);
});

test("handles admin fee (repaymentAtDisbursement) as debit AND credit with zero net balance effect", () => {
  const statement = transformFineractLoanToStatement(
    {
      accountNo: "000000335",
      clientName: "Test Client",
      currency: { code: "ZMW", displaySymbol: "K" },
      summary: {
        principalDisbursed: 150000,
        totalOutstanding: 150000,
      },
      transactions: [
        {
          id: 1,
          date: [2026, 3, 2],
          amount: 150000,
          principalPortion: 0,
          interestPortion: 0,
          feeChargesPortion: 0,
          penaltyChargesPortion: 0,
          type: { disbursement: true },
        },
        {
          id: 2,
          date: [2026, 3, 2],
          amount: 4500,
          principalPortion: 0,
          interestPortion: 0,
          feeChargesPortion: 4500,
          penaltyChargesPortion: 0,
          type: { repaymentAtDisbursement: true },
        },
      ],
      timeline: { actualDisbursementDate: [2026, 3, 2] },
    },
    { displayName: "Test Client" },
    { name: "Test Organization" },
    undefined,
    undefined,
    undefined,
    undefined,
    "annual",
    { balanceSource: "transaction-ledger" }
  );

  const disbursementRow = statement.transactions.find((row) => row.id === 1);
  const feeRow = statement.transactions.find((row) => row.id === 2);

  // Disbursement: 150,000 principal
  assert.equal(disbursementRow?.debit, 150000);
  assert.equal(disbursementRow?.credit, 0);
  assert.equal(disbursementRow?.cumulativeBalance, 150000);

  // Admin fee: shown as both debit AND credit, with balance staying at 150,000
  assert.equal(feeRow?.debit, 4500, "Admin fee should show as debit");
  assert.equal(feeRow?.credit, 4500, "Admin fee should show as credit");
  assert.equal(feeRow?.fees, 4500, "Fee portion should be recorded");
  assert.equal(feeRow?.cumulativeBalance, 150000, "Principal balance should not change for admin fee");

  // totalDebits should include the 4,500 admin fee
  assert.equal(statement.totalDebits, 154500, "totalDebits should include disbursement 150,000 + admin fee 4,500");

  // Closing balance should be 150,000
  assert.equal(statement.closingBalance, 150000);

  // HTML should contain "Closing Principal Balance" and "Running Ledger Balance" should not appear
  const html = generateLoanStatementHTML(statement);
  assert.match(html, />Closing Principal Balance</);
  assert.doesNotMatch(html, />Running Ledger Balance</);
});

test("processes full principal balance scenario from requirements", () => {
  const statement = transformFineractLoanToStatement(
    {
      accountNo: "000000335",
      clientName: "Hanzala Minerals",
      currency: { code: "USD", displaySymbol: "$" },
      summary: {
        principalDisbursed: 150000,
        totalOutstanding: 141050.02,
      },
      transactions: [
        // Disbursement: 150,000
        {
          id: 1,
          date: [2026, 3, 2],
          amount: 150000,
          principalPortion: 0,
          interestPortion: 0,
          feeChargesPortion: 0,
          penaltyChargesPortion: 0,
          type: { disbursement: true },
        },
        // Admin Fee: 4,500 (fee only, no principal)
        {
          id: 2,
          date: [2026, 3, 2],
          amount: 4500,
          principalPortion: 0,
          interestPortion: 0,
          feeChargesPortion: 4500,
          penaltyChargesPortion: 0,
          type: { repaymentAtDisbursement: true },
        },
        // Accrual: 8,250 (interest)
        {
          id: 3,
          date: [2026, 4, 20],
          amount: 8250,
          principalPortion: 0,
          interestPortion: 8250,
          feeChargesPortion: 0,
          penaltyChargesPortion: 0,
          type: { accrual: true },
        },
        // Repayment: 8,250 (all interest, no principal)
        {
          id: 4,
          date: [2026, 5, 7],
          amount: 8250,
          principalPortion: 0,
          interestPortion: 8250,
          feeChargesPortion: 0,
          penaltyChargesPortion: 0,
          type: { repayment: true },
        },
        // Repayment: 13,200 (principal 4,950 + interest 8,250)
        {
          id: 5,
          date: [2026, 5, 18],
          amount: 13200,
          principalPortion: 4950,
          interestPortion: 8250,
          feeChargesPortion: 0,
          penaltyChargesPortion: 0,
          type: { repayment: true },
        },
        // Repayment: 3,999.98 (all principal)
        {
          id: 6,
          date: [2026, 6, 4],
          amount: 3999.98,
          principalPortion: 3999.98,
          interestPortion: 0,
          feeChargesPortion: 0,
          penaltyChargesPortion: 0,
          type: { repayment: true },
        },
      ],
      timeline: { actualDisbursementDate: [2026, 3, 2] },
    },
    { displayName: "Hanzala Minerals" },
    { name: "Test Organization" },
    undefined,
    undefined,
    undefined,
    undefined,
    "annual",
    { balanceSource: "transaction-ledger" }
  );

  const disbursement = statement.transactions.find((row) => row.id === 1);
  const fee = statement.transactions.find((row) => row.id === 2);
  const accrual = statement.transactions.find((row) => row.id === 3);
  const repayment1 = statement.transactions.find((row) => row.id === 4);
  const repayment2 = statement.transactions.find((row) => row.id === 5);
  const repayment3 = statement.transactions.find((row) => row.id === 6);

  // Disbursement: 150,000
  assert.equal(disbursement?.cumulativeBalance, 150000);
  assert.equal(disbursement?.debit, 150000);
  assert.equal(disbursement?.credit, 0);

  // Admin fee: shown as debit 4500 AND credit 4500, balance stays at 150,000
  assert.equal(fee?.cumulativeBalance, 150000);
  assert.equal(fee?.debit, 4500);
  assert.equal(fee?.credit, 4500);
  assert.equal(fee?.fees, 4500);

  // Accrual: no effect on principal balance
  assert.equal(accrual?.cumulativeBalance, 150000);

  // Repayment 8,250 (interest only): balance stays at 150,000
  assert.equal(repayment1?.cumulativeBalance, 150000);

  // Repayment 13,200 (principal 4,950): balance becomes 145,050
  assert.equal(repayment2?.cumulativeBalance, 145050);

  // Repayment 3,999.98 (principal only): balance becomes 141,050.02
  assert.equal(repayment3?.cumulativeBalance.toFixed(2), "141050.02");

  // Closing balance
  assert.equal(statement.closingBalance, 141050.02);
});

test("filtered statement starting from 1 May with opening balance", () => {
  // Transactions that occurred before May 1st to calculate opening balance
  const allTransactions = [
    {
      id: 1,
      date: [2026, 3, 2],
      amount: 150000,
      principalPortion: 0,
      type: { disbursement: true },
    },
    {
      id: 2,
      date: [2026, 3, 2],
      amount: 4500,
      principalPortion: 0,
      feeChargesPortion: 4500,
      type: { repaymentAtDisbursement: true },
    },
    {
      id: 3,
      date: [2026, 4, 20],
      amount: 8250,
      principalPortion: 0,
      type: { accrual: true },
    },
    {
      id: 4,
      date: [2026, 5, 7],
      amount: 8250,
      principalPortion: 0,
      type: { repayment: true },
    },
  ];

  // Compute opening balance manually
  let openingBalance = 0;
  for (const tx of allTransactions) {
    openingBalance += getPrincipalBalanceEffect(tx);
  }

  // Create statement with opening balance (simulating filtered statement)
  const statement = transformFineractLoanToStatement(
    {
      accountNo: "000000335",
      clientName: "Hanzala Minerals",
      currency: { code: "USD", displaySymbol: "$" },
      summary: { totalOutstanding: 150000 },
      transactions: allTransactions.slice(3), // Only transactions from May 1st onward
      timeline: { actualDisbursementDate: [2026, 3, 2] },
    },
    { displayName: "Hanzala Minerals" },
    { name: "Test Organization" },
    "01 May 2026",
    undefined,
    undefined,
    undefined,
    "annual",
    {
      balanceSource: "transaction-ledger",
      openingBalance: openingBalance, // Pass the computed opening balance
    }
  );

  // B/Fwd should show the opening principal balance
  assert.equal(statement.transactions[0]?.cumulativeBalance, 150000);
  assert.equal(statement.openingBalance, 150000);

  // First visible transaction (repayment on May 7) starts from 150,000
  const firstTx = statement.transactions[1];
  assert.equal(firstTx?.cumulativeBalance, 150000); // No principal change
});

test("reversed repayment does not change principal balance", () => {
  const statement = transformFineractLoanToStatement(
    {
      accountNo: "TEST",
      currency: { code: "USD", displaySymbol: "$" },
      summary: { totalOutstanding: 150000 },
      transactions: [
        {
          id: 1,
          date: [2026, 3, 2],
          amount: 150000,
          principalPortion: 0,
          type: { disbursement: true },
        },
        {
          id: 2,
          date: [2026, 3, 3],
          amount: 10000,
          principalPortion: 10000,
          type: { repayment: true },
        },
        {
          id: 3,
          date: [2026, 3, 4],
          amount: 10000,
          principalPortion: 10000,
          type: { repayment: true },
          manuallyReversed: true,
        },
        {
          id: 4,
          date: [2026, 3, 5],
          amount: 5000,
          principalPortion: 5000,
          type: { repayment: true },
        },
      ],
      timeline: { actualDisbursementDate: [2026, 3, 2] },
    },
    null,
    { name: "Test Organization" },
    undefined,
    undefined,
    undefined,
    undefined,
    "annual",
    { balanceSource: "transaction-ledger" }
  );

  const disbursement = statement.transactions.find((row) => row.id === 1);
  const firstRepayment = statement.transactions.find((row) => row.id === 2);
  const reversedRepayment = statement.transactions.find((row) => row.id === 3);
  const thirdRepayment = statement.transactions.find((row) => row.id === 4);

  // Disbursement: 150,000
  assert.equal(disbursement?.cumulativeBalance, 150000);

  // First repayment: -10,000 = 140,000
  assert.equal(firstRepayment?.cumulativeBalance, 140000);

  // Reversed repayment: no effect = 140,000
  assert.equal(reversedRepayment?.cumulativeBalance, 140000);
  assert.equal(reversedRepayment?.isReversed, true);

  // Third repayment: -5,000 = 135,000
  assert.equal(thirdRepayment?.cumulativeBalance, 135000);

  assert.equal(statement.closingBalance, 135000);
});

test("reversed repaymentAtDisbursement does not add to totalDebits", () => {
  const statement = transformFineractLoanToStatement(
    {
      accountNo: "000000335",
      clientName: "Test Client",
      currency: { code: "ZMW", displaySymbol: "K" },
      summary: {
        principalDisbursed: 150000,
        totalOutstanding: 150000,
      },
      transactions: [
        {
          id: 1,
          date: [2026, 3, 2],
          amount: 150000,
          principalPortion: 0,
          interestPortion: 0,
          feeChargesPortion: 0,
          penaltyChargesPortion: 0,
          type: { disbursement: true },
        },
        {
          id: 2,
          date: [2026, 3, 2],
          amount: 4500,
          principalPortion: 0,
          interestPortion: 0,
          feeChargesPortion: 4500,
          penaltyChargesPortion: 0,
          type: { repaymentAtDisbursement: true },
          manuallyReversed: true, // Reversed admin fee
        },
      ],
      timeline: { actualDisbursementDate: [2026, 3, 2] },
    },
    { displayName: "Test Client" },
    { name: "Test Organization" },
    undefined,
    undefined,
    undefined,
    undefined,
    "annual",
    { balanceSource: "transaction-ledger" }
  );

  const disbursementRow = statement.transactions.find((row) => row.id === 1);
  const reversedFeeRow = statement.transactions.find((row) => row.id === 2);

  // Disbursement: 150,000 principal
  assert.equal(disbursementRow?.debit, 150000);
  assert.equal(disbursementRow?.credit, 0);

  // Reversed admin fee: marked as reversed
  assert.equal(reversedFeeRow?.isReversed, true);

  // totalDebits should be 150,000 (only the disbursement, not the reversed fee)
  // The key requirement: reversed repaymentAtDisbursement does not add to totalDebits
  assert.equal(statement.totalDebits, 150000, "totalDebits should not include reversed admin fee");
});

test("getPrincipalBalanceEffect covers down payments, refunds and chargebacks", () => {
  const tx = (type: Record<string, unknown>, principalPortion = 1000) => ({
    amount: 1500,
    principalPortion,
    type: type as never,
  });

  assert.equal(getPrincipalBalanceEffect(tx({ downPayment: true })), -1000);
  assert.equal(getPrincipalBalanceEffect(tx({ merchantIssuedRefund: true })), -1000);
  assert.equal(getPrincipalBalanceEffect(tx({ payoutRefund: true })), -1000);
  assert.equal(getPrincipalBalanceEffect(tx({ goodwillCredit: true })), -1000);
  assert.equal(getPrincipalBalanceEffect(tx({ chargeback: true })), 1000);
  assert.equal(getPrincipalBalanceEffect(tx({ refundForActiveLoans: true })), 1000);
  assert.equal(getPrincipalBalanceEffect(tx({ chargeoff: true, value: "Charge-off" })), 0);
  assert.equal(
    getPrincipalBalanceEffect({ ...tx({ downPayment: true }), manuallyReversed: true }),
    0
  );
});

test("statement footer reconciles principal movements to the closing principal balance", () => {
  const statement = transformFineractLoanToStatement(
    {
      accountNo: "000000335",
      currency: { code: "USD", displaySymbol: "$" },
      summary: { principalOutstanding: 145050, totalOutstanding: 153300 },
      transactions: [
        { id: 1, date: [2026, 3, 2], amount: 150000, principalPortion: 0, type: { disbursement: true } },
        { id: 2, date: [2026, 3, 2], amount: 4500, feeChargesPortion: 4500, type: { repaymentAtDisbursement: true } },
        { id: 3, date: [2026, 4, 20], amount: 8250, interestPortion: 8250, type: { accrual: true } },
        { id: 4, date: [2026, 5, 18], amount: 13200, principalPortion: 4950, interestPortion: 8250, type: { repayment: true } },
      ],
      timeline: { actualDisbursementDate: [2026, 3, 2] },
    },
    { displayName: "Hanzala Minerals" },
    { name: "Rulethu Organization" }
  );

  assert.equal(statement.principalIncreases, 150000);
  assert.equal(statement.principalDecreases, 4950);
  assert.equal(
    statement.openingBalance + (statement.principalIncreases ?? 0) - (statement.principalDecreases ?? 0),
    statement.closingBalance
  );
  assert.equal(statement.transactions.at(-1)?.cumulativeBalance, statement.closingBalance);

  const html = generateLoanStatementHTML(statement);
  assert.match(html, />Principal Disbursed</);
  assert.match(html, />Principal Repaid</);
  assert.doesNotMatch(html, />Total Debits</);
});

test("getRunningBalanceEffect covers disbursement, accrual, repayment, and fee rows", () => {
  // Disbursement: running balance increases
  const disbursement = {
    id: 1,
    date: [2026, 3, 2],
    amount: 150000,
    principalPortion: 0,
    type: { disbursement: true },
  };
  assert.equal(getRunningBalanceEffect(disbursement), 150000);

  // Accrual: running balance increases
  const accrual = {
    id: 2,
    date: [2026, 3, 3],
    amount: 8250,
    principalPortion: 0,
    interestPortion: 8250,
    type: { accrual: true },
  };
  assert.equal(getRunningBalanceEffect(accrual), 8250);

  // Repayment: running balance decreases
  const repayment = {
    id: 3,
    date: [2026, 5, 18],
    amount: 13200,
    principalPortion: 4950,
    interestPortion: 8250,
    type: { repayment: true },
  };
  assert.equal(getRunningBalanceEffect(repayment), -13200);

  // Admin fee (repaymentAtDisbursement): net 0
  const adminFee = {
    id: 4,
    date: [2026, 3, 2],
    amount: 4500,
    principalPortion: 0,
    interestPortion: 0,
    feeChargesPortion: 4500,
    penaltyChargesPortion: 0,
    type: { repaymentAtDisbursement: true },
  };
  assert.equal(getRunningBalanceEffect(adminFee), 0);

  // Reversed: no effect
  const reversedRepayment = {
    id: 5,
    date: [2026, 5, 19],
    amount: 5000,
    principalPortion: 5000,
    type: { repayment: true },
    manuallyReversed: true,
  };
  assert.equal(getRunningBalanceEffect(reversedRepayment), 0);
});

test("loan 335 fixture: disbursement, admin fee, accrual, repayments with running balances", () => {
  const statement = transformFineractLoanToStatement(
    {
      accountNo: "000000335",
      clientName: "Hanzala Minerals",
      currency: { code: "USD", displaySymbol: "$" },
      summary: {
        principalDisbursed: 150000,
        totalOutstanding: 136800,
      },
      transactions: [
        // Disbursement: 150,000 (2 Mar)
        {
          id: 1,
          date: [2026, 3, 2],
          amount: 150000,
          principalPortion: 0,
          interestPortion: 0,
          feeChargesPortion: 0,
          penaltyChargesPortion: 0,
          type: { disbursement: true },
        },
        // Admin fee: 4,500 fee portion (2 Mar)
        {
          id: 2,
          date: [2026, 3, 2],
          amount: 4500,
          principalPortion: 0,
          interestPortion: 0,
          feeChargesPortion: 4500,
          penaltyChargesPortion: 0,
          type: { repaymentAtDisbursement: true },
        },
        // Accrual: 8,250 (20 Apr)
        {
          id: 3,
          date: [2026, 4, 20],
          amount: 8250,
          principalPortion: 0,
          interestPortion: 8250,
          feeChargesPortion: 0,
          penaltyChargesPortion: 0,
          type: { accrual: true },
        },
        // Repayment: 8,250 all interest (7 May)
        {
          id: 4,
          date: [2026, 5, 7],
          amount: 8250,
          principalPortion: 0,
          interestPortion: 8250,
          feeChargesPortion: 0,
          penaltyChargesPortion: 0,
          type: { repayment: true },
        },
        // Repayment: 13,200 = principal 4,950 + interest 8,250 (18 May)
        {
          id: 5,
          date: [2026, 5, 18],
          amount: 13200,
          principalPortion: 4950,
          interestPortion: 8250,
          feeChargesPortion: 0,
          penaltyChargesPortion: 0,
          type: { repayment: true },
        },
      ],
      timeline: { actualDisbursementDate: [2026, 3, 2] },
    },
    { displayName: "Hanzala Minerals" },
    { name: "Test Organization" },
    undefined,
    undefined,
    undefined,
    undefined,
    "annual",
    { balanceSource: "transaction-ledger" }
  );

  const disbursement = statement.transactions.find((row) => row.id === 1);
  const adminFee = statement.transactions.find((row) => row.id === 2);
  const accrual = statement.transactions.find((row) => row.id === 3);
  const repayment1 = statement.transactions.find((row) => row.id === 4);
  const repayment2 = statement.transactions.find((row) => row.id === 5);

  // Running balance: 150,000, 150,000, 158,250, 150,000, 136,800
  assert.equal(disbursement?.runningBalance, 150000);
  assert.equal(adminFee?.runningBalance, 150000);
  assert.equal(accrual?.runningBalance, 158250);
  assert.equal(repayment1?.runningBalance, 150000);
  assert.equal(repayment2?.runningBalance, 136800);

  // Principal balance: 150,000, 150,000, 150,000, 150,000, 145,050
  assert.equal(disbursement?.cumulativeBalance, 150000);
  assert.equal(adminFee?.cumulativeBalance, 150000);
  assert.equal(accrual?.cumulativeBalance, 150000);
  assert.equal(repayment1?.cumulativeBalance, 150000);
  assert.equal(repayment2?.cumulativeBalance, 145050);

  assert.equal(statement.closingRunningBalance, 136800);
  assert.equal(statement.closingBalance, 145050);
});

test("opening running balance option: B/Fwd row and subsequent rows use it", () => {
  const statement = transformFineractLoanToStatement(
    {
      accountNo: "000000335",
      clientName: "Hanzala Minerals",
      currency: { code: "USD", displaySymbol: "$" },
      summary: { totalOutstanding: 136800 },
      transactions: [
        {
          id: 1,
          date: [2026, 5, 7],
          amount: 8250,
          principalPortion: 0,
          type: { repayment: true },
        },
      ],
      timeline: { actualDisbursementDate: [2026, 3, 2] },
    },
    { displayName: "Hanzala Minerals" },
    { name: "Test Organization" },
    "01 May 2026",
    undefined,
    undefined,
    undefined,
    "annual",
    {
      balanceSource: "transaction-ledger",
      openingRunningBalance: 158250,
    }
  );

  const bfwdRow = statement.transactions[0];
  const repaymentRow = statement.transactions[1];

  // B/Fwd should show the opening running balance
  assert.equal(bfwdRow?.runningBalance, 158250);
  assert.equal(statement.openingRunningBalance, 158250);

  // First transaction row continues from opening running balance
  assert.equal(repaymentRow?.runningBalance, 150000); // 158250 - 8250
  assert.equal(statement.closingRunningBalance, 150000);
});

test("HTML contains Running Balance and Principal Balance headers in correct order", () => {
  const statement = transformFineractLoanToStatement(
    {
      accountNo: "000000335",
      currency: { code: "USD", displaySymbol: "$" },
      summary: { totalOutstanding: 150000 },
      transactions: [
        { id: 1, date: [2026, 3, 2], amount: 150000, principalPortion: 0, type: { disbursement: true } },
      ],
      timeline: { actualDisbursementDate: [2026, 3, 2] },
    },
    null,
    { name: "Test Organization" },
    undefined,
    undefined,
    undefined,
    undefined,
    "annual",
    { balanceSource: "transaction-ledger" }
  );

  const html = generateLoanStatementHTML(statement);

  // Check that both headers are present
  assert.match(html, />Running Balance</);
  assert.match(html, />Principal Balance</);

  // Check that "Running Balance" comes before "Principal Balance" in the HTML
  const runningBalancePos = html.indexOf(">Running Balance<");
  const principalBalancePos = html.indexOf(">Principal Balance<");
  assert.ok(runningBalancePos > 0 && principalBalancePos > 0, "Both headers should be in HTML");
  assert.ok(runningBalancePos < principalBalancePos, "Running Balance should come before Principal Balance");

  // Check that "Closing Running Balance" is in the footer
  assert.match(html, />Closing Running Balance</);
});
