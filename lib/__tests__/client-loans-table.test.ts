import assert from "node:assert/strict";
import test from "node:test";

import {
  buildClientLoanSequenceNumbers,
  filterClientLoans,
  orderClientLoansLatestFirst,
  paginateClientLoans,
} from "../client-loans-table";

test("orders client loans newest first while preserving chronological sequence numbers", () => {
  const loans = [
    { id: 11, timeline: { submittedOnDate: "2026-01-02" } },
    { id: 12, timeline: { submittedOnDate: "2026-02-10" } },
    { id: 13, timeline: { submittedOnDate: "2026-01-20" } },
  ];

  assert.deepEqual(
    orderClientLoansLatestFirst(loans).map((loan) => loan.id),
    [12, 13, 11]
  );

  const sequenceNumbers = buildClientLoanSequenceNumbers(loans);

  assert.deepEqual(
    orderClientLoansLatestFirst(loans).map((loan) => sequenceNumbers.get(loan.id)),
    [3, 2, 1]
  );
});

test("places loans without sortable dates after dated loans in latest-first order", () => {
  const loans = [
    { id: 21, timeline: { submittedOnDate: "2026-01-02" } },
    { id: 22, timeline: {} },
    { id: 23, timeline: { submittedOnDate: "2026-02-10" } },
  ];

  assert.deepEqual(
    orderClientLoansLatestFirst(loans).map((loan) => loan.id),
    [23, 21, 22]
  );
});

test("paginates the latest-first client loan rows", () => {
  const loans = Array.from({ length: 25 }, (_, index) => ({ id: index + 1 }));
  const page = paginateClientLoans(loans, 2, 10);

  assert.deepEqual(
    page.pageItems.map((loan) => loan.id),
    [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
  );
  assert.equal(page.totalPages, 3);
  assert.equal(page.page, 2);
  assert.equal(page.startItem, 11);
  assert.equal(page.endItem, 20);
  assert.equal(page.canPreviousPage, true);
  assert.equal(page.canNextPage, true);
});

test("filters client loans by account number or loan product name", () => {
  const loans = [
    { id: 31, accountNo: "LN-0001", loanProductName: "Nano Loan" },
    { id: 32, accountNo: "LN-0002", loanProductName: "SME Working Capital" },
    { id: 33, accountNo: "TOP-5555", loanProductName: "Top Up Loan" },
  ];

  assert.deepEqual(
    filterClientLoans(loans, "0002").map((loan) => loan.id),
    [32]
  );
  assert.deepEqual(
    filterClientLoans(loans, "top").map((loan) => loan.id),
    [33]
  );
  assert.deepEqual(
    filterClientLoans(loans, "  ").map((loan) => loan.id),
    [31, 32, 33]
  );
});
