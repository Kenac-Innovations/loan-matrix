import { Prisma } from "@/app/generated/prisma";

import {
  InventoryLedgerError,
  applyInventoryMovement,
  type InventoryBalanceSnapshot,
  type InventoryMovementType,
} from "./inventory-ledger";

type InventoryTable = {
  findFirst(args: {
    where?: Record<string, unknown>;
    include?: Record<string, unknown>;
    select?: Record<string, unknown>;
  }): Promise<Record<string, unknown> | null>;
  create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  update(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<Record<string, unknown>>;
};

type InventoryTx = {
  inventoryItem: InventoryTable;
  inventoryBalance: InventoryTable;
  inventoryMovement: InventoryTable;
  stockLoanIssue: InventoryTable;
  stockLoanIssueLine: InventoryTable;
  stockLoanRepayment: InventoryTable;
};

export type InventoryDb = InventoryTx & {
  $transaction<T>(callback: (tx: InventoryTx) => Promise<T>): Promise<T>;
};

type MovementRequest = {
  tenantId: string;
  inventoryItemId: string;
  fineractOfficeId: number;
  fineractOfficeName?: string;
  quantity: string;
  value?: string;
  currencyCode?: string;
  idempotencyKey: string;
  actorUserId: string;
  actorUserName?: string;
  reason?: string;
  stockLoanIssueId?: string;
  fineractLoanId?: number;
};

type LedgerResult = {
  movement: Record<string, unknown>;
  balance: Record<string, unknown>;
  idempotentReplay: boolean;
};

export class InventoryLedgerServiceError extends Error {
  constructor(
    public readonly code:
      | "INVENTORY_ITEM_NOT_FOUND"
      | "INVENTORY_ITEM_INACTIVE"
      | "TENANT_MISMATCH"
      | "INVALID_REQUEST"
      | InventoryLedgerError["code"],
    message: string
  ) {
    super(message);
    this.name = "InventoryLedgerServiceError";
  }
}

function asString(value: unknown): string {
  if (value instanceof Prisma.Decimal) return value.toString();
  return String(value ?? "0");
}

function normalizeBalance(balance: Record<string, unknown>): InventoryBalanceSnapshot {
  return {
    quantityOnHand: asString(balance.quantityOnHand),
    quantityReserved: asString(balance.quantityReserved),
    stockValue: asString(balance.stockValue),
  };
}

function normalizeResultBalance(balance: Record<string, unknown>): Record<string, unknown> {
  return {
    ...balance,
    quantityOnHand: asString(balance.quantityOnHand),
    quantityReserved: asString(balance.quantityReserved),
    stockValue: asString(balance.stockValue),
  };
}

function normalizeMovementValue(type: InventoryMovementType, value?: string): string {
  if (value != null) return value;
  return type === "RESERVATION" || type === "RESERVATION_RELEASE" ? "0" : "";
}

function movementDeltas(type: InventoryMovementType, quantity: string, value: string) {
  const negativeQuantityTypes: InventoryMovementType[] = [
    "ADJUSTMENT_OUT",
    "ISSUE",
    "TRANSFER_OUT",
  ];
  const negativeValueTypes: InventoryMovementType[] = [
    "ADJUSTMENT_OUT",
    "ISSUE",
    "TRANSFER_OUT",
  ];

  return {
    quantityDelta: negativeQuantityTypes.includes(type) ? `-${quantity}` : quantity,
    valueDelta: negativeValueTypes.includes(type) ? `-${value}` : value,
  };
}

function convertLedgerError(error: unknown): never {
  if (error instanceof InventoryLedgerError) {
    throw new InventoryLedgerServiceError(error.code, error.message);
  }

  throw error;
}

async function requireActiveInventoryItem(
  tx: InventoryTx,
  tenantId: string,
  inventoryItemId: string
) {
  const item = await tx.inventoryItem.findFirst({
    where: {
      id: inventoryItemId,
      tenantId,
    },
  });

  if (!item) {
    throw new InventoryLedgerServiceError(
      "INVENTORY_ITEM_NOT_FOUND",
      "The inventory item could not be found for this tenant."
    );
  }

  if (item.isActive === false) {
    throw new InventoryLedgerServiceError(
      "INVENTORY_ITEM_INACTIVE",
      "The inventory item is inactive and cannot be moved."
    );
  }

  return item;
}

async function findOrCreateBalance(
  tx: InventoryTx,
  request: Pick<
    MovementRequest,
    "tenantId" | "inventoryItemId" | "fineractOfficeId" | "fineractOfficeName" | "currencyCode"
  >
) {
  const existing = await tx.inventoryBalance.findFirst({
    where: {
      tenantId: request.tenantId,
      inventoryItemId: request.inventoryItemId,
      fineractOfficeId: request.fineractOfficeId,
      currencyCode: request.currencyCode ?? "USD",
    },
  });

  if (existing) return existing;

  return tx.inventoryBalance.create({
    data: {
      tenantId: request.tenantId,
      inventoryItemId: request.inventoryItemId,
      fineractOfficeId: request.fineractOfficeId,
      fineractOfficeName: request.fineractOfficeName,
      quantityOnHand: "0",
      quantityReserved: "0",
      stockValue: "0",
      currencyCode: request.currencyCode ?? "USD",
    },
  });
}

async function recordMovement(
  db: InventoryDb,
  type: InventoryMovementType,
  request: MovementRequest
): Promise<LedgerResult> {
  return db.$transaction(async (tx) => {
    const existingMovement = await tx.inventoryMovement.findFirst({
      where: {
        tenantId: request.tenantId,
        idempotencyKey: request.idempotencyKey,
      },
    });

    if (existingMovement) {
      const balance = await findOrCreateBalance(tx, request);
      return {
        movement: existingMovement,
        balance: normalizeResultBalance(balance),
        idempotentReplay: true,
      };
    }

    await requireActiveInventoryItem(tx, request.tenantId, request.inventoryItemId);

    const currentBalance = await findOrCreateBalance(tx, request);
    const value = normalizeMovementValue(type, request.value);
    if (!value) {
      throw new InventoryLedgerServiceError(
        "INVALID_REQUEST",
        "A movement value is required for this stock action."
      );
    }

    let nextBalance: InventoryBalanceSnapshot;
    try {
      nextBalance = applyInventoryMovement(normalizeBalance(currentBalance), {
        type,
        quantity: request.quantity,
        value,
      });
    } catch (error) {
      convertLedgerError(error);
    }

    const updatedBalance = await tx.inventoryBalance.update({
      where: { id: currentBalance.id },
      data: {
        quantityOnHand: nextBalance.quantityOnHand,
        quantityReserved: nextBalance.quantityReserved,
        stockValue: nextBalance.stockValue,
        fineractOfficeName: request.fineractOfficeName,
        currencyCode: request.currencyCode ?? "USD",
      },
    });

    const deltas = movementDeltas(type, request.quantity, value);
    const movement = await tx.inventoryMovement.create({
      data: {
        tenantId: request.tenantId,
        inventoryItemId: request.inventoryItemId,
        fineractOfficeId: request.fineractOfficeId,
        fineractOfficeName: request.fineractOfficeName,
        stockLoanIssueId: request.stockLoanIssueId,
        fineractLoanId: request.fineractLoanId,
        type,
        quantityDelta: deltas.quantityDelta,
        valueDelta: deltas.valueDelta,
        currencyCode: request.currencyCode ?? "USD",
        idempotencyKey: request.idempotencyKey,
        reason: request.reason,
        actorUserId: request.actorUserId,
        actorUserName: request.actorUserName,
      },
    });

    return {
      movement,
      balance: normalizeResultBalance(updatedBalance),
      idempotentReplay: false,
    };
  });
}

export function receiveInventory(db: InventoryDb, request: MovementRequest) {
  return recordMovement(db, "RECEIPT", request);
}

export function reserveInventory(
  db: InventoryDb,
  request: Omit<MovementRequest, "value"> & { value?: string }
) {
  return recordMovement(db, "RESERVATION", { ...request, value: request.value ?? "0" });
}

export function releaseInventoryReservation(
  db: InventoryDb,
  request: Omit<MovementRequest, "value"> & { value?: string }
) {
  return recordMovement(db, "RESERVATION_RELEASE", {
    ...request,
    value: request.value ?? "0",
  });
}

export function issueReservedInventory(db: InventoryDb, request: MovementRequest) {
  return recordMovement(db, "ISSUE", request);
}
