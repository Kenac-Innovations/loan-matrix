import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("lead config includes an auto-disbursement rules editor", () => {
  const source = readRepoFile(
    "app/(application)/leads/config/components/auto-disbursement-rules-config.tsx"
  );

  assert.match(source, /Auto Disbursement Rules/);
  assert.match(source, /\/api\/tenant\/auto-disbursement-rules/);
  assert.match(source, /\/api\/pipeline\/stages/);
  assert.match(source, /\/api\/fineract\/loanproducts/);
  assert.match(source, /Allowed CDE Decisions/);
});
