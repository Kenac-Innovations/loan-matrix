import assert from "node:assert/strict";
import test from "node:test";

import {
  generateLoanStatementHTML,
  transformFineractLoanToStatement,
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

test("renders component allocations and uses summary outstanding for the closing balance", () => {
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

  assert.equal(statement.totalDebits.toFixed(2), "186897.84");
  assert.equal(statement.totalCredits.toFixed(2), "122749.95");
  assert.equal(statement.ledgerClosingBalance.toFixed(2), "64147.89");
  assert.equal(statement.closingBalance, 70161.09);
  assert.equal(statement.closingBalanceSource, "summary");

  const html = generateLoanStatementHTML(statement);
  for (const header of [
    "Principal",
    "Interest",
    "Fees",
    "Penalties",
    "Running Ledger Balance",
  ]) {
    assert.match(html, new RegExp(`>${header}<`));
  }
  assert.match(html, />150,000\.00</);
  assert.match(html, />36,897\.84</);
  assert.match(html, />30\.00</);
  assert.match(html, />19\.95</);
  assert.match(html, />Transaction Ledger Balance</);
  assert.match(html, />Closing Outstanding Balance</);
  assert.match(html, /70,161\.09/);
  assert.doesNotMatch(html, /outstandingLoanBalance/);
});

test("derives row running balances from effective movements and excludes reversed rows", () => {
  const statement = transformRulethuLoan();
  const accrualRow = statement.transactions.find((row) => row.id === 2);
  const reversedRow = statement.transactions.find((row) => row.id === 3);

  assert.equal(accrualRow?.cumulativeBalance.toFixed(2), "186897.84");
  assert.equal(reversedRow?.cumulativeBalance.toFixed(2), "186897.84");
  assert.equal(reversedRow?.interest, 5000);
  assert.equal(statement.ledgerClosingBalance.toFixed(2), "64147.89");
});

test("allows filtered statements to explicitly retain the transaction-ledger closing balance", () => {
  const statement = transformRulethuLoan({ balanceSource: "transaction-ledger" });

  assert.equal(statement.closingBalance, statement.ledgerClosingBalance);
  assert.equal(statement.closingBalance.toFixed(2), "64147.89");
  assert.equal(statement.closingBalanceSource, "transaction-ledger");

  const html = generateLoanStatementHTML(statement);
  assert.match(html, />Closing Balance</);
  assert.doesNotMatch(html, />Closing Outstanding Balance</);
  assert.doesNotMatch(html, />Transaction Ledger Balance</);
});

test("preserves signed ledger balances for a filtered credit-only statement", () => {
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

  assert.equal(statement.transactions[1]?.cumulativeBalance, -100);
  assert.equal(statement.ledgerClosingBalance, -100);
  assert.equal(statement.closingBalance, -100);

  const html = generateLoanStatementHTML(statement);
  assert.match(html, />-100\.00</);
});
