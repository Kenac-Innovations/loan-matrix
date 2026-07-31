import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCashierTransactionLoanContext,
  extractLoanIdFromCashierTransactionNotes,
  matchLoanPayoutForCashierTransaction,
} from "../cashier-transaction-enrichment";

test("builds loan display context from a Fineract disbursement cashier note", () => {
  const context = buildCashierTransactionLoanContext({
    tx: {
      id: 1276342,
      entityType: "loans",
      txnNote:
        "DISBURSEMENT, Loan:171704-000171704,Client:30924-DERRICK FUNGAMWANGO",
    },
    lead: {
      id: "lead-171704",
      fineractLoanId: 171704,
      fineractClientId: 30924,
      externalId: "237476/64/1",
      fullname: "",
      firstname: "DERRICK",
      middlename: null,
      lastname: "FUNGAMWANGO",
    },
  });

  assert.deepEqual(context, {
    linkedLoanId: 171704,
    linkedClientId: 30924,
    linkedLeadId: "lead-171704",
    linkedNrc: "237476/64/1",
    linkedFullName: "DERRICK FUNGAMWANGO",
    loanDetailHref: "/clients/30924/loans/171704",
  });
});

test("keeps legacy repayment note loan id parsing", () => {
  assert.equal(
    extractLoanIdFromCashierTransactionNotes("Loan repayment #169499"),
    169499
  );
});

test("parses credit balance refund loan ids from cashier notes", () => {
  assert.equal(
    extractLoanIdFromCashierTransactionNotes("Credit balance refund - Loan #164469"),
    164469
  );
});

test("matches loan payout by explicit Fineract loan note before loose amount matching", () => {
  const payout = matchLoanPayoutForCashierTransaction(
    {
      id: 1276342,
      entityType: "loans",
      txnAmount: 1000,
      txnDate: [2026, 7, 16],
      txnNote:
        "DISBURSEMENT, Loan:171704-000171704,Client:30924-DERRICK FUNGAMWANGO",
    },
    [
      {
        id: "payout-171676",
        fineractLoanId: 171676,
        fineractClientId: 18533,
        clientName: "WEBBY MUNGOLE",
        loanAccountNo: "000171676",
        amount: 1000,
        paidAt: new Date(2026, 6, 16),
        voidedAt: null,
        createdAt: new Date(2026, 6, 16),
      },
      {
        id: "payout-171704",
        fineractLoanId: 171704,
        fineractClientId: 30924,
        clientName: "DERRICK FUNGAMWANGO",
        loanAccountNo: "000171704",
        amount: 1000,
        paidAt: new Date(2026, 6, 16),
        voidedAt: null,
        createdAt: new Date(2026, 6, 16),
      },
    ]
  );

  assert.equal(payout?.id, "payout-171704");
});
