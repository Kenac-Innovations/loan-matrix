export type InventoryMovementType =
  | "RECEIPT"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT"
  | "RESERVATION"
  | "RESERVATION_RELEASE"
  | "ISSUE"
  | "RETURN"
  | "ISSUE_REVERSAL"
  | "TRANSFER_OUT"
  | "TRANSFER_IN";

export type InventoryBalanceSnapshot = {
  quantityOnHand: string;
  quantityReserved: string;
  stockValue: string;
};

export type InventoryMovementInput = {
  type: InventoryMovementType;
  quantity: string;
  value: string;
};

export class InventoryLedgerError extends Error {
  constructor(
    public readonly code:
      | "INVALID_QUANTITY"
      | "INVALID_VALUE"
      | "INSUFFICIENT_STOCK"
      | "INSUFFICIENT_RESERVATION"
      | "INSUFFICIENT_STOCK_VALUE",
    message: string
  ) {
    super(message);
    this.name = "InventoryLedgerError";
  }
}

const QUANTITY_SCALE = 3;
const VALUE_SCALE = 2;

function parseFixedDecimal(
  input: string,
  scale: number,
  code: "INVALID_QUANTITY" | "INVALID_VALUE"
): bigint {
  const value = input.trim();
  const match = value.match(/^(\d+)(?:\.(\d+))?$/);

  if (!match || (match[2]?.length ?? 0) > scale) {
    throw new InventoryLedgerError(code, `Invalid decimal value: ${input}`);
  }

  const whole = BigInt(match[1]);
  const fraction = (match[2] || "").padEnd(scale, "0");
  return whole * 10n ** BigInt(scale) + BigInt(fraction || "0");
}

function formatFixedDecimal(value: bigint, scale: number): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const divisor = 10n ** BigInt(scale);
  const whole = absolute / divisor;
  const fraction = (absolute % divisor).toString().padStart(scale, "0");
  const trimmedFraction = fraction.replace(/0+$/, "");
  const formatted = trimmedFraction ? `${whole}.${trimmedFraction}` : whole.toString();
  return negative ? `-${formatted}` : formatted;
}

function requirePositive(
  value: bigint,
  code: "INVALID_QUANTITY" | "INVALID_VALUE",
  label: string
): void {
  if (value <= 0n) {
    throw new InventoryLedgerError(code, `${label} must be greater than zero.`);
  }
}

function requireNonNegative(value: bigint, label: string): void {
  if (value < 0n) {
    throw new InventoryLedgerError("INVALID_VALUE", `${label} cannot be negative.`);
  }
}

/**
 * Applies one immutable stock movement to a branch balance projection.
 * Database persistence is deliberately separate so callers can apply this
 * calculation inside the same transaction that records the movement.
 */
export function applyInventoryMovement(
  balance: InventoryBalanceSnapshot,
  movement: InventoryMovementInput
): InventoryBalanceSnapshot {
  const onHand = parseFixedDecimal(
    balance.quantityOnHand,
    QUANTITY_SCALE,
    "INVALID_QUANTITY"
  );
  const reserved = parseFixedDecimal(
    balance.quantityReserved,
    QUANTITY_SCALE,
    "INVALID_QUANTITY"
  );
  const stockValue = parseFixedDecimal(balance.stockValue, VALUE_SCALE, "INVALID_VALUE");
  const quantity = parseFixedDecimal(movement.quantity, QUANTITY_SCALE, "INVALID_QUANTITY");
  const value = parseFixedDecimal(movement.value, VALUE_SCALE, "INVALID_VALUE");

  requirePositive(quantity, "INVALID_QUANTITY", "Quantity");
  requireNonNegative(value, "Value");

  let nextOnHand = onHand;
  let nextReserved = reserved;
  let nextStockValue = stockValue;

  switch (movement.type) {
    case "RECEIPT":
    case "ADJUSTMENT_IN":
    case "RETURN":
    case "ISSUE_REVERSAL":
    case "TRANSFER_IN":
      requirePositive(value, "INVALID_VALUE", "Value");
      nextOnHand += quantity;
      nextStockValue += value;
      break;
    case "RESERVATION":
      if (onHand - reserved < quantity) {
        throw new InventoryLedgerError(
          "INSUFFICIENT_STOCK",
          "The requested quantity exceeds stock available for reservation."
        );
      }
      nextReserved += quantity;
      break;
    case "RESERVATION_RELEASE":
      if (reserved < quantity) {
        throw new InventoryLedgerError(
          "INSUFFICIENT_RESERVATION",
          "The requested quantity exceeds stock currently reserved."
        );
      }
      nextReserved -= quantity;
      break;
    case "ISSUE":
      if (reserved < quantity) {
        throw new InventoryLedgerError(
          "INSUFFICIENT_RESERVATION",
          "Stock must be reserved before it can be issued."
        );
      }
      if (stockValue < value) {
        throw new InventoryLedgerError(
          "INSUFFICIENT_STOCK_VALUE",
          "The issued value exceeds the branch stock value."
        );
      }
      nextOnHand -= quantity;
      nextReserved -= quantity;
      nextStockValue -= value;
      break;
    case "ADJUSTMENT_OUT":
    case "TRANSFER_OUT":
      if (onHand - reserved < quantity) {
        throw new InventoryLedgerError(
          "INSUFFICIENT_STOCK",
          "The requested quantity exceeds stock available for removal."
        );
      }
      if (stockValue < value) {
        throw new InventoryLedgerError(
          "INSUFFICIENT_STOCK_VALUE",
          "The removed value exceeds the branch stock value."
        );
      }
      nextOnHand -= quantity;
      nextStockValue -= value;
      break;
  }

  return {
    quantityOnHand: formatFixedDecimal(nextOnHand, QUANTITY_SCALE),
    quantityReserved: formatFixedDecimal(nextReserved, QUANTITY_SCALE),
    stockValue: formatFixedDecimal(nextStockValue, VALUE_SCALE),
  };
}
