import { Prisma } from "@/app/generated/prisma";

import {
  InventoryLedgerServiceError,
  type InventoryDb,
} from "./inventory-ledger-service";

type RepaymentRequest = {
  tenantId: string;
  stockLoanIssueId: string;
  amount: string;
  currencyCode: string;
  paymentDate: Date;
  reference?: string;
  notes?: string;
  actorUserId: string;
  actorUserName?: string;
  idempotencyKey: string;
};

function decimalString(value: unknown) {
  if (value instanceof Prisma.Decimal) return value.toString();
  return String(value ?? "0");
}

function normalizeMoney(value: string) {
  return new Prisma.Decimal(value).toFixed(2);
}

function repaymentTotal(repayments: unknown) {
  if (!Array.isArray(repayments)) return new Prisma.Decimal(0);

  return repayments.reduce((total, repayment) => {
    const amount = (repayment as Record<string, unknown>).amount;
    return total.plus(decimalString(amount));
  }, new Prisma.Decimal(0));
}

export async function recordInventoryRepayment(
  db: InventoryDb,
  request: RepaymentRequest
) {
  return db.$transaction(async (tx) => {
    const existingRepayment = await tx.stockLoanRepayment.findFirst({
      where: {
        tenantId: request.tenantId,
        idempotencyKey: request.idempotencyKey,
      },
    });

    if (existingRepayment) {
      return {
        repayment: existingRepayment,
        idempotentReplay: true,
      };
    }

    const issue = await tx.stockLoanIssue.findFirst({
      where: {
        id: request.stockLoanIssueId,
        tenantId: request.tenantId,
      },
      include: {
        repayments: true,
      },
    });

    if (!issue) {
      throw new InventoryLedgerServiceError(
        "INVALID_REQUEST",
        "The stock issue could not be found for this tenant."
      );
    }

    const totalValue = new Prisma.Decimal(decimalString(issue.totalValue));
    const previousPaid = repaymentTotal(issue.repayments);
    const amount = new Prisma.Decimal(request.amount);
    const newTotalPaid = previousPaid.plus(amount);

    if (amount.lte(0)) {
      throw new InventoryLedgerServiceError(
        "INVALID_REQUEST",
        "The repayment amount must be greater than zero."
      );
    }

    if (newTotalPaid.gt(totalValue)) {
      throw new InventoryLedgerServiceError(
        "INVALID_REQUEST",
        "The repayment amount is greater than the outstanding stock issue value."
      );
    }

    const outstandingBalance = totalValue.minus(newTotalPaid);
    const nextStatus = outstandingBalance.eq(0) ? "REPAID" : String(issue.status ?? "ISSUED");

    const repayment = await tx.stockLoanRepayment.create({
      data: {
        tenantId: request.tenantId,
        stockLoanIssueId: request.stockLoanIssueId,
        amount: normalizeMoney(request.amount),
        currencyCode: request.currencyCode,
        paymentDate: request.paymentDate,
        reference: request.reference,
        notes: request.notes,
        actorUserId: request.actorUserId,
        actorUserName: request.actorUserName,
        idempotencyKey: request.idempotencyKey,
      },
    });

    const updatedIssue = await tx.stockLoanIssue.update({
      where: { id: request.stockLoanIssueId },
      data: {
        status: nextStatus,
      },
    });

    return {
      repayment,
      issue: updatedIssue,
      totalPaid: newTotalPaid.toFixed(2),
      outstandingBalance: outstandingBalance.toFixed(2),
      idempotentReplay: false,
    };
  });
}
