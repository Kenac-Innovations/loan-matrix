import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("loan details tabs use horizontal scrolling instead of wrapped skewed rows", () => {
  const source = readRepoFile(
    "app/(application)/clients/[id]/loans/[loanId]/components/client-loan-details.tsx"
  );

  assert.match(source, /overflow-x-auto/);
  assert.match(source, /inline-flex min-w-max/);
  assert.match(source, /const loanDetailsTabTriggerClass =/);
  assert.match(source, /shrink-0 flex items-center/);
  assert.doesNotMatch(source, /sm:flex-wrap/);
});
