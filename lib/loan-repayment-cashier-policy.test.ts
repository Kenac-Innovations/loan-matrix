import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("cash repayment route does not perform a live manual cashier allocate call", () => {
  const routePath = path.resolve(
    process.cwd(),
    "app/api/fineract/loans/[id]/transactions/route.ts"
  );
  const source = readFileSync(routePath, "utf8");

  assert.doesNotMatch(
    source,
    /^\s*await fineractService\.allocateCashToCashier\(/m,
    "cash repayments should not call the manual Fineract allocate API"
  );
});
