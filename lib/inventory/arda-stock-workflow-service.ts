import { Prisma } from "@/app/generated/prisma";
import { prisma } from "@/lib/prisma";
import { isArdaTenantSlug } from "@/lib/arda-tenant";

import { isArdaStockInputLoanProduct } from "./arda-stock-loan";
import {
  applyInventoryMovement,
  InventoryLedgerError,
} from "./inventory-ledger";
import { InventoryLedgerServiceError } from "./inventory-ledger-service";

type ArdaStockSelection = {
  inventoryItemId?: unknown;
  inventoryItemName?: unknown;
  fineractOfficeId?: unknown;
  fineractOfficeName?: unknown;
  quantity?: unknown;
  unitValue?: unknown;
  totalValue?: unknown;
  currencyCode?: unknown;
};

type WorkflowLead = {
  id: string;
  tenantId: string;
  tenantSlug?: string | null;
  tenant?: { slug?: string | null } | null;
  loanProductId?: number | null;
  loanProductName?: string | null;
  stateMetadata?: unknown;
  fineractLoanId?: number | null;
  accountNumber?: string | null;
  fineractAccountNo?: string | null;
  externalId?: string | null;
  firstname?: string | null;
  middlename?: string | null;
  lastname?: string | null;
  fullname?: string | null;
};

type WorkflowStage = {
  isInitialState?: boolean | null;
  isFinalState?: boolean | null;
  fineractAction?: string | null;
  fineractStatus?: string | null;
  name?: string | null;
};

type WorkflowActor = {
  userId: string;
  userName?: string | null;
};

type InventoryWorkflowOperation = "RESERVE" | "RELEASE" | "ISSUE" | null;

type WorkflowInventoryResult = {
  operation: InventoryWorkflowOperation;
  changed: boolean;
  stockLoanIssueId?: string;
};

type TransactionClient = Prisma.TransactionClient;

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeToken(value: unknown): string {
  return normalize(value).toLowerCase();
}

function isRejectedStage(stage: WorkflowStage): boolean {
  const action = normalizeToken(stage.fineractAction);
  const status = normalizeToken(stage.fineractStatus);
  const name = normalizeToken(stage.name);

  return action === "reject" || status.includes("reject") || name.includes("reject");
}

function isDisbursementStage(stage: WorkflowStage): boolean {
  const action = normalizeToken(stage.fineractAction);
  const status = normalizeToken(stage.fineractStatus);
  const name = normalizeToken(stage.name);

  return action === "disburse" || status.includes("disburs") || name.includes("disburs");
}

function getLeadDisplayName(lead: WorkflowLead): string {
  const name = [lead.firstname, lead.middlename, lead.lastname]
    .map((part) => normalize(part))
    .filter(Boolean)
    .join(" ");

  return name || normalize(lead.fullname) || "ARDA borrower";
}

function getStoredStockSelection(lead: WorkflowLead): ArdaStockSelection | null {
  const metadata = lead.stateMetadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const loanTerms = (metadata as { loanTerms?: unknown }).loanTerms;
  if (!loanTerms || typeof loanTerms !== "object" || Array.isArray(loanTerms)) {
    return null;
  }

  const selection = (loanTerms as { stockLoanSelection?: unknown }).stockLoanSelection;
  if (!selection || typeof selection !== "object" || Array.isArray(selection)) {
    return null;
  }

  return selection as ArdaStockSelection;
}

function parsePositiveDecimal(value: unknown, field: string): string {
  const raw = normalize(value);
  const parsed = new Prisma.Decimal(raw || "0");
  if (!parsed.isFinite() || parsed.lte(0)) {
    throw new InventoryLedgerServiceError(
      "INVALID_REQUEST",
      `${field} must be greater than zero for an ARDA stock loan.`
    );
  }

  return parsed.toString();
}

function getArdaStockDetails(lead: WorkflowLead) {
  // State transitions load the tenant relation, whereas lightweight callers
  // may supply tenantSlug directly. Support both forms so an ARDA workflow is
  // not silently skipped after Fineract has completed its action.
  if (!isArdaTenantSlug(lead.tenantSlug || lead.tenant?.slug)) return null;

  const selection = getStoredStockSelection(lead);
  if (!selection) return null;

  if (
    !isArdaStockInputLoanProduct({
      id: lead.loanProductId,
      name: lead.loanProductName,
    })
  ) {
    return null;
  }

  const inventoryItemId = normalize(selection.inventoryItemId);
  const officeId = Number(selection.fineractOfficeId);
  if (!inventoryItemId || !Number.isInteger(officeId)) {
    throw new InventoryLedgerServiceError(
      "INVALID_REQUEST",
      "The ARDA stock loan is missing its stock item or branch selection."
    );
  }

  const quantity = parsePositiveDecimal(selection.quantity, "Stock quantity");
  const unitValue = parsePositiveDecimal(selection.unitValue, "Stock unit value");
  const currencyCode = normalize(selection.currencyCode || "USD").toUpperCase();

  return {
    inventoryItemId,
    inventoryItemName: normalize(selection.inventoryItemName) || "ARDA stock item",
    fineractOfficeId: officeId,
    fineractOfficeName: normalize(selection.fineractOfficeName) || undefined,
    quantity,
    unitValue,
    totalValue: new Prisma.Decimal(quantity).mul(unitValue).toFixed(2),
    currencyCode,
  };
}

