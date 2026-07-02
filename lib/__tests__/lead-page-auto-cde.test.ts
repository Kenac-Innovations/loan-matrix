import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("lead page triggers CDE during server-side data loading when the loan is already submitted", () => {
  const source = readRepoFile("app/(application)/leads/[id]/page.tsx");

  assert.match(source, /callCDEAndStore/);
  assert.match(source, /autoProgressToDisbursementFromCdeResult/);
  assert.match(source, /if \(lead\.loanSubmittedToFineract && lead\.fineractLoanId && !cdeResult\)/);
});
