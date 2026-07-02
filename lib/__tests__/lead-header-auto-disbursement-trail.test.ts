import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("lead details page returns autoDisbursement metadata for the header trail", () => {
  const source = readRepoFile("app/(application)/leads/[id]/page.tsx");

  assert.match(source, /autoDisbursement/);
  assert.match(source, /buildAutoDisbursementTrail/);
  assert.match(source, /Auto Flow/);
  assert.match(source, /Auto \{autoDisbursementTrail\.statusLabel\}/);
  assert.match(source, /ChevronRight/);
});
