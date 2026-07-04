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
  paymentProviderReference: string | null;
  paymentStatus: string | null;
  paymentConfirmedAt: Date | null;
  actedByName: string | null;
  errorMessage: string | null;
  createdAt: Date;
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

function toAuditItem(log: AuditLogWithUpload) {
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
    paymentProviderReference: log.paymentProviderReference,
    paymentStatus: log.paymentStatus,
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
