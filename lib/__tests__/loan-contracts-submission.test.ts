import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const source = readRepoFile(
  "app/(application)/leads/new/components/loan-contracts.tsx",
);

test("manual contracts submit through the lead-scoped create-loan command", () => {
  assert.match(
    source,
    /fetch\(`\/api\/leads\/\$\{leadId\}\/create-loan`/,
  );
  assert.match(source, /JSON\.stringify\(\{ fineractPayload: loanPayload \}\)/);
  assert.doesNotMatch(
    source,
    /fineractFetch\("\/api\/fineract\/loans",/,
  );
  assert.doesNotMatch(source, /method:\s*["']PATCH["']/);
});

test("manual contracts gate every post-create action on a successful linked outcome", () => {
  const outcomeGateIndex = source.indexOf(
    "loanResult?.success !== true ||",
  );
  const facilityIndex = source.indexOf("createCreditFacilityForLead(");
  const chargeIndex = source.indexOf(
    "/api/fineract/loans/${createdLoanId}/charges",
  );
  const documentIndex = source.indexOf(
    "/api/fineract/loans/${createdLoanId}/documents",
  );
  const cdeIndex = source.indexOf("/api/leads/${leadId}/call-cde");
  const successToastIndex = source.indexOf('title: "Success!"');

  assert.ok(outcomeGateIndex >= 0);
  assert.match(source, /isSuccessfulLeadLoanOutcome\(loanResult\?\.outcome\)/);
  assert.ok(facilityIndex > outcomeGateIndex);
  assert.ok(chargeIndex > outcomeGateIndex);
  assert.ok(documentIndex > outcomeGateIndex);
  assert.ok(cdeIndex > outcomeGateIndex);
  assert.ok(successToastIndex > outcomeGateIndex);
  assert.match(source, /normalizeCreatedLoanId\(loanResult\?\.loanId\)/);
});

test("invoice-discounting charge post-create flow remains in the contracts UI", () => {
  assert.match(source, /isInvoiceDiscountingLoan && createdLoanId/);
  assert.match(
    source,
    /fineractFetch\(\s*`\/api\/fineract\/loans\/\$\{createdLoanId\}\/charges`/s,
  );
});
