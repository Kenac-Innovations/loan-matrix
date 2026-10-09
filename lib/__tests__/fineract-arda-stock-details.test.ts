import assert from "node:assert/strict";
import test from "node:test";

import type { ArdaStockDetails } from "@/lib/inventory/arda-stock-workflow-service";
import {
  ARDA_STOCK_DETAILS_TABLE,
  buildArdaStockDetailsPayload,
  ensureArdaStockDetailsDatatable,
  upsertArdaStockDetails,
  type FineractRequester,
} from "@/lib/fineract-arda-stock-details";

const enabledSettings = { features: { ardaStockReports: true } };

const details: ArdaStockDetails = {
  stockItemId: "item-maize",
  stockItemName: "Maize Seed 10kg",
  fineractOfficeId: 3,
  fineractOfficeName: "Mazowe",
  quantity: "12.5",
  unitOfMeasure: "bags",
  unitValue: "24",
  totalStockValue: "300.00",
  currencyCode: "USD",
  stockIssueReference: "lead-arda-2",
};

test("blocks Fineract stock writes when any tenant gate fails", async () => {
  let calls = 0;
  const request: FineractRequester = async () => {
    calls += 1;
    return {};
  };

  await assert.rejects(
    ensureArdaStockDetailsDatatable({
      appTenantSlug: "goodfellow",
      tenantSettings: enabledSettings,
      fineractTenantId: "goodfellow",
      request,
    }),
    /ARDA stock reports are not enabled/i
  );
  await assert.rejects(
    ensureArdaStockDetailsDatatable({
      appTenantSlug: "arda",
      tenantSettings: { features: { ardaStockReports: false } },
      fineractTenantId: "arda",
      request,
    }),
    /ARDA stock reports are not enabled/i
  );
  await assert.rejects(
    ensureArdaStockDetailsDatatable({
      appTenantSlug: "arda",
      tenantSettings: enabledSettings,
      fineractTenantId: "goodfellow",
      request,
    }),
    /Fineract tenant must be arda/i
  );

  assert.equal(calls, 0);
});

test("registers the single-row ARDA loan data table with only reporting columns", async () => {
  const calls: Array<{ endpoint: string; options?: RequestInit }> = [];
  const request: FineractRequester = async (endpoint, options) => {
    calls.push({ endpoint, options });
    return { resourceIdentifier: ARDA_STOCK_DETAILS_TABLE };
  };

  const result = await ensureArdaStockDetailsDatatable({
    appTenantSlug: "arda",
    tenantSettings: enabledSettings,
    fineractTenantId: "ARDA",
    request,
  });

  assert.equal(result, "created");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].endpoint, "/datatables");
  assert.equal(calls[0].options?.method, "POST");
  const payload = JSON.parse(String(calls[0].options?.body));
  assert.equal(payload.datatableName, ARDA_STOCK_DETAILS_TABLE);
  assert.equal(payload.apptableName, "m_loan");
  assert.equal(payload.multiRow, false);
  assert.deepEqual(
    payload.columns.map((column: { name: string }) => column.name),
    [
      "stock_item_id",
      "stock_item_name",
      "quantity",
      "unit_of_measure",
      "unit_value",
      "total_stock_value",
      "currency_code",
      "stock_issue_reference",
    ]
  );
});

test("treats an explicit already-exists registration response as idempotent", async () => {
  const request: FineractRequester = async () => {
    const error = new Error("Data table already exists") as Error & {
      status?: number;
    };
    error.status = 409;
    throw error;
  };

  assert.equal(
    await ensureArdaStockDetailsDatatable({
      appTenantSlug: "arda",
      tenantSettings: enabledSettings,
      fineractTenantId: "arda",
      request,
    }),
    "exists"
  );
});

test("creates a missing loan row and updates it on the next upsert", async () => {
  const calls: Array<{ endpoint: string; options?: RequestInit }> = [];
  let exists = false;
  const request: FineractRequester = async (endpoint, options) => {
    calls.push({ endpoint, options });
    if (!options?.method || options.method === "GET") {
      return exists ? [{ id: 9, stock_item_id: details.stockItemId }] : [];
    }
    if (options.method === "POST") exists = true;
    return { resourceId: 9 };
  };

  const input = {
    appTenantSlug: "arda",
    tenantSettings: enabledSettings,
    fineractTenantId: "arda",
    fineractLoanId: 4001,
    details,
    request,
  };

  assert.equal(await upsertArdaStockDetails(input), "created");
  assert.equal(await upsertArdaStockDetails(input), "updated");

  assert.deepEqual(
    calls.map((call) => [call.endpoint, call.options?.method ?? "GET"]),
    [
      [`/datatables/${ARDA_STOCK_DETAILS_TABLE}/4001`, "GET"],
      [`/datatables/${ARDA_STOCK_DETAILS_TABLE}/4001`, "POST"],
      [`/datatables/${ARDA_STOCK_DETAILS_TABLE}/4001`, "GET"],
      [`/datatables/${ARDA_STOCK_DETAILS_TABLE}/4001`, "PUT"],
    ]
  );
});

test("builds the eight-column Fineract payload and verifies its total", () => {
  assert.deepEqual(buildArdaStockDetailsPayload(details), {
    stock_item_id: "item-maize",
    stock_item_name: "Maize Seed 10kg",
    quantity: "12.5",
    unit_of_measure: "bags",
    unit_value: "24",
    total_stock_value: "300.00",
    currency_code: "USD",
    stock_issue_reference: "lead-arda-2",
  });

  assert.throws(
    () =>
      buildArdaStockDetailsPayload({
        ...details,
        totalStockValue: "301.00",
      }),
    /does not match/i
  );
});
