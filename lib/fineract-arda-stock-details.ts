import { Prisma } from "@/app/generated/prisma";
import {
  fetchFineractAPI,
  type FineractRequestInit,
} from "@/lib/api";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";
import type { ArdaStockDetails } from "@/lib/inventory/arda-stock-workflow-service";
import { isArdaStockReportsEnabled } from "@/lib/tenant-arda-stock-reports";

export const ARDA_STOCK_DETAILS_TABLE = "arda_stock_details";

export type FineractRequester = (
  endpoint: string,
  options?: FineractRequestInit
) => Promise<unknown>;

function normalizeTenant(value: string): string {
  return value.trim().toLowerCase();
}

function assertArdaScope(input: {
  appTenantSlug: string;
  tenantSettings: unknown;
  fineractTenantId: string;
}): void {
  if (
    !isArdaStockReportsEnabled({
      tenantSlug: input.appTenantSlug,
      tenantSettings: input.tenantSettings,
    })
  ) {
    throw new Error("ARDA stock reports are not enabled for this tenant.");
  }

  if (normalizeTenant(input.fineractTenantId) !== "arda") {
    throw new Error("The resolved Fineract tenant must be arda.");
  }
}

function isAlreadyExistsError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    status?: unknown;
    message?: unknown;
    errorData?: unknown;
  };
  if (candidate.status === 409) return true;

  const message = [candidate.message, candidate.errorData]
    .filter(Boolean)
    .map((value) =>
      typeof value === "string" ? value : JSON.stringify(value)
    )
    .join(" ")
    .toLowerCase();
  return message.includes("already exists") || message.includes("already exist");
}

export function buildArdaStockDetailsPayload(
  details: ArdaStockDetails
): Record<string, string> {
  const quantity = new Prisma.Decimal(details.quantity);
  const unitValue = new Prisma.Decimal(details.unitValue);
  const expectedTotal = quantity.mul(unitValue).toFixed(2);
  if (!new Prisma.Decimal(details.totalStockValue).equals(expectedTotal)) {
    throw new Error(
      "The ARDA stock total does not match quantity multiplied by unit value."
    );
  }

  return {
    stock_item_id: details.stockItemId,
    stock_item_name: details.stockItemName,
    quantity: details.quantity,
    unit_of_measure: details.unitOfMeasure,
    unit_value: details.unitValue,
    total_stock_value: expectedTotal,
    currency_code: details.currencyCode,
    stock_issue_reference: details.stockIssueReference,
  };
}

export async function ensureArdaStockDetailsDatatable(input: {
  appTenantSlug: string;
  tenantSettings: unknown;
  fineractTenantId: string;
  request: FineractRequester;
}): Promise<"created" | "exists"> {
  assertArdaScope(input);

  try {
    await input.request("/datatables", {
      method: "POST",
      authMode: "service",
      body: JSON.stringify({
        datatableName: ARDA_STOCK_DETAILS_TABLE,
        apptableName: "m_loan",
        multiRow: false,
        columns: [
          { name: "stock_item_id", type: "String", length: 100, mandatory: true },
          { name: "stock_item_name", type: "String", length: 200, mandatory: true },
          { name: "quantity", type: "Decimal", mandatory: true },
          { name: "unit_of_measure", type: "String", length: 50, mandatory: true },
          { name: "unit_value", type: "Decimal", mandatory: true },
          { name: "total_stock_value", type: "Decimal", mandatory: true },
          { name: "currency_code", type: "String", length: 10, mandatory: true },
          { name: "stock_issue_reference", type: "String", length: 150 },
        ],
      }),
    });
    return "created";
  } catch (error) {
    if (isAlreadyExistsError(error)) return "exists";
    throw error;
  }
}

export async function upsertArdaStockDetails(input: {
  appTenantSlug: string;
  tenantSettings: unknown;
  fineractTenantId: string;
  fineractLoanId: number;
  details: ArdaStockDetails;
  request: FineractRequester;
}): Promise<"created" | "updated"> {
  assertArdaScope(input);
  if (!Number.isInteger(input.fineractLoanId) || input.fineractLoanId <= 0) {
    throw new Error("A positive Fineract loan ID is required.");
  }

  const endpoint = `/datatables/${ARDA_STOCK_DETAILS_TABLE}/${input.fineractLoanId}`;
  const existing = await input.request(endpoint, {
    method: "GET",
    authMode: "service",
    cache: "no-store",
  });
  const row = Array.isArray(existing) ? existing[0] : existing;
  const method = row && typeof row === "object" ? "PUT" : "POST";

  await input.request(endpoint, {
    method,
    authMode: "service",
    body: JSON.stringify(buildArdaStockDetailsPayload(input.details)),
  });

  return method === "POST" ? "created" : "updated";
}

export async function syncArdaStockDetailsForCurrentTenant(input: {
  appTenantSlug: string;
  tenantSettings: unknown;
  fineractLoanId: number;
  details: ArdaStockDetails;
}): Promise<"created" | "updated"> {
  const fineractTenantId = await getFineractTenantId();
  const request: FineractRequester = (endpoint, options = {}) =>
    fetchFineractAPI(endpoint, { ...options, authMode: "service" });

  return upsertArdaStockDetails({
    ...input,
    fineractTenantId,
    request,
  });
}
