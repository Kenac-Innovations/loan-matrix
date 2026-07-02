import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("lead CDE component renders an auto-disbursement summary section", () => {
  const source = readRepoFile(
    "app/(application)/leads/[id]/components/lead-cde.tsx"
  );

  assert.match(source, /Auto Disbursement/);
  assert.match(source, /autoDisbursement/);
  assert.match(source, /Stop Reason/);
  assert.match(source, /Last Completed Stage/);
});
