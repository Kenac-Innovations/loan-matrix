import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("complete-details route exposes autoDisbursement metadata beside cdeResult", () => {
  const source = readRepoFile("app/api/leads/[id]/complete-details/route.ts");

  assert.match(source, /let cdeResult =/);
  assert.match(source, /const autoDisbursement = stateMetadata\?\.autoDisbursement \|\| null;/);
  assert.match(source, /autoDisbursement,/);
});

test("complete-details route triggers CDE before rendering when the lead has a submitted loan but no CDE result", () => {
  const source = readRepoFile("app/api/leads/[id]/complete-details/route.ts");

  assert.match(source, /callCDEAndStore/);
  assert.match(source, /autoProgressToDisbursementFromCdeResult/);
  assert.match(source, /TeamAwareStateMachineService/);
});
