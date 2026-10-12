import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("USSD auto-processing poller reuses tenant product rules to auto-create leads", () => {
  const pollerSource = readRepoFile("lib/ussd-auto-processing-poller.ts");
  assert.match(pollerSource, /getTenantUssdAutoLeadRules/);
  assert.match(pollerSource, /findMatchingUssdAutoLeadRule/);
  assert.match(pollerSource, /processUssdApplicationToDisbursement/);

  // The lead-creation call itself lives in the shared processing service the
  // poller calls into, not the poller module.
  const processingSource = readRepoFile("lib/ussd-loan-processing-service.ts");
  assert.match(processingSource, /createOrReuseLeadFromUssdApplication/);
});
