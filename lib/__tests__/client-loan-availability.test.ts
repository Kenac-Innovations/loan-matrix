import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { deriveClientLoanAvailability } from "../client-loan-availability";

test("only a confirmed empty loan account list hides the statement action", () => {
  assert.equal(deriveClientLoanAvailability({ loanAccounts: [] }), "no-loans");
  assert.equal(
    deriveClientLoanAvailability({ loanAccounts: [{ id: 155395 }] }),
    "has-loans"
  );

  // A malformed or unavailable response must not be interpreted as no loans.
  assert.equal(deriveClientLoanAvailability({}), "unknown");
  assert.equal(deriveClientLoanAvailability(null), "unknown");
});

test("the header renders the statement action unless no loans are confirmed", () => {
  const headerPath = path.join(
    process.cwd(),
    "app/(application)/clients/[id]/components/client-header.tsx"
  );
  const source = readFileSync(headerPath, "utf8");

  assert.match(source, /loanAvailability !== "no-loans"/);
});
