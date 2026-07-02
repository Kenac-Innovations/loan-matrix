import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("ussd submit route triggers CDE evaluation after loan creation", () => {
  const source = readRepoFile("app/api/ussd-leads/[id]/submit/route.ts");

  assert.match(
    source,
    /import\s+\{\s*callCDEAndStore\s*\}\s+from\s+['"]@\/lib\/cde-utils['"];/
  );
  assert.match(source, /fetchLoansByExternalId/);
  assert.match(source, /resolveReusableUssdLoanId/);
  assert.match(source, /void \(async \(\) => \{/);
  assert.match(source, /const cdeResult = await callCDEAndStore\(leadId\);/);
  assert.match(source, /coreResponse: result \?\? \(loanId \? \{ resourceId: loanId \} : null\)/);
});

test("ussd view details redirects to the preparing screen after lead creation", () => {
  const source = readRepoFile("components/tables/UssdLoanApplicationsTable.tsx");

  assert.match(source, /window\.location\.href = `\/leads\/\$\{leadId\}\/preparing\?applicationId=\$\{app\.loanApplicationUssdId\}`;/);
});
