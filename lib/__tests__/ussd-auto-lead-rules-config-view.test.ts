import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("lead config includes a USSD auto-lead rules editor", () => {
  const source = readRepoFile(
    "app/(application)/leads/config/components/ussd-auto-lead-rules-config.tsx"
  );

  assert.match(source, /USSD Auto Lead Rules/);
  assert.match(source, /\/api\/tenant\/ussd-auto-lead-rules/);
  assert.match(source, /\/api\/fineract\/loanproducts/);
  assert.match(source, /Automatically create leads/);
});
