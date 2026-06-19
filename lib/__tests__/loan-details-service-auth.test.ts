import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("loan details Fineract GET surface is wired to service auth", () => {
  const filesWithServiceAuthExpectation: Array<{
    path: string;
    pattern: RegExp;
  }> = [
    {
      path: "app/api/fineract/loans/[id]/route.ts",
      pattern: /authMode:\s*"service"/,
    },
    {
      path: "app/api/fineract/loans/product/[id]/route.ts",
      pattern: /authMode:\s*"service"/,
    },
    {
      path: "app/api/fineract/paymenttypes/route.ts",
      pattern: /authMode:\s*"service"/,
    },
    {
      path: "app/api/fineract/reports/route.ts",
      pattern: /getFineractServiceWithServiceAuth/,
    },
    {
      path: "app/api/fineract/rescheduleloans/route.ts",
      pattern: /authMode:\s*"service"/,
    },
    {
      path: "app/api/fineract/rescheduleloans/template/route.ts",
      pattern: /authMode:\s*"service"/,
    },
    {
      path: "app/api/fineract/rescheduleloans/[id]/route.ts",
      pattern: /authMode:\s*"service"/,
    },
    {
      path: "app/api/fineract/loans/[id]/approve/route.ts",
      pattern: /authMode:\s*"service"/,
    },
    {
      path: "app/api/fineract/loans/[id]/collaterals/route.ts",
      pattern: /authMode:\s*"service"/,
    },
    {
      path: "app/api/fineract/loans/[id]/collaterals/template/route.ts",
      pattern: /authMode:\s*"service"/,
    },
    {
      path: "app/api/fineract/loans/[id]/documents/route.ts",
      pattern: /authMode:\s*"service"/,
    },
    {
      path: "app/api/fineract/loans/[id]/notes/route.ts",
      pattern: /authMode:\s*"service"/,
    },
    {
      path: "app/api/fineract/loans/[id]/interest-pauses/route.ts",
      pattern: /authMode:\s*"service"/,
    },
    {
      path: "app/api/fineract/loans/[id]/charges/template/route.ts",
      pattern: /authMode:\s*"service"/,
    },
    {
      path: "app/api/fineract/loans/[id]/guarantors/route.ts",
      pattern: /authMode:\s*"service"/,
    },
    {
      path: "app/api/fineract/loans/[id]/guarantors/template/route.ts",
      pattern: /authMode:\s*"service"/,
    },
    {
      path: "app/api/fineract/loans/[id]/transactions/template/route.ts",
      pattern: /authMode:\s*"service"/,
    },
    {
      path: "app/api/fineract/loans/[id]/transactions/charge-off-template/route.ts",
      pattern: /authMode:\s*"service"/,
    },
    {
      path: "app/api/fineract/loans/[id]/transactions/credit-balance-refund-template/route.ts",
      pattern: /authMode:\s*"service"/,
    },
    {
      path: "app/api/fineract/loans/[id]/transactions/goodwill-credit-template/route.ts",
      pattern: /authMode:\s*"service"/,
    },
    {
      path: "app/api/fineract/loans/[id]/transactions/interest-payment-waiver-template/route.ts",
      pattern: /authMode:\s*"service"/,
    },
    {
      path: "app/api/fineract/loans/[id]/transactions/merchant-issued-refund-template/route.ts",
      pattern: /authMode:\s*"service"/,
    },
    {
      path: "app/api/fineract/loans/[id]/transactions/payout-refund-template/route.ts",
      pattern: /authMode:\s*"service"/,
    },
    {
      path: "app/api/fineract/loans/[id]/disburse/route.ts",
      pattern: /fetchFineractAPI\(`\/loans\/\$\{id\}`,\s*\{\s*authMode:\s*"service"/,
    },
    {
      path: "app/api/fineract/loans/[id]/undodisbursal/route.ts",
      pattern:
        /fetchFineractAPI\(`\/loans\/\$\{loanId\}`,\s*\{\s*authMode:\s*"service"/,
    },
    {
      path: "lib/fineract-credit-facility.ts",
      pattern: /authMode:\s*"service"/,
    },
  ];

  for (const file of filesWithServiceAuthExpectation) {
    const source = readRepoFile(file.path);
    assert.match(source, file.pattern, `${file.path} should opt into service auth`);
  }
});

test("raw loan details routes build service-authenticated Fineract requests", () => {
  const rawRouteFiles = [
    "app/api/fineract/loans/[id]/statement/route.ts",
    "app/api/fineract/loans/[id]/old/[oldId]/statement/route.ts",
    "app/api/fineract/loans/[id]/documents/[documentId]/attachment/route.ts",
  ];

  for (const file of rawRouteFiles) {
    const source = readRepoFile(file);
    assert.match(source, /buildFineractRequest/, `${file} should use the shared request builder`);
    assert.match(source, /authMode:\s*"service"/, `${file} should request service auth`);
  }
});
