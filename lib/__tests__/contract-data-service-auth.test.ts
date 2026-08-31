import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const contractDataRoute = readFileSync(
  path.join(process.cwd(), "app/api/leads/[id]/contract-data/route.ts"),
  "utf8",
);

test("contract financial lookup uses the Fineract service identity", () => {
  const resolverSource = contractDataRoute.slice(
    contractDataRoute.indexOf("async function resolveFineractLoan"),
    contractDataRoute.indexOf("function getForwardedHeaders"),
  );

  assert.match(
    resolverSource,
    /fetchFineractAPI\(\s*`\/loans\/\$\{fineractLoanId\}\?associations=all`,\s*\{\s*authMode:\s*["']service["']/,
    "submitted-loan documents must read the live loan using the controlled service identity",
  );
});

test("submitted loans do not render zero contract figures when live terms are unavailable", () => {
  const missingLoanBranch = contractDataRoute.slice(
    contractDataRoute.indexOf('console.warn("No live Fineract loan found for contract data")'),
    contractDataRoute.indexOf("// Fetch loan details"),
  );

  assert.match(
    missingLoanBranch,
    /lead\.loanSubmittedToFineract\s*&&\s*lead\.fineractLoanId/,
    "a submitted loan without live Fineract data must be treated as an error",
  );
  assert.match(
    missingLoanBranch,
    /Live loan terms are unavailable/,
    "the user should receive a clear error instead of an incorrect zero-value contract",
  );
});
