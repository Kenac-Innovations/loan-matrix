import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("client details and edit pages use UPDATE_CLIENT permission for edit access", () => {
  const detailsPage = readRepoFile("app/(application)/clients/[id]/page.tsx");
  const editPage = readRepoFile("app/(application)/clients/[id]/edit/page.tsx");

  assert.match(
    detailsPage,
    /hasPermissionServer\(SpecificPermission\.UPDATE_CLIENT\)/
  );
  assert.doesNotMatch(detailsPage, /hasSuperAdminServer/);

  assert.match(
    editPage,
    /hasPermissionServer\(\s*SpecificPermission\.UPDATE_CLIENT\s*\)/
  );
  assert.doesNotMatch(editPage, /hasSuperAdminServer/);
});

test("client update APIs require UPDATE_CLIENT permission", () => {
  const clientApiRoute = readRepoFile("app/api/clients/[id]/route.ts");
  const fineractClientApiRoute = readRepoFile(
    "app/api/fineract/clients/[id]/route.ts"
  );
  const fineractPutHandler = fineractClientApiRoute.match(
    /export async function PUT[\s\S]*?export async function DELETE/
  )?.[0];

  assert.match(
    clientApiRoute,
    /hasPermissionServer\(SpecificPermission\.UPDATE_CLIENT\)/
  );
  assert.doesNotMatch(clientApiRoute, /hasSuperAdminServer/);

  assert.ok(fineractPutHandler, "expected to find the Fineract client PUT handler");
  assert.match(
    fineractPutHandler,
    /hasPermissionServer\(SpecificPermission\.UPDATE_CLIENT\)/
  );
  assert.doesNotMatch(fineractPutHandler, /hasSuperAdminServer/);
});
