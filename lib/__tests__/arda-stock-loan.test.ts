import test from "node:test";
import assert from "node:assert/strict";

import {
  ARDA_GROUNDNUT_SEED_LOAN_EXTERNAL_ID,
  ARDA_MAIZE_SEED_LOAN_EXTERNAL_ID,
  ARDA_STOCK_INPUT_LOAN_EXTERNAL_ID,
  buildArdaStockLoanSelection,
  isArdaStockInputLoanProduct,
} from "@/lib/inventory/arda-stock-loan";
import { generateArdaStockLoanContractHTML } from "@/app/(application)/leads/new/components/arda-stock-loan-contract";
import { generateArdaStockLoanMandateHTML } from "@/app/(application)/leads/new/components/arda-stock-loan-mandate";
import { getArdaInventoryWorkflowOperation } from "@/lib/inventory/arda-stock-workflow-service";
import type { ContractData } from "@/app/(application)/leads/new/components/contract-types";

test("detects the ARDA stock input loan product from stable product identifiers", () => {
  assert.equal(
    isArdaStockInputLoanProduct({
      id: 147,
      name: "ARDA Stock Input Loan",
      shortName: "ARDA",
      externalId: ARDA_STOCK_INPUT_LOAN_EXTERNAL_ID,
    }),
    true
  );

  assert.equal(
    isArdaStockInputLoanProduct({
      id: 12,
      name: "30 Day Consumer",
      shortName: "30DC",
      externalId: "CONSUMER-30-DAY",
    }),
    false
  );

  assert.equal(
    isArdaStockInputLoanProduct({
      name: "ARDA Maize Seed Seasonal Loan",
      shortName: "ARDA",
      externalId: ARDA_MAIZE_SEED_LOAN_EXTERNAL_ID,
    }),
    true
  );

  assert.equal(
    isArdaStockInputLoanProduct({
      name: "ARDA Groundnut Seed Quick Loan",
      shortName: "ARDA",
      externalId: ARDA_GROUNDNUT_SEED_LOAN_EXTERNAL_ID,
    }),
    true
  );
});

test("calculates the Fineract principal from selected stock quantity and unit value", () => {
  const selection = buildArdaStockLoanSelection({
    inventoryItemId: "item_maize",
    inventoryItemName: "Maize Seed 10kg",
    fineractOfficeId: 3,
    fineractOfficeName: "Mazowe",
    unitOfMeasure: "units",
    quantity: "12.5",
    unitValue: "24",
    currencyCode: "USD",
  });

  assert.equal(selection.principal, 300);
  assert.deepEqual(selection.stockLoanSelection, {
    inventoryItemId: "item_maize",
    inventoryItemName: "Maize Seed 10kg",
    fineractOfficeId: 3,
    fineractOfficeName: "Mazowe",
    unitOfMeasure: "units",
    quantity: "12.5",
    unitValue: "24.00",
    totalValue: "300.00",
    currencyCode: "USD",
  });
});

test("generates an ARDA stock agreement without cash-loan tenant wording", () => {
  const data = {
    clientName: "Test Farmer",
    nrc: "12-3456789-A-01",
    dateOfBirth: "01/01/1990",
    gender: "",
    loanId: "arda-test-lead",
    loanAmount: 300,
    disbursedAmount: 300,
    tenure: "3 months",
    numberOfPayments: 3,
    paymentFrequency: "Monthly",
    firstPaymentDate: "01/09/2026",
    interest: 18,
    fees: 0,
    totalCostOfCredit: 18,
    totalRepayment: 318,
    paymentPerPeriod: 106,
    monthlyPercentageRate: 2,
    repaymentSchedule: [
      {
        paymentNumber: 1,
        dueDate: "01/09/2026",
        paymentAmount: 106,
        principal: 100,
        interestAndFees: 6,
        remainingBalance: 212,
      },
    ],
    charges: [],
    currency: "USD",
    branch: "Mazowe",
    loanOfficer: "ARDA Officer",
    stockLoanSelection: {
      inventoryItemName: "Maize Seed 10kg",
      quantity: "12.5",
      unitOfMeasure: "bags",
      unitValue: "24.00",
      totalValue: "300.00",
      currencyCode: "USD",
      fineractOfficeName: "Mazowe",
    },
  } satisfies ContractData;

  const html = generateArdaStockLoanContractHTML(data);

  assert.match(html, /ARDA Agricultural Input Credit Agreement/);
  assert.match(html, /Maize Seed 10kg/);
  assert.match(html, /12.5/);
  assert.doesNotMatch(html, /Omama/i);
});

