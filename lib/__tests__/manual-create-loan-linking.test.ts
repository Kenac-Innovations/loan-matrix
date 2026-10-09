import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("manual create-loan keeps Fineract external ID lead-linked", () => {
  const source = readRepoFile("app/api/leads/[id]/create-loan/route.ts");

  assert.match(source, /externalId:\s*leadId/);
  assert.doesNotMatch(source, /externalId:\s*String\(loanId\)/);
});

test("manual create-loan waits for server reconciliation before success/side effects", () => {
  const source = readRepoFile("app/api/leads/[id]/create-loan/route.ts");
  const reconcileIndex = source.indexOf("await reconcileLeadLoan");
  const successIndex = source.indexOf("success: true");
  const smsIndex = source.indexOf("void sendLoanStatusSms");

  assert.ok(reconcileIndex >= 0);
  assert.ok(successIndex > reconcileIndex);
  assert.ok(smsIndex > reconcileIndex);
  assert.doesNotMatch(source, /callCDEAndStore/);
});
