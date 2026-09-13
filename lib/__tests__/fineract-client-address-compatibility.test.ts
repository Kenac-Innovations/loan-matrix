import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

test("the client address form sends Fineract's supported addressType field", () => {
  const source = readFileSync(
    path.join(
      repoRoot,
      "app/(application)/leads/new/components/client-registration-form.tsx"
    ),
    "utf8"
  );

  assert.match(source, /addressType:\s*addressType/);
  assert.match(source, /delete addressPayload\.addressTypeId/);
});

test("client address creation sends addressType, not addressTypeId, to Fineract", () => {
  const source = readFileSync(
    path.join(
      repoRoot,
      "app/api/fineract/clients/[id]/addresses/route.ts"
    ),
    "utf8"
  );

  assert.match(source, /payload\.addressType\s*=\s*addressType/);
  assert.doesNotMatch(source, /payload\.addressTypeId\s*=\s*addressType/);
});

test("client address updates keep the address type in Fineract's query parameter", () => {
  const source = readFileSync(
    path.join(
      repoRoot,
      "app/api/fineract/clients/[id]/addresses/[addressId]/route.ts"
    ),
    "utf8"
  );

  assert.match(source, /\/client\/\$\{id\}\/addresses\?type=\$\{addressType\}/);
  assert.doesNotMatch(source, /addressTypeId:\s*addressType/);
});
