import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("maps the dedicated ARDA hostname to the arda tenant slug", () => {
  const tenantService = readRepoFile("lib/tenant-service.ts");

  assert.match(tenantService, /ardaloanmatrix\.kenac\.tech/);
  assert.match(tenantService, /return "arda"/);
});

test("permits sign-in redirects to the Kenac.tech application domain", () => {
  const auth = readRepoFile("lib/auth.ts");

  assert.match(auth, /endsWith\("\.kenac\.tech"\)/);
});
