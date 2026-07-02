import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("auto-disbursement rules API persists tenant settings under autoProgressToDisbursementRules", () => {
  const source = readRepoFile("app/api/tenant/auto-disbursement-rules/route.ts");

  assert.match(source, /autoProgressToDisbursementRules/);
  assert.match(source, /sanitizeTenantAutoDisbursementRulesInput/);
  assert.match(source, /getTenantAutoDisbursementRules/);
});
