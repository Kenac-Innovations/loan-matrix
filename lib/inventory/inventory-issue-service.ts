import { Prisma } from "@/app/generated/prisma";

import { applyInventoryMovement, InventoryLedgerError } from "./inventory-ledger";
import {
  InventoryLedgerServiceError,
  type InventoryDb,
} from "./inventory-ledger-service";

type IssueRequest = {
  tenantId: string;
  inventoryItemId: string;
  fineractOfficeId: number;
  fineractOfficeName?: string;
  quantity: string;
  unitValue: string;
  currencyCode: string;
  borrowerName?: string;
  loanAccountNo?: string;
  externalReference?: string;
  leadId?: string;
  fineractLoanId?: number;
  actorUserId: string;
  actorUserName?: string;
  notes?: string;
  idempotencyKey: string;
};

function decimalString(value: unknown) {
  if (value instanceof Prisma.Decimal) return value.toString();
  return String(value ?? "0");
}

function multiplyDecimal(left: string, right: string) {
  return new Prisma.Decimal(left).mul(new Prisma.Decimal(right)).toFixed(2);
}

function normalizeBalance(balance: Record<string, unknown>) {
  return {
    quantityOnHand: decimalString(balance.quantityOnHand),
    quantityReserved: decimalString(balance.quantityReserved),
    stockValue: decimalString(balance.stockValue),
  };
}

export async function issueInventoryStock(db: InventoryDb, request: IssueRequest) {
  return db.$transaction(async (tx) => {
    const existingMovement = await tx.inventoryMovement.findFirst({
      where: { tenantId: request.tenantId, idempotencyKey: request.idempotencyKey },
    });

    if (existingMovement) {
      const existingIssue = await tx.stockLoanIssue.findFirst({
        where: { tenantId: request.tenantId, reference: request.idempotencyKey },
      });

      return {
        issue: existingIssue,
        movement: existingMovement,
        idempotentReplay: true,
      };
    }

    const item = await tx.inventoryItem.findFirst({
      where: { id: request.inventoryItemId, tenantId: request.tenantId },
    });

    if (!item || item.isActive === false) {
      throw new InventoryLedgerServiceError(
        "INVENTORY_ITEM_NOT_FOUND",
        "The selected stock item is not available for this tenant."
      );
    }

    const balance = await tx.inventoryBalance.findFirst({
      where: {
        tenantId: request.tenantId,
        inventoryItemId: request.inventoryItemId,
        fineractOfficeId: request.fineractOfficeId,
        currencyCode: request.currencyCode,
      },
    });

    if (!balance) {
      throw new InventoryLedgerServiceError(
        "INSUFFICIENT_STOCK",
        "This branch does not have stock for the selected item and currency."
      );
    }

    const lineValue = multiplyDecimal(request.quantity, request.unitValue);
    let reservedBalance;
    let nextBalance;

    try {
      reservedBalance = applyInventoryMovement(normalizeBalance(balance), {
        type: "RESERVATION",
        quantity: request.quantity,
        value: "0",
      });
      nextBalance = applyInventoryMovement(reservedBalance, {
        type: "ISSUE",
        quantity: request.quantity,
        value: lineValue,
      });
    } catch (error) {
      if (error instanceof InventoryLedgerError) {
        throw new InventoryLedgerServiceError(error.code, error.message);
      }
      throw error;
    }

    const issue = await tx.stockLoanIssue.create({
      data: {
        tenantId: request.tenantId,
        leadId: request.leadId,
        fineractLoanId: request.fineractLoanId,
        fineractOfficeId: request.fineractOfficeId,
        fineractOfficeName: request.fineractOfficeName,
        reference: request.idempotencyKey,
        status: "ISSUED",
        totalValue: lineValue,
        issuedAt: new Date(),
        issuedByUserId: request.actorUserId,
        issuedByUserName: request.actorUserName,
        borrowerName: request.borrowerName,
        loanAccountNo: request.loanAccountNo,
        externalReference: request.externalReference,
        currencyCode: request.currencyCode,
        notes: request.notes,
      },
    });
    const issueId = String(issue.id);

    const line = await tx.stockLoanIssueLine.create({
      data: {
        stockLoanIssueId: issueId,
        inventoryItemId: request.inventoryItemId,
        quantity: request.quantity,
        issuedQuantity: request.quantity,
        unitValue: request.unitValue,
        lineValue,
        currencyCode: request.currencyCode,
      },
    });

    const updatedBalance = await tx.inventoryBalance.update({
      where: { id: balance.id },
      data: {
        quantityOnHand: nextBalance.quantityOnHand,
        quantityReserved: nextBalance.quantityReserved,
        stockValue: nextBalance.stockValue,
        fineractOfficeName: request.fineractOfficeName,
        currencyCode: request.currencyCode,
      },
    });

    const reservationMovement = await tx.inventoryMovement.create({
      data: {
        tenantId: request.tenantId,
        inventoryItemId: request.inventoryItemId,
        fineractOfficeId: request.fineractOfficeId,
        fineractOfficeName: request.fineractOfficeName,
        stockLoanIssueId: issueId,
        fineractLoanId: request.fineractLoanId,
        type: "RESERVATION",
        quantityDelta: request.quantity,
        valueDelta: "0",
        currencyCode: request.currencyCode,
        idempotencyKey: `${request.idempotencyKey}:reservation`,
        reason: request.notes ?? "Stock reserved for borrower issue",
        actorUserId: request.actorUserId,
        actorUserName: request.actorUserName,
      },
    });

    const movement = await tx.inventoryMovement.create({
      data: {
        tenantId: request.tenantId,
        inventoryItemId: request.inventoryItemId,
        fineractOfficeId: request.fineractOfficeId,
        fineractOfficeName: request.fineractOfficeName,
        stockLoanIssueId: issueId,
        fineractLoanId: request.fineractLoanId,
        type: "ISSUE",
        quantityDelta: `-${request.quantity}`,
        valueDelta: `-${lineValue}`,
        currencyCode: request.currencyCode,
        idempotencyKey: request.idempotencyKey,
        reason: request.notes ?? "Stock issued to borrower",
        actorUserId: request.actorUserId,
        actorUserName: request.actorUserName,
      },
    });

    return {
      issue,
      line,
      reservationMovement,
      movement,
      balance: updatedBalance,
      idempotentReplay: false,
    };
  });
}