/**
 * Determines the stock action from the workflow destination. Drafts hold no
 * stock; any active review or approval stage reserves it; rejection releases
 * it; and disbursement turns the reservation into an issued stock movement.
 */
export function getArdaInventoryWorkflowOperation(
  lead: WorkflowLead,
  targetStage: WorkflowStage
): InventoryWorkflowOperation {
  if (!getArdaStockDetails(lead)) return null;

  if (isDisbursementStage(targetStage)) return "ISSUE";
  if (
    isRejectedStage(targetStage) ||
    targetStage.isInitialState === true ||
    targetStage.isFinalState === true
  ) {
    return "RELEASE";
  }

  return "RESERVE";
}

function mapLedgerError(error: unknown): never {
  if (error instanceof InventoryLedgerError) {
    throw new InventoryLedgerServiceError(error.code, error.message);
  }

  throw error;
}

async function getActiveItemAndBalance(
  tx: TransactionClient,
  lead: WorkflowLead,
  details: NonNullable<ReturnType<typeof getArdaStockDetails>>
) {
  const item = await tx.inventoryItem.findFirst({
    where: { id: details.inventoryItemId, tenantId: lead.tenantId },
    select: { id: true, isActive: true },
  });
  if (!item || !item.isActive) {
    throw new InventoryLedgerServiceError(
      "INVENTORY_ITEM_NOT_FOUND",
      "The selected ARDA stock item is no longer available."
    );
  }

  const balance = await tx.inventoryBalance.findFirst({
    where: {
      tenantId: lead.tenantId,
      inventoryItemId: details.inventoryItemId,
      fineractOfficeId: details.fineractOfficeId,
      currencyCode: details.currencyCode,
    },
  });
  if (!balance) {
    throw new InventoryLedgerServiceError(
      "INSUFFICIENT_STOCK",
      "The selected branch has no stock balance for this ARDA item."
    );
  }

  return { item, balance };
}

async function reserveStockForLead(
  tx: TransactionClient,
  lead: WorkflowLead,
  details: NonNullable<ReturnType<typeof getArdaStockDetails>>,
  actor: WorkflowActor
): Promise<WorkflowInventoryResult> {
  const existingIssue = await tx.stockLoanIssue.findFirst({
    where: { tenantId: lead.tenantId, leadId: lead.id },
    select: { id: true, status: true },
  });

  if (existingIssue?.status === "RESERVED" || existingIssue?.status === "ISSUED") {
    return { operation: "RESERVE", changed: false, stockLoanIssueId: existingIssue.id };
  }

  if (existingIssue) {
    throw new InventoryLedgerServiceError(
      "INVALID_REQUEST",
      "This ARDA stock loan already has a cancelled or returned stock record and cannot be reserved again."
    );
  }

  const { balance } = await getActiveItemAndBalance(tx, lead, details);
  let nextBalance;
  try {
    nextBalance = applyInventoryMovement(
      {
        quantityOnHand: balance.quantityOnHand.toString(),
        quantityReserved: balance.quantityReserved.toString(),
        stockValue: balance.stockValue.toString(),
      },
      { type: "RESERVATION", quantity: details.quantity, value: "0" }
    );
  } catch (error) {
    mapLedgerError(error);
  }

  const issue = await tx.stockLoanIssue.create({
    data: {
      tenantId: lead.tenantId,
      leadId: lead.id,
      fineractLoanId: lead.fineractLoanId,
      fineractOfficeId: details.fineractOfficeId,
      fineractOfficeName: details.fineractOfficeName,
      reference: `arda-stock:${lead.id}`,
      status: "RESERVED",
      totalValue: details.totalValue,
      currencyCode: details.currencyCode,
      borrowerName: getLeadDisplayName(lead),
      loanAccountNo: lead.fineractAccountNo || lead.accountNumber,
      externalReference: lead.externalId,
      notes: "Reserved automatically when the ARDA lead entered the approval workflow.",
    },
  });

  await tx.stockLoanIssueLine.create({
    data: {
      stockLoanIssueId: issue.id,
      inventoryItemId: details.inventoryItemId,
      quantity: details.quantity,
      unitValue: details.unitValue,
      lineValue: details.totalValue,
      currencyCode: details.currencyCode,
    },
  });

  await tx.inventoryBalance.update({
    where: { id: balance.id },
    data: {
      quantityOnHand: nextBalance.quantityOnHand,
      quantityReserved: nextBalance.quantityReserved,
      stockValue: nextBalance.stockValue,
      fineractOfficeName: details.fineractOfficeName,
    },
  });

  await tx.inventoryMovement.create({
    data: {
      tenantId: lead.tenantId,
      inventoryItemId: details.inventoryItemId,
      fineractOfficeId: details.fineractOfficeId,
      fineractOfficeName: details.fineractOfficeName,
      stockLoanIssueId: issue.id,
      fineractLoanId: lead.fineractLoanId,
      type: "RESERVATION",
      quantityDelta: details.quantity,
      valueDelta: "0",
      currencyCode: details.currencyCode,
      idempotencyKey: `arda-stock-reservation:${lead.id}`,
      reason: `Reserved for ARDA approval workflow: ${getLeadDisplayName(lead)}.`,
      actorUserId: actor.userId,
      actorUserName: actor.userName || undefined,
    },
  });

  return { operation: "RESERVE", changed: true, stockLoanIssueId: issue.id };
}

