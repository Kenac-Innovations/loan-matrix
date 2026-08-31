export const ARDA_STOCK_INPUT_LOAN_EXTERNAL_ID = "ARDA-STOCK-INPUT-LOAN";
export const ARDA_STOCK_INPUT_LOAN_NAME = "ARDA Stock Input Loan";
export const ARDA_STOCK_INPUT_LOAN_SHORT_NAME = "ARDA";
export const ARDA_STOCK_LOAN_EXTERNAL_ID_PREFIX = "ARDA-STOCK-";
export const ARDA_MAIZE_SEED_LOAN_EXTERNAL_ID = "ARDA-STOCK-MAIZE-SEED-6M";
export const ARDA_GROUNDNUT_SEED_LOAN_EXTERNAL_ID = "ARDA-STOCK-GROUNDNUT-SEED-1M";

type LoanProductIdentity = {
  id?: string | number | null;
  name?: string | null;
  shortName?: string | null;
  externalId?: string | null;
};

type StockLoanSelectionInput = {
  inventoryItemId: string;
  inventoryItemName: string;
  fineractOfficeId: number;
  fineractOfficeName?: string | null;
  unitOfMeasure?: string | null;
  quantity: string | number;
  unitValue: string | number;
  currencyCode?: string | null;
};

function normalize(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function toPositiveNumber(value: string | number, label: string) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
  return parsed;
}

export function isArdaStockInputLoanProduct(product?: LoanProductIdentity | null) {
  if (!product) return false;

  const externalId = normalize(product.externalId);
  const shortName = normalize(product.shortName);
  const name = normalize(product.name);

  return (
    externalId.startsWith(normalize(ARDA_STOCK_LOAN_EXTERNAL_ID_PREFIX)) ||
    name === normalize(ARDA_STOCK_INPUT_LOAN_NAME) ||
    // State transitions project the product name but not the Fineract
    // external identifier. ARDA stock products reserve this name prefix;
    // callers still require a selected stock item before mutating inventory.
    name.startsWith("arda ") ||
    (shortName === normalize(ARDA_STOCK_INPUT_LOAN_SHORT_NAME) &&
      name.includes("stock"))
  );
}

export function buildArdaStockLoanSelection(input: StockLoanSelectionInput) {
  const quantity = toPositiveNumber(input.quantity, "Quantity");
  const unitValue = toPositiveNumber(input.unitValue, "Unit value");
  const totalValue = quantity * unitValue;
  const roundedTotal = Number(totalValue.toFixed(2));

  return {
    principal: roundedTotal,
    stockLoanSelection: {
      inventoryItemId: input.inventoryItemId,
      inventoryItemName: input.inventoryItemName,
      fineractOfficeId: input.fineractOfficeId,
      fineractOfficeName: input.fineractOfficeName || "",
      unitOfMeasure: input.unitOfMeasure || "units",
      quantity: quantity.toString(),
      unitValue: unitValue.toFixed(2),
      totalValue: roundedTotal.toFixed(2),
      currencyCode: (input.currencyCode || "USD").trim().toUpperCase(),
    },
  };
}
