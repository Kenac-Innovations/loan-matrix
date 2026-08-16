import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("client details page uses UPDATE_CLIENT permission to show edit access", () => {
  const detailsPage = readRepoFile("app/(application)/clients/[id]/page.tsx");

  assert.match(
    detailsPage,
    /hasPermissionServer\(SpecificPermission\.UPDATE_CLIENT\)/
  );
  assert.doesNotMatch(detailsPage, /hasSuperAdminServer/);
});

test("client edit page computes restricted field access from the tenant flag and SUPER_ADMIN role", () => {
  const editPage = readRepoFile("app/(application)/clients/[id]/edit/page.tsx");

  assert.match(
    editPage,
    /hasPermissionServer\(\s*SpecificPermission\.UPDATE_CLIENT\s*\)/
  );
  assert.match(editPage, /hasSuperAdminServer\(\)/);
  assert.match(
    editPage,
    /isSensitiveClientEditRestrictionEnabled\(tenant\?\.settings\)/
  );
  assert.match(editPage, /canEditRestrictedClientFields/);
});

test("client edit form disables the tenant-restricted sensitive fields", () => {
  const formSource = readRepoFile(
    "app/(application)/clients/[id]/edit/components/client-edit-form.tsx"
  );

  assert.match(formSource, /canEditRestrictedClientFields: boolean/);
  assert.match(
    formSource,
    /id="isStaff"[\s\S]{0,160}disabled=\{!canEditRestrictedClientFields\}/
  );
  assert.match(formSource, /<Label htmlFor="staffId">Staff<\/Label>/);
  assert.match(formSource, /disabled=\{!canEditRestrictedClientFields\}/);
  assert.match(
    formSource,
    /<SearchableSelect[\s\S]{0,220}disabled=\{!canEditRestrictedClientFields\}/
  );
  assert.match(
    formSource,
    /id="mobileNo"[\s\S]{0,160}disabled=\{!canEditRestrictedClientFields\}/
  );
  assert.match(
    formSource,
    /id="submittedOnDate"[\s\S]{0,160}disabled=\{!canEditRestrictedClientFields\}/
  );
  assert.match(
    formSource,
    /id="activationDate"[\s\S]{0,160}disabled=\{!canEditRestrictedClientFields\}/
  );
});

test("client update APIs require UPDATE_CLIENT permission and sanitize tenant-restricted fields", () => {
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
  assert.match(clientApiRoute, /hasSuperAdminServer\(\)/);
  assert.match(
    clientApiRoute,
    /isSensitiveClientEditRestrictionEnabled\(tenant\?\.settings\)/
  );
  assert.match(clientApiRoute, /stripRestrictedClientEditFields/);

  assert.ok(fineractPutHandler, "expected to find the Fineract client PUT handler");
  assert.match(
    fineractPutHandler,
    /hasPermissionServer\(SpecificPermission\.UPDATE_CLIENT\)/
  );
  assert.match(fineractPutHandler, /hasSuperAdminServer\(\)/);
  assert.match(
    fineractPutHandler,
    /isSensitiveClientEditRestrictionEnabled\(tenant\?\.settings\)/
  );
  assert.match(fineractPutHandler, /stripRestrictedClientEditFields/);
});
