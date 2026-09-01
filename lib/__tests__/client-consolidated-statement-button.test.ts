import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("client header exposes consolidated statement action in a new tab", () => {
  const source = readRepoFile(
    "app/(application)/clients/[id]/components/client-header.tsx"
  );

  assert.match(source, /Consolidated Statement/);
  assert.match(source, /\/api\/fineract\/clients\/\$\{clientId\}\/statement\?format=html/);
  assert.match(source, /target=\"_blank\"/);
});

test("client header keeps the consolidated statement available without a loan-list gate", () => {
  const source = readRepoFile(
    "app/(application)/clients/[id]/components/client-header.tsx"
  );

  assert.doesNotMatch(
    source,
    /loanAvailability\s*!==\s*["']no-loans["']/,
    "a failed or stale account lookup must not hide the statement action"
  );
});
