import { StockControlError } from "./stock-errors";
import { Prisma, type PrismaClient } from "@/app/generated/prisma";
import { lockInventoryTenant } from "./inventory-lock";
import {
  parseStockSelection,
  type StockSelection,
} from "./stock-product-policy";
export type ReservationInput = {
  tenantId: string;
  leadId: string;
  actorUserId: string;
  selection: StockSelection;
};
export type ReservationResult = {
  issueId: string;
  generation: number;
  status: string;
  changed: boolean;
};
type Tx = Prisma.TransactionClient;
const activeOperationStates = ["PREPARED", "UNCERTAIN", "CONFIRMED"];
export async function assertNoPendingStockAction(
  tx: Tx,
  tenantId: string,
  leadId: string,
) {
  const pending = await tx.stockActionOperation.findFirst({
    where: { tenantId, leadId, status: { in: activeOperationStates } },
  });
  if (pending)
    throw new StockControlError(
      "This loan has a pending stock action. Reconcile it before changing or releasing stock.",
    );
}
async function loadIssue(tx: Tx, input: { tenantId: string; leadId: string }) {
  return tx.stockLoanIssue.findFirst({
    where: { tenantId: input.tenantId, leadId: input.leadId },
    include: { lines: true },
  });
}
async function itemAndBalance(tx: Tx, tenantId: string, s: StockSelection) {
  await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id=${s.inventoryItemId} AND "tenantId"=${tenantId} FOR UPDATE`;
  const item = await tx.inventoryItem.findFirst({
    where: { id: s.inventoryItemId, tenantId, isActive: true },
  });
  if (!item || item.currencyCode !== s.currencyCode)
    throw new StockControlError(
      "The selected stock item is not active or its currency does not match.",
    );
  const balance = await tx.inventoryBalance.findFirst({
    where: {
      tenantId,
      inventoryItemId: s.inventoryItemId,
      fineractOfficeId: s.fineractOfficeId,
      currencyCode: s.currencyCode,
    },
  });
  if (!balance)
    throw new StockControlError(
      "The selected branch has no available stock for this item.",
    );
  return { item, balance };
}
function result(
  issue: { id: string; reservationGeneration: number; status: string },
  changed: boolean,
): ReservationResult {
  return {
    issueId: issue.id,
    generation: issue.reservationGeneration,
    status: issue.status,
    changed,
  };
}
async function movement(
  tx: Tx,
  input: { tenantId: string; leadId: string; actorUserId: string },
  issue: {
    id: string;
    reservationGeneration: number;
    fineractLoanId: number | null;
  },
  s: StockSelection,
  type: "RESERVATION" | "RESERVATION_RELEASE" | "ISSUE",
  reason: string,
) {
  const quantity = new Prisma.Decimal(s.quantity);
  const value = quantity.mul(s.unitValue);
  await tx.inventoryMovement.create({
    data: {
      tenantId: input.tenantId,
      inventoryItemId: s.inventoryItemId,
      fineractOfficeId: s.fineractOfficeId,
      currencyCode: s.currencyCode,
      stockLoanIssueId: issue.id,
      fineractLoanId: issue.fineractLoanId,
      type,
      quantityDelta: type === "RESERVATION" ? quantity : quantity.neg(),
      valueDelta: type === "ISSUE" ? value.neg() : 0,
      idempotencyKey: `stock:${issue.id}:${issue.reservationGeneration}:${type}`,
      actorUserId: input.actorUserId,
      reason,
    },
  });
}
export function selectionFromIssue(
  issue: NonNullable<Awaited<ReturnType<typeof loadIssue>>>,
): StockSelection {
  if (issue.lines.length !== 1)
    throw new StockControlError("This reservation needs review: expected one stock item.");
  const l = issue.lines[0];
  return {
    inventoryItemId: l.inventoryItemId,
    fineractOfficeId: issue.fineractOfficeId,
    currencyCode: issue.currencyCode,
    quantity: l.quantity.toString(),
    unitValue: l.unitValue.toString(),
  };
}
export async function reserveStockInTransaction(
  tx: Tx,
  input: ReservationInput,
): Promise<ReservationResult> {
  const s = parseStockSelection(input.selection);
  const lead = await tx.lead.findFirst({
    where: { id: input.leadId, tenantId: input.tenantId },
  });
  if (!lead) throw new StockControlError("Stock loan not found in this tenant.");
  await assertNoPendingStockAction(tx, input.tenantId, input.leadId);
  const old = await loadIssue(tx, input);
  const { balance } = await itemAndBalance(tx, input.tenantId, s);
  if (old?.status === "ISSUED" || old?.status === "REPAID")
    throw new StockControlError("Stock has already been issued for this loan.");
  if (old?.status === "RESERVED") {
    const previous = selectionFromIssue(old);
    if (JSON.stringify(previous) === JSON.stringify(s))
      return result(old, false);
    // Release from the original persisted balance, never from edited loan metadata.
    await releaseStockInTransaction(tx, {
      ...input,
      reason: "Stock selection changed",
    });
  }
  const available = await tx.inventoryBalance.findUniqueOrThrow({
    where: { id: balance.id },
  });
  const quantity = new Prisma.Decimal(s.quantity);
  if (available.quantityOnHand.minus(available.quantityReserved).lt(quantity))
    throw new StockControlError(
      `Insufficient stock: ${available.quantityOnHand.minus(available.quantityReserved)} available at the selected branch; ${quantity} requested.`,
    );
  const generation = (old?.reservationGeneration ?? 0) + 1;
  const data = {
    tenantId: input.tenantId,
    leadId: input.leadId,
    fineractLoanId: lead.fineractLoanId,
    fineractOfficeId: s.fineractOfficeId,
    currencyCode: s.currencyCode,
    totalValue: quantity.mul(s.unitValue),
    status: "RESERVED" as const,
    reservationGeneration: generation,
    borrowerName:
      lead.fullname ||
      [lead.firstname, lead.lastname].filter(Boolean).join(" "),
    loanAccountNo: lead.fineractAccountNo || lead.accountNumber,
  };
  const issue = old
    ? await tx.stockLoanIssue.update({ where: { id: old.id }, data })
    : await tx.stockLoanIssue.create({
        data: { ...data, reference: `arda-stock:${lead.id}` },
      });
  if (old)
    await tx.stockLoanIssueLine.deleteMany({
      where: { stockLoanIssueId: old.id },
    });
  await tx.stockLoanIssueLine.create({
    data: {
      stockLoanIssueId: issue.id,
      inventoryItemId: s.inventoryItemId,
      quantity,
      unitValue: s.unitValue,
      lineValue: quantity.mul(s.unitValue),
      currencyCode: s.currencyCode,
    },
  });
  await tx.inventoryBalance.update({
    where: { id: balance.id },
    data: { quantityReserved: { increment: quantity } },
  });
  await movement(
    tx,
    input,
    issue,
    s,
    "RESERVATION",
    "Stock reserved for loan approval",
  );
  return result(issue, true);
}
export async function releaseStockInTransaction(
  tx: Tx,
  input: {
    tenantId: string;
    leadId: string;
    actorUserId: string;
    reason: string;
  },
): Promise<ReservationResult | null> {
  await assertNoPendingStockAction(tx, input.tenantId, input.leadId);
  const issue = await loadIssue(tx, input);
  if (!issue || issue.status === "CANCELLED")
    return issue ? result(issue, false) : null;
  if (issue.status !== "RESERVED")
    throw new StockControlError(
      "Issued or processing stock requires reconciliation before release.",
    );
  const s = selectionFromIssue(issue);
  const balance = await tx.inventoryBalance.findFirstOrThrow({
    where: {
      tenantId: input.tenantId,
      inventoryItemId: s.inventoryItemId,
      fineractOfficeId: s.fineractOfficeId,
      currencyCode: s.currencyCode,
    },
  });
  if (balance.quantityReserved.lt(s.quantity))
    throw new StockControlError(
      "Reserved stock balance is inconsistent; reconciliation is required.",
    );
  await tx.inventoryBalance.update({
    where: { id: balance.id },
    data: { quantityReserved: { decrement: s.quantity } },
  });
  await movement(tx, input, issue, s, "RESERVATION_RELEASE", input.reason);
  const updated = await tx.stockLoanIssue.update({
    where: { id: issue.id },
    data: { status: "CANCELLED" },
  });
  return result(updated, true);
}
export async function verifyReservation(
  tx: Tx,
  input: { tenantId: string; leadId: string; selection: StockSelection },
) {
  const issue = await loadIssue(tx, input);
  const s = parseStockSelection(input.selection);
  if (!issue || issue.status !== "RESERVED")
    throw new StockControlError("Stock must be reserved before disbursement.");
  if (JSON.stringify(selectionFromIssue(issue)) !== JSON.stringify(s))
    throw new StockControlError(
      "Stock selection changed. Update the reservation before disbursement.",
    );
  const { balance } = await itemAndBalance(tx, input.tenantId, s);
  if (
    balance.quantityReserved.lt(s.quantity) ||
    balance.quantityOnHand.lt(balance.quantityReserved) ||
    balance.stockValue.lt(new Prisma.Decimal(s.quantity).mul(s.unitValue))
  )
    throw new StockControlError(
      "Reserved stock is unavailable or its value is inconsistent. Reconcile before disbursement.",
    );
  return issue;
}
export async function consumeStockInTransaction(
  tx: Tx,
  input: {
    tenantId: string;
    leadId: string;
    actorUserId: string;
    operationId: string;
  },
): Promise<ReservationResult> {
  const op = await tx.stockActionOperation.findFirst({
    where: {
      id: input.operationId,
      tenantId: input.tenantId,
      leadId: input.leadId,
      command: "disburse",
      status: { in: ["CONFIRMED", "FINALIZED"] },
    },
  });
  if (!op) throw new StockControlError("Disbursement has not been confirmed.");
  const issue = await loadIssue(tx, input);
  if (!issue) throw new StockControlError("Stock reservation not found.");
  if (op.status === "FINALIZED" && issue.status === "ISSUED")
    return result(issue, false);
  if (
    issue.reservationGeneration !== op.generation ||
    issue.status !== "RESERVED"
  )
    throw new StockControlError("Stock reservation changed during disbursement.");
  const s = selectionFromIssue(issue);
  const balance = await tx.inventoryBalance.findFirstOrThrow({
    where: {
      tenantId: input.tenantId,
      inventoryItemId: s.inventoryItemId,
      fineractOfficeId: s.fineractOfficeId,
      currencyCode: s.currencyCode,
    },
  });
  const value = new Prisma.Decimal(s.quantity).mul(s.unitValue);
  if (
    balance.quantityReserved.lt(s.quantity) ||
    balance.quantityOnHand.lt(s.quantity) ||
    balance.stockValue.lt(value)
  )
    throw new StockControlError("Stock balance requires reconciliation.");
  await tx.inventoryBalance.update({
    where: { id: balance.id },
    data: {
      quantityOnHand: { decrement: s.quantity },
      quantityReserved: { decrement: s.quantity },
      stockValue: { decrement: value },
    },
  });
  await tx.stockLoanIssueLine.updateMany({
    where: { stockLoanIssueId: issue.id },
    data: { issuedQuantity: s.quantity },
  });
  await movement(
    tx,
    input,
    issue,
    s,
    "ISSUE",
    "Stock issued for confirmed disbursement",
  );
  const updated = await tx.stockLoanIssue.update({
    where: { id: issue.id },
    data: {
      status: "ISSUED",
      issuedAt: new Date(),
      issuedByUserId: input.actorUserId,
    },
  });
  return result(updated, true);
}
export function createStockReservationService(db: PrismaClient) {
  const transaction = <T>(tenantId: string, fn: (tx: Tx) => Promise<T>) =>
    db.$transaction(
      async (tx) => {
        await lockInventoryTenant(tx, tenantId);
        return fn(tx);
      },
      { timeout: 15000 },
    );
  return {
    reserve: (input: ReservationInput) =>
      transaction(input.tenantId, (tx) => reserveStockInTransaction(tx, input)),
    release: (input: {
      tenantId: string;
      leadId: string;
      actorUserId: string;
      reason: string;
    }) =>
      transaction(input.tenantId, (tx) => releaseStockInTransaction(tx, input)),
    consume: (input: {
      tenantId: string;
      leadId: string;
      actorUserId: string;
      operationId: string;
    }) =>
      transaction(input.tenantId, (tx) => consumeStockInTransaction(tx, input)),
  };
}
export const reserveStock = async (input: ReservationInput) =>
  createStockReservationService((await import("../prisma")).prisma).reserve(
    input,
  );
export const releaseStock = async (input: {
  tenantId: string;
  leadId: string;
  actorUserId: string;
  reason: string;
}) =>
  createStockReservationService((await import("../prisma")).prisma).release(
    input,
  );
