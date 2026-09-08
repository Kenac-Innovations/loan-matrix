import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

test("the client address form sends addressTypeId for new and edited addresses", () => {
  const source = readFileSync(
    path.join(
      repoRoot,
      "app/(application)/leads/new/components/client-registration-form.tsx"
    ),
    "utf8"
  );

  assert.match(source, /addressTypeId:\s*addressType/);
  assert.match(source, /delete addressPayload\.addressType/);
});

test("client address creation uses Fineract's supported addressTypeId field", () => {
  const source = readFileSync(
    path.join(
      repoRoot,
      "app/api/fineract/clients/[id]/addresses/route.ts"
    ),
    "utf8"
  );

  assert.match(source, /payload\.addressTypeId\s*=\s*addressType/);
  assert.doesNotMatch(source, /payload\.addressType\s*=\s*addressType/);
});

test("client address updates preserve the supported address type field", () => {
  const source = readFileSync(
    path.join(
      repoRoot,
      "app/api/fineract/clients/[id]/addresses/[addressId]/route.ts"
    ),
    "utf8"
  );

  assert.match(source, /addressTypeId:\s*addressType/);
});
