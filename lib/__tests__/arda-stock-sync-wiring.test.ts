import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { runArdaStockDisbursementGuard } from "../arda-stock-disbursement-guard";
import type { ArdaStockDetails } from "../inventory/arda-stock-workflow-service";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const details: ArdaStockDetails = {
  stockItemId: "item-1",
  stockItemName: "Fertilizer",
  fineractOfficeId: 1,
  quantity: "3",
  unitOfMeasure: "bag",
  unitValue: "12.50",
  totalStockValue: "37.50",
  currencyCode: "USD",
  stockIssueReference: "ARDA-001",
};

const enabledSettings = { features: { ardaStockReports: true } };

test("ARDA stock sync completes before disbursement and receives final details", async () => {
  const calls: string[] = [];
  let receivedDetails: ArdaStockDetails | undefined;

  const result = await runArdaStockDisbursementGuard({
    appTenantSlug: "arda",
    tenantSettings: enabledSettings,
    fineractLoanId: 22,
    getDetails: () => ({ ...details, quantity: "4", totalStockValue: "50.00" }),
    sync: async (input) => {
      calls.push("sync");
      receivedDetails = input.details;
      return "updated";
    },
    disburse: async () => {
      calls.push("disburse");
      return "done";
    },
  });

  assert.equal(result, "done");
  assert.deepEqual(calls, ["sync", "disburse"]);
  assert.equal(receivedDetails?.quantity, "4");
  assert.equal(receivedDetails?.totalStockValue, "50.00");
});

test("ARDA stock sync failure blocks the external disbursement", async () => {
  let disbursed = false;

  await assert.rejects(
    runArdaStockDisbursementGuard({
      appTenantSlug: "arda",
      tenantSettings: enabledSettings,
      fineractLoanId: 22,
      getDetails: () => details,
      sync: async () => {
        throw new Error("metadata unavailable");
      },
      disburse: async () => {
        disbursed = true;
        return "done";
      },
    }),
    /metadata unavailable/
  );

  assert.equal(disbursed, false);
});

test("disabled, non-ARDA, and missing-detail loans disburse without metadata reads or writes", async () => {
  for (const input of [
    { appTenantSlug: "goodfellow", tenantSettings: enabledSettings, detailsResult: details },
    { appTenantSlug: "arda", tenantSettings: enabledSettings, detailsResult: null },
    { appTenantSlug: "arda", tenantSettings: {}, detailsResult: details },
  ]) {
    let syncCalls = 0;
    let detailReads = 0;
    let disbursementCalls = 0;
    const result = await runArdaStockDisbursementGuard({
      appTenantSlug: input.appTenantSlug,
      tenantSettings: input.tenantSettings,
      fineractLoanId: 22,
      getDetails: () => {
        detailReads += 1;
        return input.detailsResult;
      },
      sync: async () => {
        syncCalls += 1;
        return "updated";
      },
      disburse: async () => {
        disbursementCalls += 1;
        return "done";
      },
    });

    assert.equal(result, "done");
    assert.equal(syncCalls, 0);
    assert.equal(disbursementCalls, 1);
    assert.equal(
      detailReads,
      input.appTenantSlug === "arda" && input.tenantSettings === enabledSettings ? 1 : 0
    );
  }
});

test("manual create-loan reconciles the durable link before best-effort stock metadata sync", () => {
  const source = readRepoFile("app/api/leads/[id]/create-loan/route.ts");
  const linkIndex = source.indexOf("await reconcileLeadLoan");
  const syncIndex = source.indexOf(
    "await syncArdaStockDetailsForCurrentTenant",
    linkIndex
  );
  const detailIndex = source.indexOf("getArdaStockDetails({", linkIndex);
  const guardedTryIndex = source.lastIndexOf("try {", detailIndex);

  assert.ok(linkIndex >= 0);
  assert.ok(guardedTryIndex > linkIndex);
  assert.ok(detailIndex > guardedTryIndex);
  assert.ok(syncIndex > linkIndex);
  assert.match(source, /ardaStockDetailSync/);
  assert.match(source, /stockDetailSync/);
  assert.match(source, /warning/i);
  assert.doesNotMatch(source, /delete[^\n]*fineractLoanId/i);
});

test("both disbursement paths execute Fineract inside the ARDA guard", () => {
  const stateMachine = readRepoFile("lib/team-state-machine-service.ts");
  const directRoute = readRepoFile("app/api/fineract/loans/[id]/disburse/route.ts");

  assert.match(stateMachine, /runArdaStockDisbursementGuard/);
  assert.match(
    stateMachine,
    /runArdaStockDisbursementGuard\([\s\S]*?getDetails:\s*\(\)\s*=>[\s\S]*?disburse:\s*\(\)\s*=>\s*fineract\.disburseLoan/
  );
  assert.match(directRoute, /runArdaStockDisbursementGuard/);
  assert.match(
    directRoute,
    /runArdaStockDisbursementGuard\([\s\S]*?getDetails:\s*\(\)\s*=>[\s\S]*?disburse:\s*\(\)\s*=>\s*fetchFineractAPI\([^]*?command=disburse/
  );
});
