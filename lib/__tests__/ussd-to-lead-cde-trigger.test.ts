import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("ussd submit delegates to processing that evaluates CDE after loan creation", () => {
  const routeSource = readRepoFile("app/api/ussd-leads/[id]/submit/route.ts");
  const serviceSource = readRepoFile("lib/ussd-loan-processing-service.ts");

  assert.match(
    routeSource,
    /processUssdApplicationToDisbursement/
  );
  const loanResolutionIndex = serviceSource.indexOf(
    '"Failed to resolve or create Fineract loan for USSD application"'
  );
  const cdeIndex = serviceSource.indexOf("await callCDEAndStore(leadId)");
  assert.ok(loanResolutionIndex >= 0);
  assert.ok(cdeIndex > loanResolutionIndex);
  assert.match(serviceSource, /autoProgressToDisbursementFromCdeResult/);
});

test("ussd view details redirects to the preparing screen after lead creation", () => {
  const source = readRepoFile("components/tables/UssdLoanApplicationsTable.tsx");

  assert.match(source, /window\.location\.href = `\/leads\/\$\{leadId\}\/preparing\?applicationId=\$\{app\.loanApplicationUssdId\}`;/);
});
