import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function getRouteFiles(relativeDir: string): string[] {
  const absoluteDir = path.join(repoRoot, relativeDir);
  const entries = readdirSync(absoluteDir, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const relativePath = path.join(relativeDir, entry.name);

    if (entry.isDirectory()) {
      return getRouteFiles(relativePath);
    }

    return entry.name === "route.ts" ? [relativePath] : [];
  });
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

test("remaining Fineract routes with user-facing error fallbacks use the shared route error helper", () => {
  const routes = [
    "app/api/fineract/accountingrules/[id]/route.ts",
    "app/api/fineract/accountingrules/route.ts",
    "app/api/fineract/accountingrules/template/route.ts",
    "app/api/fineract/accounttransfers/route.ts",
    "app/api/fineract/accounttransfers/template/route.ts",
    "app/api/fineract/chart-of-accounts/route.ts",
    "app/api/fineract/client_identifiers/[id]/documents/[documentId]/attachment/route.ts",
    "app/api/fineract/client_identifiers/[id]/documents/route.ts",
    "app/api/fineract/clients/[id]/documents/[documentId]/attachment/route.ts",
    "app/api/fineract/clients/[id]/identifiers/route.ts",
    "app/api/fineract/clients/[id]/identifiers/template/route.ts",
    "app/api/fineract/clients/[id]/images/route.ts",
    "app/api/fineract/clients/[id]/loans/route.ts",
    "app/api/fineract/clients/addresses/template/route.ts",
    "app/api/fineract/clients/external-id/route.ts",
    "app/api/fineract/clients/search-v2/route.ts",
    "app/api/fineract/clients/search/route.ts",
    "app/api/fineract/codes/[codeName]/codevalues/[valueId]/route.ts",
    "app/api/fineract/codes/[codeName]/codevalues/route.ts",
    "app/api/fineract/dashboard/route.ts",
    "app/api/fineract/datatables/route.ts",
    "app/api/fineract/external-asset-owners/transfers/loans/[id]/sale/route.ts",
    "app/api/fineract/fieldconfiguration/[entity]/route.ts",
    "app/api/fineract/glaccounts/[id]/balance/route.ts",
    "app/api/fineract/journalentries/[transactionId]/reverse/route.ts",
    "app/api/fineract/journalentries/[transactionId]/route.ts",
    "app/api/fineract/journalentries/route.ts",
    "app/api/fineract/loans/[id]/action/route.ts",
    "app/api/fineract/loans/[id]/approve/route.ts",
    "app/api/fineract/loans/[id]/charges/[chargeId]/route.ts",
    "app/api/fineract/loans/[id]/charges/route.ts",
    "app/api/fineract/loans/[id]/charges/template/route.ts",
    "app/api/fineract/loans/[id]/collaterals/route.ts",
    "app/api/fineract/loans/[id]/collaterals/template/route.ts",
    "app/api/fineract/loans/[id]/documents/[documentId]/attachment/route.ts",
    "app/api/fineract/loans/[id]/documents/[documentId]/route.ts",
    "app/api/fineract/loans/[id]/guarantors/route.ts",
    "app/api/fineract/loans/[id]/guarantors/template/route.ts",
    "app/api/fineract/loans/[id]/interest-pauses/route.ts",
    "app/api/fineract/loans/[id]/notes/[noteId]/route.ts",
    "app/api/fineract/loans/[id]/notes/route.ts",
    "app/api/fineract/loans/[id]/recover-guarantees/route.ts",
    "app/api/fineract/loans/[id]/route.ts",
    "app/api/fineract/loans/[id]/transactions/[transactionId]/route.ts",
    "app/api/fineract/loans/[id]/transactions/charge-off-template/route.ts",
    "app/api/fineract/loans/[id]/transactions/charge-off/route.ts",
    "app/api/fineract/loans/[id]/transactions/credit-balance-refund-template/route.ts",
    "app/api/fineract/loans/[id]/transactions/credit-balance-refund/route.ts",
    "app/api/fineract/loans/[id]/transactions/goodwill-credit-template/route.ts",
    "app/api/fineract/loans/[id]/transactions/goodwill-credit/route.ts",
    "app/api/fineract/loans/[id]/transactions/interest-payment-waiver-template/route.ts",
    "app/api/fineract/loans/[id]/transactions/interest-payment-waiver/route.ts",
    "app/api/fineract/loans/[id]/transactions/merchant-issued-refund-template/route.ts",
    "app/api/fineract/loans/[id]/transactions/merchant-issued-refund/route.ts",
    "app/api/fineract/loans/[id]/transactions/payout-refund-template/route.ts",
    "app/api/fineract/loans/[id]/transactions/payout-refund/route.ts",
    "app/api/fineract/loans/[id]/transactions/re-age/route.ts",
    "app/api/fineract/loans/[id]/transactions/re-amortize/route.ts",
    "app/api/fineract/loans/[id]/transactions/template/route.ts",
    "app/api/fineract/loans/[id]/undodisbursal/route.ts",
    "app/api/fineract/loans/calculate-schedule/route.ts",
    "app/api/fineract/loans/product/[id]/route.ts",
    "app/api/fineract/loans/template/route.ts",
    "app/api/fineract/notifications/stream/route.ts",
    "app/api/fineract/paymenttypes/[id]/route.ts",
    "app/api/fineract/paymenttypes/route.ts",
    "app/api/fineract/rescheduleloans/template/route.ts",
  ];

  for (const route of routes) {
    const source = readRepoFile(route);
    assert.match(
      source,
      /buildFineractErrorResponse|createFineractErrorResponsePayload/,
      `${route} should use the shared Fineract route error helper`
    );
  }
});

test("Fineract routes do not return raw backend error payloads or developer messages", () => {
  const disallowedPatterns = [
    /return\s+NextResponse\.json\(\s*error\.errorData\b/s,
    /return\s+NextResponse\.json\(\s*\{\s*error:\s*error\.errorData\b/s,
    /details:\s*error\??\.errorData\b/s,
    /developerMessage:\s*error\.message\b/s,
    /errorMessage\s*=\s*error\.errorData(?:\.[A-Za-z0-9_[\].]+)?\.developerMessage\b/s,
    /errorMessage\s*=\s*error\??\.message\b/s,
  ];

  const routeFiles = getRouteFiles("app/api").filter((route) =>
    readRepoFile(route).includes("fetchFineractAPI")
  );

  for (const route of routeFiles) {
    const source = readRepoFile(route);

    for (const pattern of disallowedPatterns) {
      assert.doesNotMatch(
        source,
        pattern,
        `${route} should not return raw Fineract/backend error details to the UI`
      );
    }
  }
});
