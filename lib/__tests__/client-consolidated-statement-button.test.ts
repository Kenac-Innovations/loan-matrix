import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("client actions expose consolidated statement in a new tab", () => {
  const source = readRepoFile(
    "app/(application)/clients/[id]/components/client-servicing-status-actions.tsx"
  );

  assert.match(source, /Consolidated statement/i);
  assert.match(source, /\/api\/fineract\/clients\/\$\{clientId\}\/statement\?format=html/);
  assert.match(source, /target=\"_blank\"/);
});

test("client details page is always rendered fresh", () => {
  const source = readRepoFile("app/(application)/clients/[id]/page.tsx");

  assert.match(source, /export const dynamic = "force-dynamic"/);
});
