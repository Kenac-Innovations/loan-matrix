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

test("manual create-loan saves local loan link before best-effort side effects", () => {
  const source = readRepoFile("app/api/leads/[id]/create-loan/route.ts");
  const loanIdIndex = source.indexOf("const loanId = result.resourceId");
  const leadUpdateIndex = source.indexOf("await prisma.lead.update");
  const smsIndex = source.indexOf("// Send SMS");
  const cdeIndex = source.indexOf("// Call CDE");

  assert.ok(loanIdIndex >= 0);
  assert.ok(leadUpdateIndex > loanIdIndex);
  assert.ok(smsIndex > leadUpdateIndex);
  assert.ok(cdeIndex > leadUpdateIndex);
});
