import assert from "node:assert/strict";
import test from "node:test";

import {
  extractReportParameterVariables,
  validateArdaReportFixtures,
  verifyArdaStockReportIsolation,
  verifyReportColumns,
  type StockReportArtifactSnapshot,
} from "../arda-stock-report-verification";
import {
  ARDA_STOCK_ITEM_OPTIONS_REPORT,
  ARDA_STOCK_REPORT_NAMES,
} from "../fineract-arda-stock-reports";

test("extracts parameter variables from Fineract generic and plain responses", () => {
  assert.deepEqual(
    extractReportParameterVariables({
      data: [
        { row: ["startDateSelect", "startDate", "Start Date"] },
        { row: [ARDA_STOCK_ITEM_OPTIONS_REPORT, "stockItemId", "Stock Item"] },
      ],
    }),
    ["startDate", "stockItemId"]
  );
  assert.deepEqual(
    extractReportParameterVariables([
      { parameter_variable: "officeId" },
      { parameter_variable: "currencyId" },
    ]),
    ["officeId", "currencyId"]
  );
});

const visibleParameters = [
  "startDate",
  "endDate",
  "officeId",
  "currencyId",
  "loanProductId",
  "stockItemId",
];

function ardaSnapshot(
  overrides: Partial<StockReportArtifactSnapshot> = {}
): StockReportArtifactSnapshot {
  return {
    tenantSlug: "arda",
    featureEnabled: true,
    reports: [ARDA_STOCK_ITEM_OPTIONS_REPORT, ...ARDA_STOCK_REPORT_NAMES],
    dataTables: ["arda_stock_details"],
    reportParameters: Object.fromEntries(
      ARDA_STOCK_REPORT_NAMES.map((name) => [name, visibleParameters])
    ),
    permissions: ARDA_STOCK_REPORT_NAMES.map(
      (name) => `READ_${name.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`
    ),
    ...overrides,
  };
}

function controlSnapshot(
  overrides: Partial<StockReportArtifactSnapshot> = {}
): StockReportArtifactSnapshot {
  return {
    tenantSlug: "goodfellow",
    featureEnabled: false,
    reports: ["Repayments by payment type"],
    dataTables: [],
    reportParameters: {},
    permissions: ["READ_LOAN"],
    ...overrides,
  };
}

test("validates the required result columns for all three reports", () => {
  const rows = {
    [ARDA_STOCK_REPORT_NAMES[0]]: [
      {
        "Loan Account": "00081",
        "Disbursement Date": "2026-10-01",
        "Stock Item": "Seed Maize",
        Quantity: 4,
        "Unit Value": 12.5,
        "Stock Value": 50,
        "Disbursed Amount": 50,
        "Principal Repaid": 15,
        "Outstanding Amount": 35,
        "Loan Status": "Active",
      },
    ],
    [ARDA_STOCK_REPORT_NAMES[1]]: [
      {
        "Loan Account": "00081",
        "Transaction ID": 991,
        "Repayment Date": "2026-10-05",
        "Stock Item": "Seed Maize",
        "Repayment Amount": 20,
        "Principal Allocation": 15,
        "Interest Allocation": 5,
        "Fee Allocation": 0,
        "Penalty Allocation": 0,
        "Post Transaction Balance": 35,
        "Repayment Type": "Cash",
        "Cashier Name": "finance.user",
      },
    ],
    [ARDA_STOCK_REPORT_NAMES[2]]: [
      {
        Month: "2026-10-01",
        "Stock Item": "Seed Maize",
        Unit: "bag",
        "Number of Disbursements": 1,
        "Quantity Disbursed": 4,
        "Stock Value Disbursed": 50,
        "Average Quantity per Disbursement": 4,
        "Average Unit Value": 12.5,
        "Average Stock Value per Disbursement": 50,
        "Monthly Sales Rank": 1,
      },
    ],
  };

  for (const reportName of ARDA_STOCK_REPORT_NAMES) {
    assert.doesNotThrow(() => verifyReportColumns(reportName, rows[reportName]));
  }
  assert.throws(
    () =>
      verifyReportColumns(ARDA_STOCK_REPORT_NAMES[0], [
        { "Loan Account": "00081" },
      ]),
    /missing columns/i
  );
});

