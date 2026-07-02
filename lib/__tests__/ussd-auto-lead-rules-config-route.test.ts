import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("ussd auto-lead rules API persists tenant settings under ussdAutoLeadRules", () => {
  const source = readRepoFile("app/api/tenant/ussd-auto-lead-rules/route.ts");

  assert.match(source, /ussdAutoLeadRules/);
  assert.match(source, /sanitizeTenantUssdAutoLeadRulesInput/);
  assert.match(source, /getTenantUssdAutoLeadRules/);
});
