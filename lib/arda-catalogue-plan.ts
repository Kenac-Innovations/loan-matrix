import {
  ARDA_GROUNDNUT_SEED_LOAN_EXTERNAL_ID,
  ARDA_MAIZE_SEED_LOAN_EXTERNAL_ID,
  ARDA_STOCK_INPUT_LOAN_EXTERNAL_ID,
} from "@/lib/inventory/arda-stock-loan";

export type ArdaLoanProductPlan = {
  name: string;
  shortName: string;
  description: string;
  externalId: string;
  repayments: number;
  interestRatePerPeriod: number;
  currencyCode: string;
};

export type ArdaInventoryItemPlan = {
  sku: string;
  name: string;
  description: string;
  unitOfMeasure: string;
  defaultUnitValue: string;
  currencyCode: string;
};

export function buildArdaCataloguePlan() {
  return {
    products: [
      {
        name: "ARDA Stock Input Loan",
        shortName: "ARDA",
        description:
          "In-kind agricultural input credit. The principal is the agreed value of stock issued and is repaid in three equal monthly instalments.",
        externalId: ARDA_STOCK_INPUT_LOAN_EXTERNAL_ID,
        repayments: 3,
        interestRatePerPeriod: 2,
        currencyCode: "USD",
      },
      {
        name: "ARDA Maize Seed Seasonal Loan",
        shortName: "AMZS",
        description:
          "In-kind maize seed credit. The principal is the agreed value of stock issued and is repaid in six equal monthly instalments.",
        externalId: ARDA_MAIZE_SEED_LOAN_EXTERNAL_ID,
        repayments: 6,
        interestRatePerPeriod: 2,
        currencyCode: "USD",
      },
      {
        name: "ARDA Groundnut Seed Quick Loan",
        shortName: "AGSQ",
        description:
          "In-kind groundnut seed credit. The principal is the agreed value of stock issued and is repaid in one monthly instalment.",
        externalId: ARDA_GROUNDNUT_SEED_LOAN_EXTERNAL_ID,
        repayments: 1,
        interestRatePerPeriod: 2,
        currencyCode: "USD",
      },
    ] satisfies ArdaLoanProductPlan[],
    inventoryItems: [
      {
        sku: "ARDA-MAIZE-SEED-10KG",
        name: "Maize Seed 10kg",
        description: "Certified maize seed for ARDA in-kind agricultural input credit.",
        unitOfMeasure: "bag",
        defaultUnitValue: "25.00",
        currencyCode: "USD",
      },
      {
        sku: "ARDA-GROUNDNUT-SEED-10KG",
        name: "Groundnut Seed 10kg",
        description: "Certified groundnut seed for ARDA in-kind agricultural input credit.",
        unitOfMeasure: "bag",
        defaultUnitValue: "45.00",
        currencyCode: "USD",
      },
    ] satisfies ArdaInventoryItemPlan[],
    initialReceipts: [] as const,
  };
}