test("generates an ARDA repayment mandate without cash-loan tenant wording", () => {
  const data = {
    clientName: "Test Farmer",
    nrc: "12-3456789-A-01",
    dateOfBirth: "01/01/1990",
    gender: "",
    loanId: "arda-test-lead",
    loanAmount: 300,
    disbursedAmount: 300,
    totalRepayment: 318,
    tenure: "3 months",
    numberOfPayments: 3,
    paymentFrequency: "Monthly",
    firstPaymentDate: "01/09/2026",
    interest: 18,
    fees: 0,
    totalCostOfCredit: 18,
    paymentPerPeriod: 106,
    monthlyPercentageRate: 2,
    repaymentSchedule: [],
    charges: [],
    currency: "USD",
    branch: "Mazowe",
    stockLoanSelection: {
      inventoryItemName: "Maize Seed 10kg",
      quantity: "12.5",
      unitOfMeasure: "bags",
      unitValue: "24.00",
      totalValue: "300.00",
      currencyCode: "USD",
      fineractOfficeName: "Mazowe",
    },
  } satisfies ContractData;

  const html = generateArdaStockLoanMandateHTML(data);

  assert.match(html, /ARDA Agricultural Input Credit Repayment Mandate/);
  assert.match(html, /Maize Seed 10kg/);
  assert.match(html, /This authority applies only to the agricultural input credit/);
  assert.doesNotMatch(html, /Omama/i);
});

test("maps ARDA workflow stages to reserve, release, and issue stock actions", () => {
  const lead = {
    id: "lead-arda-1",
    tenantId: "tenant-arda",
    tenantSlug: "arda",
    loanProductId: 147,
    loanProductName: "ARDA Stock Input Loan",
    stateMetadata: {
      loanTerms: {
        stockLoanSelection: {
          inventoryItemId: "seed-item",
          inventoryItemName: "Maize Seed 10kg",
          fineractOfficeId: 3,
          fineractOfficeName: "Mazowe",
          quantity: "12",
          unitValue: "25.00",
          currencyCode: "USD",
        },
      },
    },
  };

  assert.equal(
    getArdaInventoryWorkflowOperation(lead, { name: "Credit Approval" }),
    "RESERVE"
  );
  assert.equal(
    getArdaInventoryWorkflowOperation(lead, { fineractAction: "reject" }),
    "RELEASE"
  );
  assert.equal(
    getArdaInventoryWorkflowOperation(lead, { fineractAction: "disburse" }),
    "ISSUE"
  );
  assert.equal(
    getArdaInventoryWorkflowOperation(
      { ...lead, tenantSlug: "goodfellow" },
      { name: "Credit Approval" }
    ),
    null
  );

  // This is the same shape used by the state-transition service, which loads
  // tenant as a relation instead of projecting a tenantSlug field.
  const { tenantSlug: _tenantSlug, ...leadWithTenantRelation } = lead;
  assert.equal(
    getArdaInventoryWorkflowOperation(
      { ...leadWithTenantRelation, tenant: { slug: "arda" } },
      { fineractAction: "disburse" }
    ),
    "ISSUE"
  );

  // State transitions intentionally project only the Fineract product ID and
  // name. New ARDA stock products must still reserve and issue stock without
  // relying on their external identifier being present in that projection.
  assert.equal(
    getArdaInventoryWorkflowOperation(
      {
        ...lead,
        loanProductId: 148,
        loanProductName: "ARDA Maize Seed Seasonal Loan",
      },
      { fineractAction: "disburse" }
    ),
    "ISSUE"
  );
});
