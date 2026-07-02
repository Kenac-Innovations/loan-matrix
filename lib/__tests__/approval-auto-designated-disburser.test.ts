import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("approval transition auto-assigns the originator as designated disburser", () => {
  const source = readRepoFile("lib/team-state-machine-service.ts");

  assert.match(source, /getOriginatorDesignatedDisburserData/);
  assert.match(source, /designatedDisburserUserId/);
  assert.match(source, /designatedDisburserAssignedByUserId/);
});

test("fineract approval webhook also mirrors the originator into designated disburser fields", () => {
  const source = readRepoFile("app/api/webhooks/fineract/loans/route.ts");

  assert.match(source, /getOriginatorDesignatedDisburserData/);
  assert.match(source, /designatedDisburserUserId/);
  assert.match(source, /designatedDisburserAssignedByUserId/);
});
