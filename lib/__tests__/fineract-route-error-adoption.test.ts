import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("core Fineract client and datatable routes use the shared route error helper", () => {
  const routes = [
    "app/api/fineract/clients/[id]/addresses/route.ts",
    "app/api/fineract/clients/[id]/addresses/[addressId]/route.ts",
    "app/api/fineract/clients/[id]/route.ts",
    "app/api/fineract/clients/route.ts",
    "app/api/fineract/datatables/[name]/[id]/route.ts",
    "app/api/fineract/client_identifiers/[id]/documents/route.ts",
    "app/api/fineract/clients/[id]/documents/route.ts",
    "app/api/fineract/loans/[id]/documents/route.ts",
  ];

  for (const route of routes) {
    const source = readRepoFile(route);
    assert.match(
      source,
      /buildFineractErrorResponse/,
      `${route} should use the shared Fineract route error helper`
    );
  }
});
