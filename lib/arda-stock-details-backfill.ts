import { Prisma } from "@/app/generated/prisma";
import {
  upsertArdaStockDetails,
  type FineractRequester,
} from "@/lib/fineract-arda-stock-details";
import type { ArdaStockDetails } from "@/lib/inventory/arda-stock-workflow-service";
import { isArdaStockReportsEnabled } from "@/lib/tenant-arda-stock-reports";

export type BackfillStockIssueLine = {
  inventoryItemId: string;
  quantity: string | number | Prisma.Decimal;
  unitValue: string | number | Prisma.Decimal;
  lineValue: string | number | Prisma.Decimal;
  currencyCode: string;
  inventoryItem: {
    name: string;
    unitOfMeasure: string;
  };
};

export type BackfillStockIssue = {
  id: string;
  tenantSlug: string;
  fineractLoanId: number | null;
  fineractOfficeId: number;
  fineractOfficeName?: string | null;
  reference: string;
  externalReference?: string | null;
  totalValue: string | number | Prisma.Decimal;
  currencyCode: string;
  lines: BackfillStockIssueLine[];
};

export type BackfillSkipReason =
  | "not_arda"
  | "missing_fineract_loan_id"
  | "no_lines"
  | "multiple_lines"
  | "invalid_values";

export type BackfillMappingResult =
  | { status: "eligible"; details: ArdaStockDetails }
  | { status: "skipped"; reason: BackfillSkipReason };

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function positiveDecimal(value: unknown): Prisma.Decimal | null {
  try {
    const decimal = new Prisma.Decimal(String(value ?? ""));
    return decimal.isFinite() && decimal.gt(0) ? decimal : null;
  } catch {
    return null;
  }
}

export function toArdaStockDetailsFromIssue(
  issue: BackfillStockIssue
): BackfillMappingResult {
  if (text(issue.tenantSlug).toLowerCase() !== "arda") {
    return { status: "skipped", reason: "not_arda" };
  }
  if (!Number.isInteger(issue.fineractLoanId) || Number(issue.fineractLoanId) <= 0) {
    return { status: "skipped", reason: "missing_fineract_loan_id" };
  }
  if (issue.lines.length === 0) {
    return { status: "skipped", reason: "no_lines" };
  }
  if (issue.lines.length !== 1) {
    return { status: "skipped", reason: "multiple_lines" };
  }

  const line = issue.lines[0];
  const quantity = positiveDecimal(line.quantity);
  const unitValue = positiveDecimal(line.unitValue);
  const lineValue = positiveDecimal(line.lineValue);
  const issueTotal = positiveDecimal(issue.totalValue);
  const calculatedTotal = quantity && unitValue ? quantity.mul(unitValue) : null;
  const stockItemId = text(line.inventoryItemId);
  const stockItemName = text(line.inventoryItem?.name);
  const unitOfMeasure = text(line.inventoryItem?.unitOfMeasure);
  const currencyCode = text(line.currencyCode || issue.currencyCode).toUpperCase();
  const reference = text(issue.reference);

  if (
    !stockItemId ||
    !stockItemName ||
    !unitOfMeasure ||
    !currencyCode ||
    !reference ||
    !Number.isInteger(issue.fineractOfficeId) ||
    issue.fineractOfficeId <= 0 ||
    !quantity ||
    !unitValue ||
    !lineValue ||
    !issueTotal ||
    !calculatedTotal ||
    !calculatedTotal.equals(lineValue) ||
    !lineValue.equals(issueTotal)
  ) {
    return { status: "skipped", reason: "invalid_values" };
  }

  return {
    status: "eligible",
    details: {
      stockItemId,
      stockItemName,
      fineractOfficeId: issue.fineractOfficeId,
      fineractOfficeName: text(issue.fineractOfficeName) || undefined,
      quantity: quantity.toString(),
      unitOfMeasure,
      unitValue: unitValue.toString(),
      totalStockValue: calculatedTotal.toFixed(2),
      currencyCode,
      stockIssueReference: reference,
    },
  };
}

export type ArdaStockDetailsBackfillResult = {
  mode: "preview" | "applied";
  summary: {
    source: number;
    eligible: number;
    skipped: number;
    created: number;
    updated: number;
    errors: number;
  };
  skippedByReason: Partial<Record<BackfillSkipReason, number>>;
  errors: Array<{ fineractLoanId: number; message: string }>;
};

export async function runArdaStockDetailsBackfill(input: {
  issues: BackfillStockIssue[];
  apply: boolean;
  appTenantSlug: string;
  tenantSettings: unknown;
  fineractTenantId: string;
  request: FineractRequester;
}): Promise<ArdaStockDetailsBackfillResult> {
  if (
    !isArdaStockReportsEnabled({
      tenantSlug: input.appTenantSlug,
      tenantSettings: input.tenantSettings,
    })
  ) {
    throw new Error("ARDA stock reports are not enabled for this tenant.");
  }
  if (input.fineractTenantId.trim().toLowerCase() !== "arda") {
    throw new Error("The Fineract tenant must be arda.");
  }

  const summary = {
    source: input.issues.length,
    eligible: 0,
    skipped: 0,
    created: 0,
    updated: 0,
    errors: 0,
  };
  const skippedByReason: Partial<Record<BackfillSkipReason, number>> = {};
  const errors: Array<{ fineractLoanId: number; message: string }> = [];
  const eligible: Array<{
    fineractLoanId: number;
    details: ArdaStockDetails;
  }> = [];

  for (const issue of input.issues) {
    const mapped = toArdaStockDetailsFromIssue(issue);
    if (mapped.status === "skipped") {
      summary.skipped += 1;
      skippedByReason[mapped.reason] = (skippedByReason[mapped.reason] || 0) + 1;
      continue;
    }
    summary.eligible += 1;
    eligible.push({
      fineractLoanId: issue.fineractLoanId as number,
      details: mapped.details,
    });
  }

  if (input.apply) {
    for (const item of eligible) {
      try {
        const outcome = await upsertArdaStockDetails({
          appTenantSlug: input.appTenantSlug,
          tenantSettings: input.tenantSettings,
          fineractTenantId: input.fineractTenantId,
          fineractLoanId: item.fineractLoanId,
          details: item.details,
          request: input.request,
        });
        summary[outcome] += 1;
      } catch (error) {
        summary.errors += 1;
        errors.push({
          fineractLoanId: item.fineractLoanId,
          message: error instanceof Error ? error.message : "Unknown Fineract error",
        });
      }
    }
  }

  return {
    mode: input.apply ? "applied" : "preview",
    summary,
    skippedByReason,
    errors,
  };
}
