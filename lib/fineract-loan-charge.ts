import { fetchFineractAPI } from "./api";

export interface FineractLoanChargeRequest {
  dateFormat?: string;
  locale?: string;
  transactionDate?: string;
  chargeId?: number;
  dueDate?: string;
  installmentNumber?: number;
  amount?: number;
  externalId?: string;
  note?: string;
  paymentTypeId?: number | string;
  accountNumber?: string;
  checkNumber?: string;
  routingCode?: string;
  receiptNumber?: string;
  bankNumber?: string;
}

interface FineractCommandResult {
  resourceId?: unknown;
  entityId?: unknown;
  id?: unknown;
}

export interface CreateLoanChargeResult {
  createResponse: unknown;
  loanChargeId: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function extractLoanChargeId(payload: unknown): number | null {
  if (!isRecord(payload)) return null;

  const result = payload as FineractCommandResult;
  return (
    toNumber(result.resourceId) ??
    toNumber(result.entityId) ??
    toNumber(result.id)
  );
}

export async function createLoanCharge(
  loanId: number,
  payload: FineractLoanChargeRequest
): Promise<CreateLoanChargeResult> {
  const createResponse = await fetchFineractAPI(`/loans/${loanId}/charges`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const loanChargeId = extractLoanChargeId(createResponse);
  if (loanChargeId == null || loanChargeId <= 0) {
    throw new Error(
      "Loan charge was created but Fineract did not return a loan charge id"
    );
  }

  return {
    createResponse,
    loanChargeId,
  };
}
