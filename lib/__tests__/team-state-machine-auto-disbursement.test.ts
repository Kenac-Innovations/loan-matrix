import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("team state machine wires post-transition CDE auto-disbursement orchestration", () => {
  const source = readRepoFile("lib/team-state-machine-service.ts");

  assert.match(source, /callCDEAndStore/);
  assert.match(source, /maybeAutoProgressToDisbursement/);
  assert.match(source, /AUTO_CDE_PROGRESS/);
  assert.match(source, /skipTeamValidation: request\.event === "AUTO_CDE_PROGRESS"/);
  assert.match(source, /resolvePaymentTypeForPreferredMethod/);
});
