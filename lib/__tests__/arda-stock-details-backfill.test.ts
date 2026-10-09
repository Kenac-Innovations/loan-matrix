import assert from "node:assert/strict";
import test from "node:test";

import {
  runArdaStockDetailsBackfill,
  toArdaStockDetailsFromIssue,
  type BackfillStockIssue,
} from "../arda-stock-details-backfill";

function issue(overrides: Partial<BackfillStockIssue> = {}): BackfillStockIssue {
  return {
    id: "issue-1",
    tenantSlug: "arda",
    fineractLoanId: 81,
    fineractOfficeId: 1,
    fineractOfficeName: "Head Office",
    reference: "ARDA-STOCK-81",
    externalReference: "LEAD-81",
    totalValue: "50.00",
    currencyCode: "USD",
    lines: [
      {
        inventoryItemId: "item-1",
        quantity: "4",
        unitValue: "12.50",
        lineValue: "50.00",
        currencyCode: "USD",
        inventoryItem: {
          name: "Seed Maize",
          unitOfMeasure: "bag",
        },
      },
    ],
    ...overrides,
  };
}

test("maps a single valid ARDA issue line to Fineract stock details", () => {
  const result = toArdaStockDetailsFromIssue(issue());

  assert.equal(result.status, "eligible");
  if (result.status !== "eligible") return;
  assert.deepEqual(result.details, {
    stockItemId: "item-1",
    stockItemName: "Seed Maize",
    fineractOfficeId: 1,
    fineractOfficeName: "Head Office",
    quantity: "4",
    unitOfMeasure: "bag",
    unitValue: "12.5",
    totalStockValue: "50.00",
    currencyCode: "USD",
    stockIssueReference: "ARDA-STOCK-81",
  });
});

test("returns explicit skip reasons for ineligible source records", () => {
  const cases: Array<[BackfillStockIssue, string]> = [
    [issue({ tenantSlug: "goodfellow" }), "not_arda"],
    [issue({ fineractLoanId: null }), "missing_fineract_loan_id"],
    [issue({ lines: [] }), "no_lines"],
    [issue({ lines: [issue().lines[0], issue().lines[0]] }), "multiple_lines"],
    [
      issue({
        lines: [{ ...issue().lines[0], quantity: "0" }],
      }),
      "invalid_values",
    ],
  ];

  for (const [source, reason] of cases) {
    assert.deepEqual(toArdaStockDetailsFromIssue(source), {
      status: "skipped",
      reason,
    });
  }
});

test("preview reports eligibility without calling Fineract", async () => {
  let requests = 0;
  const result = await runArdaStockDetailsBackfill({
    issues: [issue(), issue({ id: "issue-2", fineractLoanId: null })],
    apply: false,
    appTenantSlug: "arda",
    tenantSettings: { features: { ardaStockReports: true } },
    fineractTenantId: "arda",
    request: async () => {
      requests += 1;
      throw new Error("preview must not request Fineract");
    },
  });

  assert.equal(requests, 0);
  assert.deepEqual(result.summary, {
    source: 2,
    eligible: 1,
    skipped: 1,
    created: 0,
    updated: 0,
    errors: 0,
  });
  assert.deepEqual(result.skippedByReason, { missing_fineract_loan_id: 1 });
});

test("apply upserts each eligible loan and repeated apply updates the same row", async () => {
  let exists = false;
  const methods: string[] = [];
  const request = async (_endpoint: string, options: any = {}) => {
    const method = options.method || "GET";
    methods.push(method);
    if (method === "GET") return exists ? { stock_item_id: "item-1" } : [];
    exists = true;
    return {};
  };
  const options = {
    issues: [issue()],
    apply: true,
    appTenantSlug: "arda",
    tenantSettings: { features: { ardaStockReports: true } },
    fineractTenantId: "arda",
    request,
  };

  const first = await runArdaStockDetailsBackfill(options);
  const second = await runArdaStockDetailsBackfill(options);

  assert.equal(first.summary.created, 1);
  assert.equal(first.summary.updated, 0);
  assert.equal(second.summary.created, 0);
  assert.equal(second.summary.updated, 1);
  assert.deepEqual(methods, ["GET", "POST", "GET", "PUT"]);
});

test("apply continues after a per-loan error and reports it", async () => {
  const result = await runArdaStockDetailsBackfill({
    issues: [issue(), issue({ id: "issue-2", fineractLoanId: 82 })],
    apply: true,
    appTenantSlug: "arda",
    tenantSettings: { features: { ardaStockReports: true } },
    fineractTenantId: "arda",
    request: async (endpoint, options: any = {}) => {
      if (endpoint.endsWith("/81") && options.method === "GET") {
        throw new Error("loan unavailable");
      }
      if (options.method === "GET") return [];
      return {};
    },
  });

  assert.equal(result.summary.eligible, 2);
  assert.equal(result.summary.created, 1);
  assert.equal(result.summary.errors, 1);
  assert.equal(result.errors[0].fineractLoanId, 81);
  assert.doesNotMatch(JSON.stringify(result), /Seed Maize|LEAD-81/);
});
