import assert from "node:assert/strict";
import test from "node:test";
import { generateRulethuLoanStatementHTML, isRulethuStatementTenant, type RulethuStatementLoan } from "../rulethu-loan-statement";

const loan: RulethuStatementLoan = {
  accountNo: "LN-1", principal: 1000, interestType: { id: 0 }, currency: { code: "ZMW" },
  summary: { principalDisbursed: 1000, principalOutstanding: 600, totalOutstanding: 650, totalRepayment: 450 },
  repaymentSchedule: { periods: [
    { period: 0, principalDue: 9999 },
    { period: 1, dueDate: [2026,9,1], principalDue: 500, interestDue: 50, totalDueForPeriod: 550, principalPaid: 400, interestPaid: 50, totalPaidForPeriod: 450, totalOutstandingForPeriod: 100 },
    { period: 2, dueDate: [2026,11,1], principalDue: 500, interestDue: 50, totalDueForPeriod: 550, totalPaidForPeriod: 0, totalOutstandingForPeriod: 550 },
  ] },
};
test("Rulethu statement selection is isolated to its tenant", () => {
  assert.equal(isRulethuStatementTenant(" Rulethu "), true);
  for (const slug of [undefined, null, "goodfellow", "rulethu-other"]) assert.equal(isRulethuStatementTenant(slug), false);
});
test("statement uses actual allocations, excludes disbursement periods and escapes values", () => {
  const html = generateRulethuLoanStatementHTML(loan, { displayName: "<script>alert(1)</script>" }, { name: "Rulethu & Co" }, undefined, new Date("2026-10-16T10:00:00Z"));
  assert.match(html, /REDUCING BALANCE METHOD/);
  assert.match(html, /Partial – overdue/);
  assert.match(html, /Upcoming/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /Rulethu &amp; Co/);
  assert.match(html, /600\.00/);
  assert.doesNotMatch(html, /9,999/);
  assert.match(html, /01 Nov 2026/);
});
test("flat rate and fully settled installments retain the workbook sections", () => {
  const html = generateRulethuLoanStatementHTML({ ...loan, interestType: { id: 1 }, summary: { totalOutstanding: 0 }, repaymentSchedule: { periods: [{ period: 1, totalOutstandingForPeriod: 0 }] } }, null, { name: "Rulethu" });
  assert.match(html, /FLAT RATE METHOD/);
  assert.match(html, /FULLY REPAID/);
  for (const section of ["BORROWER DETAILS", "LOAN TERMS", "ACCOUNT SUMMARY", "ALLOCATION &amp; STATUS"]) assert.ok(html.includes(section));
});
test("missing schedules fail explicitly", () => {
  assert.throws(() => generateRulethuLoanStatementHTML({}, null, { name: "Rulethu" }), /schedule is unavailable/);
});
