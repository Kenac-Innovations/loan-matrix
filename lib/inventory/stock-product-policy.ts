import { StockControlError } from "./stock-errors";
import { Prisma } from "@/app/generated/prisma";
export type StockSelection = {
  inventoryItemId: string;
  fineractOfficeId: number;
  currencyCode: string;
  quantity: string;
  unitValue: string;
};
export function requiresStock(
  settings: unknown,
  productId: number | null | undefined,
  selection: unknown,
): boolean {
  const config = settings as {
    inventory?: { stockProductIds?: number[] };
  } | null;
  return (
    Boolean(selection) ||
    Boolean(
      productId && config?.inventory?.stockProductIds?.includes(productId),
    )
  );
}
export function parseStockSelection(value: unknown): StockSelection {
  if (!value || typeof value !== "object")
    throw new StockControlError("This stock loan is missing its stock selection.");
  const s = value as Record<string, unknown>;
  const item = String(s.inventoryItemId ?? "").trim();
  const office = Number(s.fineractOfficeId);
  const currency = String(s.currencyCode ?? "")
    .trim()
    .toUpperCase();
  if (
    !item ||
    !Number.isInteger(office) ||
    office <= 0 ||
    !/^[A-Z]{3}$/.test(currency)
  )
    throw new StockControlError("Select a valid stock item, branch and currency.");
  const decimal = (raw: unknown, places: number, name: string) => {
    if (!/^\d+(\.\d+)?$/.test(String(raw))) throw new StockControlError(`Invalid ${name}.`);
    const n = new Prisma.Decimal(String(raw));
    if (
      !n.isFinite() ||
      n.lte(0) ||
      n.decimalPlaces() > places ||
      n.gte("1000000000000000")
    )
      throw new StockControlError(`Invalid ${name}.`);
    return n.toString();
  };
  return {
    inventoryItemId: item,
    fineractOfficeId: office,
    currencyCode: currency,
    quantity: decimal(s.quantity, 3, "stock quantity"),
    unitValue: decimal(s.unitValue, 2, "unit value"),
  };
}
export function storedStockSelection(metadata: unknown): unknown {
  return (metadata as { loanTerms?: { stockLoanSelection?: unknown } } | null)
    ?.loanTerms?.stockLoanSelection;
}
export function stockSelectionForCommand(command: string, raw: unknown, persisted?: StockSelection): StockSelection {
  if (['reject','undoapproval','withdrawnbyapplicant','delete','undodisbursal'].includes(command) && persisted) return persisted;
  return parseStockSelection(raw);
}