async function releaseReservedStockForLead(
  tx: TransactionClient,
  lead: WorkflowLead,
  details: NonNullable<ReturnType<typeof getArdaStockDetails>>,
  actor: WorkflowActor
): Promise<WorkflowInventoryResult> {
  const issue = await tx.stockLoanIssue.findFirst({
    where: { tenantId: lead.tenantId, leadId: lead.id },
    include: { lines: { select: { quantity: true } } },
  });

  if (!issue || issue.status !== "RESERVED") {
    return { operation: "RELEASE", changed: false, stockLoanIssueId: issue?.id };
  }

  const { balance } = await getActiveItemAndBalance(tx, lead, details);
  let nextBalance;
  try {
    nextBalance = applyInventoryMovement(
      {
        quantityOnHand: balance.quantityOnHand.toString(),
        quantityReserved: balance.quantityReserved.toString(),
        stockValue: balance.stockValue.toString(),
      },
      { type: "RESERVATION_RELEASE", quantity: details.quantity, value: "0" }
    );
  } catch (error) {
    mapLedgerError(error);
  }

  await tx.inventoryBalance.update({
    where: { id: balance.id },
    data: { quantityReserved: nextBalance.quantityReserved },
  });
  await tx.stockLoanIssue.update({
    where: { id: issue.id },
    data: {
      status: "CANCELLED",
      notes: "Reservation released because the ARDA lead was rejected or returned to draft.",
    },
  });
  await tx.inventoryMovement.create({
    data: {
      tenantId: lead.tenantId,
      inventoryItemId: details.inventoryItemId,
      fineractOfficeId: details.fineractOfficeId,
      fineractOfficeName: details.fineractOfficeName,
      stockLoanIssueId: issue.id,
      fineractLoanId: lead.fineractLoanId,
      type: "RESERVATION_RELEASE",
      quantityDelta: `-${details.quantity}`,
      valueDelta: "0",
      currencyCode: details.currencyCode,
      idempotencyKey: `arda-stock-reservation-release:${lead.id}`,
      reason: `ARDA reservation released: ${getLeadDisplayName(lead)}.`,
      actorUserId: actor.userId,
      actorUserName: actor.userName || undefined,
    },
  });

  return { operation: "RELEASE", changed: true, stockLoanIssueId: issue.id };
}

