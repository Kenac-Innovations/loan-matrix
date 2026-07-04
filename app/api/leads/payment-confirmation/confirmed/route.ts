import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePaymentConfirmationAccess } from "@/lib/payment-confirmation-access";

type AuditLogWithUpload = {
  id: string;
  uploadId: string | null;
  rowNumber: number | null;
  paymentReference: string;
  action: string;
  actionStatus: string;
  fineractLoanId: number | null;
  fineractClientId: number | null;
  loanAccountNo: string | null;
  clientName: string | null;
  paymentInternalReference: string | null;
  paymentUserReference: string | null;
  paymentProviderReference: string | null;
  paymentStatus: string | null;
  paymentConfirmedAt: Date | null;
  actedByName: string | null;
  errorMessage: string | null;
  createdAt: Date;
  responsePayload: unknown;
  upload: {
    id: string;
    fileName: string;
    createdAt: Date;
  } | null;
};

function parsePageParam(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getPaymentSnapshot(payload: unknown): Record<string, unknown> | null {
  const root = asRecord(payload);
  if (!root) return null;
  return asRecord(root.payment) || root;
}

function getStringField(
  record: Record<string, unknown> | null,
  keys: string[]
): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && value !== "") {
      return String(value);
    }
  }
  return null;
}

function toAuditItem(log: AuditLogWithUpload) {
  const paymentSnapshot = getPaymentSnapshot(log.responsePayload);

  return {
    id: log.id,
    uploadId: log.uploadId,
    rowNumber: log.rowNumber,
    paymentReference: log.paymentReference,
    action: log.action,
    actionStatus: log.actionStatus,
    fineractLoanId: log.fineractLoanId,
    fineractClientId: log.fineractClientId,
    loanAccountNo: log.loanAccountNo,
    clientName: log.clientName,
    phoneNumber: getStringField(paymentSnapshot, ["phoneNumber"]),
    amount: paymentSnapshot?.amount ?? null,
    currency: getStringField(paymentSnapshot, ["currency"]),
    paymentInternalReference:
      log.paymentInternalReference ||
      getStringField(paymentSnapshot, ["internalReferenceNumber"]) ||
      log.paymentReference,
    paymentUserReference:
      log.paymentUserReference ||
      getStringField(paymentSnapshot, ["userReferenceNumber"]),
    paymentProviderReference: log.paymentProviderReference,
    paymentStatus:
      log.paymentStatus || getStringField(paymentSnapshot, ["status"]),
    paymentConfirmedAt: log.paymentConfirmedAt,
    actedByName: log.actedByName,
    errorMessage: log.errorMessage,
    createdAt: log.createdAt,
    upload: log.upload
      ? {
          id: log.upload.id,
          fileName: log.upload.fileName,
          createdAt: log.upload.createdAt,
        }
      : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const access = await requirePaymentConfirmationAccess();
    if (!access.ok) return access.response;

    const searchParams = request.nextUrl.searchParams;
    const page = parsePageParam(searchParams.get("page"), 1);
    const pageSize = Math.min(parsePageParam(searchParams.get("pageSize"), 20), 100);
    const skip = (page - 1) * pageSize;

    const where = {
      tenantId: access.tenant.id,
      action: "CONFIRM_PAYMENT",
      actionStatus: "SUCCESS",
    };

    const [items, total] = await Promise.all([
      prisma.paymentConfirmationActionLog.findMany({
        where,
        include: {
          upload: {
            select: { id: true, fileName: true, createdAt: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.paymentConfirmationActionLog.count({ where }),
    ]);

    return NextResponse.json({
      items: items.map(toAuditItem),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    console.error("Failed to fetch confirmed payments:", error);
    return NextResponse.json(
      { error: "Failed to fetch confirmed payments" },
      { status: 500 }
    );
  }
}
