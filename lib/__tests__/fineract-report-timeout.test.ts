import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("runReport uses a report-specific timeout override", () => {
  const source = readRepoFile("lib/fineract-api.ts");

  assert.match(
    source,
    /const DEFAULT_FINERACT_REPORT_TIMEOUT_MS = 300_000;/,
    "report requests should default to a longer timeout"
  );
  assert.match(
    source,
    /this\.client\.get\(url,\s*\{\s*timeout:\s*FINERACT_REPORT_TIMEOUT_MS,\s*\}\)/,
    "runReport should override the shared client timeout"
  );
});