async function issueReservedStockForLead(
  tx: TransactionClient,
  lead: WorkflowLead,
  details: NonNullable<ReturnType<typeof getArdaStockDetails>>,
  actor: WorkflowActor
): Promise<WorkflowInventoryResult> {
  const issue = await tx.stockLoanIssue.findFirst({
    where: { tenantId: lead.tenantId, leadId: lead.id },
    include: { lines: { select: { id: true, quantity: true } } },
  });

  if (!issue || issue.status !== "RESERVED") {
    throw new InventoryLedgerServiceError(
      "INSUFFICIENT_RESERVATION",
      "ARDA stock must be reserved during approval before this loan can be disbursed."
    );
  }

  const { balance } = await getActiveItemAndBalance(tx, lead, details);
  let nextBalance;
  try {
    nextBalance = applyInventoryMovement(
      {
        quantityOnHand: balance.quantityOnHand.toString(),
        quantityReserved: balance.quantityReserved.toString(),
        stockValue: balance.stockValue.toString(),
      },
      { type: "ISSUE", quantity: details.quantity, value: details.totalValue }
    );
  } catch (error) {
    mapLedgerError(error);
  }

  await tx.inventoryBalance.update({
    where: { id: balance.id },
    data: {
      quantityOnHand: nextBalance.quantityOnHand,
      quantityReserved: nextBalance.quantityReserved,
      stockValue: nextBalance.stockValue,
    },
  });
  await tx.stockLoanIssue.update({
    where: { id: issue.id },
    data: {
      status: "ISSUED",
      fineractLoanId: lead.fineractLoanId,
      issuedAt: new Date(),
      issuedByUserId: actor.userId,
      issuedByUserName: actor.userName || undefined,
      loanAccountNo: lead.fineractAccountNo || lead.accountNumber,
      notes: "Stock issued automatically when the ARDA loan was disbursed.",
    },
  });
  await tx.stockLoanIssueLine.updateMany({
    where: { stockLoanIssueId: issue.id },
    data: { issuedQuantity: details.quantity },
  });
  await tx.inventoryMovement.create({
    data: {
      tenantId: lead.tenantId,
      inventoryItemId: details.inventoryItemId,
      fineractOfficeId: details.fineractOfficeId,
      fineractOfficeName: details.fineractOfficeName,
      stockLoanIssueId: issue.id,
      fineractLoanId: lead.fineractLoanId,
      type: "ISSUE",
      quantityDelta: `-${details.quantity}`,
      valueDelta: `-${details.totalValue}`,
      currencyCode: details.currencyCode,
      idempotencyKey: `arda-stock-issue:${lead.id}`,
      reason: `Issued for disbursed ARDA loan: ${getLeadDisplayName(lead)}.`,
      actorUserId: actor.userId,
      actorUserName: actor.userName || undefined,
    },
  });

  return { operation: "ISSUE", changed: true, stockLoanIssueId: issue.id };
}

export async function applyArdaInventoryWorkflowOperation(input: {
  lead: WorkflowLead;
  targetStage: WorkflowStage;
  actor: WorkflowActor;
}): Promise<WorkflowInventoryResult> {
  const operation = getArdaInventoryWorkflowOperation(input.lead, input.targetStage);
  if (!operation) return { operation: null, changed: false };

  const details = getArdaStockDetails(input.lead);
  if (!details) return { operation: null, changed: false };

  return prisma.$transaction(async (tx) => {
    if (operation === "RESERVE") {
      return reserveStockForLead(tx, input.lead, details, input.actor);
    }
    if (operation === "RELEASE") {
      return releaseReservedStockForLead(tx, input.lead, details, input.actor);
    }
    return issueReservedStockForLead(tx, input.lead, details, input.actor);
  });
}

/**
 * Checks stock availability before an external Fineract action runs. This
 * keeps a loan from being approved or disbursed when its input cannot be
 * safely reserved or issued locally.
 */
export async function validateArdaInventoryWorkflowOperation(input: {
  lead: WorkflowLead;
  targetStage: WorkflowStage;
}): Promise<InventoryWorkflowOperation> {
  const operation = getArdaInventoryWorkflowOperation(input.lead, input.targetStage);
  if (!operation) return null;

  const details = getArdaStockDetails(input.lead);
  if (!details) return null;

  if (operation === "RELEASE") return operation;

  const existingIssue = await prisma.stockLoanIssue.findFirst({
    where: { tenantId: input.lead.tenantId, leadId: input.lead.id },
    select: { status: true },
  });

  if (operation === "ISSUE") {
    if (existingIssue?.status !== "RESERVED") {
      throw new InventoryLedgerServiceError(
        "INSUFFICIENT_RESERVATION",
        "ARDA stock must be reserved during approval before this loan can be disbursed."
      );
    }
    return operation;
  }

  if (existingIssue?.status === "RESERVED" || existingIssue?.status === "ISSUED") {
    return operation;
  }

  const balance = await prisma.inventoryBalance.findFirst({
    where: {
      tenantId: input.lead.tenantId,
      inventoryItemId: details.inventoryItemId,
      fineractOfficeId: details.fineractOfficeId,
      currencyCode: details.currencyCode,
    },
  });
  if (!balance) {
    throw new InventoryLedgerServiceError(
      "INSUFFICIENT_STOCK",
      "The selected branch has no stock balance for this ARDA item."
    );
  }

  try {
    applyInventoryMovement(
      {
        quantityOnHand: balance.quantityOnHand.toString(),
        quantityReserved: balance.quantityReserved.toString(),
        stockValue: balance.stockValue.toString(),
      },
      { type: "RESERVATION", quantity: details.quantity, value: "0" }
    );
  } catch (error) {
    mapLedgerError(error);
  }

  return operation;
}
