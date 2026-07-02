import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("AMQP USSD consumer reuses tenant product rules to auto-create leads", () => {
  const source = readRepoFile("lib/amqp-queue-service.ts");

  assert.match(source, /getTenantUssdAutoLeadRules/);
  assert.match(source, /findMatchingUssdAutoLeadRule/);
  assert.match(source, /createOrReuseLeadFromUssdApplication/);
});