test("compares known counts, amounts, averages, and monthly rank", () => {
  assert.doesNotThrow(() =>
    validateArdaReportFixtures({
      disbursements: [
        {
          "Loan Account": "00081",
          Quantity: 4,
          "Stock Value": 50,
          "Disbursed Amount": 50,
        },
      ],
      repayments: [
        {
          "Loan Account": "00081",
          "Transaction ID": 991,
          "Repayment Amount": 20,
          "Principal Allocation": 15,
          "Interest Allocation": 5,
          "Post Transaction Balance": 35,
        },
      ],
      performance: [
        {
          "Stock Item": "Seed Maize",
          "Number of Disbursements": 1,
          "Quantity Disbursed": 4,
          "Stock Value Disbursed": 50,
          "Average Quantity per Disbursement": 4,
          "Average Unit Value": 12.5,
          "Average Stock Value per Disbursement": 50,
          "Monthly Sales Rank": 1,
        },
      ],
      expected: {
        loanAccount: "00081",
        stockItem: "Seed Maize",
        disbursementCount: 1,
        quantity: 4,
        stockValue: 50,
        disbursedAmount: 50,
        repaymentTransactionId: 991,
        repaymentAmount: 20,
        principalAllocation: 15,
        interestAllocation: 5,
        postTransactionBalance: 35,
        averageQuantity: 4,
        averageUnitValue: 12.5,
        averageStockValue: 50,
        rank: 1,
      },
    })
  );

  assert.throws(
    () =>
      validateArdaReportFixtures({
        disbursements: [],
        repayments: [],
        performance: [],
        expected: {
          loanAccount: "00081",
          stockItem: "Seed Maize",
          disbursementCount: 1,
          quantity: 4,
          stockValue: 50,
          disbursedAmount: 50,
          repaymentTransactionId: 991,
          repaymentAmount: 20,
          principalAllocation: 15,
          interestAllocation: 5,
          postTransactionBalance: 35,
          averageQuantity: 4,
          averageUnitValue: 12.5,
          averageStockValue: 50,
          rank: 1,
        },
      }),
    /fixture/i
  );
});

test("passes only when ARDA has every artifact and the control tenant has none", () => {
  assert.doesNotThrow(() =>
    verifyArdaStockReportIsolation(ardaSnapshot(), controlSnapshot())
  );

  assert.throws(
    () =>
      verifyArdaStockReportIsolation(
        ardaSnapshot({ featureEnabled: false }),
        controlSnapshot()
      ),
    /ARDA feature flag/i
  );
  assert.throws(
    () =>
      verifyArdaStockReportIsolation(
        ardaSnapshot({ reports: [ARDA_STOCK_ITEM_OPTIONS_REPORT] }),
        controlSnapshot()
      ),
    /missing report/i
  );
  assert.throws(
    () =>
      verifyArdaStockReportIsolation(
        ardaSnapshot({ dataTables: [] }),
        controlSnapshot()
      ),
    /data table/i
  );
  assert.throws(
    () =>
      verifyArdaStockReportIsolation(
        ardaSnapshot({ reportParameters: {} }),
        controlSnapshot()
      ),
    /parameter/i
  );
  assert.throws(
    () =>
      verifyArdaStockReportIsolation(
        ardaSnapshot({ permissions: [] }),
        controlSnapshot()
      ),
    /permission/i
  );
});

test("fails when Goodfellow gains the ARDA flag or any ARDA artifact", () => {
  assert.throws(
    () =>
      verifyArdaStockReportIsolation(
        ardaSnapshot(),
        controlSnapshot({ featureEnabled: true })
      ),
    /control tenant feature flag/i
  );
  assert.throws(
    () =>
      verifyArdaStockReportIsolation(
        ardaSnapshot(),
        controlSnapshot({ reports: [ARDA_STOCK_REPORT_NAMES[0]] })
      ),
    /control tenant contains ARDA report/i
  );
  assert.throws(
    () =>
      verifyArdaStockReportIsolation(
        ardaSnapshot(),
        controlSnapshot({ dataTables: ["arda_stock_details"] })
      ),
    /control tenant contains ARDA data table/i
  );
});
