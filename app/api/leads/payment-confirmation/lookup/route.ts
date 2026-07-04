import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma";
import prisma from "@/lib/prisma";
import { requirePaymentConfirmationAccess } from "@/lib/payment-confirmation-access";
import {
  lookupPaymentsInBatches,
  PaymentLookupPayment,
} from "@/lib/payment-service";

type LookupRowInput = {
  rowNumber?: number;
  paymentReference?: string | null;
  fineractLoanId?: number | string | null;
  fineractClientId?: number | string | null;
  loanAccountNo?: string | null;
  clientName?: string | null;
  rawRow?: Record<string, string>;
};

type NormalizedLookupRow = {
  rowNumber: number;
  paymentReference: string;
  fineractLoanId: number | null;
  fineractClientId: number | null;
  loanAccountNo: string | null;
  clientName: string | null;
  rawRow?: Record<string, string>;
};

type PaymentConfirmationLookupLog = {
  id: string;
  uploadId: string | null;
  rowNumber: number | null;
  paymentReference: string;
  matched: boolean;
  actionStatus: string;
  fineractLoanId: number | null;
  fineractClientId: number | null;
  loanAccountNo: string | null;
  clientName: string | null;
  createdAt: Date;
  paymentInternalReference: string | null;
  paymentUserReference: string | null;
  paymentProviderReference: string | null;
  paymentStatus: string | null;
  paymentCallbackStatus: string | null;
  paymentConfirmed: boolean;
  paymentConfirmedAt: Date | null;
  rawRow: Prisma.JsonValue | null;
  responsePayload: Prisma.JsonValue | null;
};

function normalizeReference(value: unknown): string {
  return String(value ?? "").trim();
}

function parseOptionalInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalDate(value: unknown): Date | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getPaymentReference(payment: PaymentLookupPayment): string {
  return normalizeReference(
    payment.internalReferenceNumber ||
      payment.internal_reference_number ||
      payment.userReferenceNumber ||
      payment.user_reference_number
  );
}

function getProviderReference(payment: PaymentLookupPayment): string | null {
  return (
    normalizeReference(
      payment.providerReferenceNumber || payment.provider_reference_number
    ) || null
  );
}

function isConfirmable(payment: PaymentLookupPayment): boolean {
  return (
    Boolean(getProviderReference(payment)) &&
    String(payment.status || "").toUpperCase() === "COMPLETED" &&
    !payment.paymentConfirmed
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
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

function getPaymentSnapshot(payload: unknown): Record<string, unknown> | null {
  const root = asRecord(payload);
  if (!root) return null;
  return asRecord(root.payment) || root;
}

function toStringRecord(value: unknown): Record<string, string> | null {
  const record = asRecord(value);
  if (!record) return null;

  return Object.fromEntries(
    Object.entries(record).map(([key, fieldValue]) => [
      key,
      normalizeReference(fieldValue),
    ])
  );
}

function toPaymentPayload(payment: PaymentLookupPayment | null) {
  if (!payment) return null;

  return {
    id: payment.id ?? null,
    amount: payment.amount ?? null,
    currency: payment.currency ?? null,
    phoneNumber: payment.phoneNumber ?? null,
    userReferenceNumber: payment.userReferenceNumber ?? null,
    internalReferenceNumber: payment.internalReferenceNumber ?? null,
    providerReferenceNumber: payment.providerReferenceNumber ?? null,
    status: payment.status ?? null,
    callbackStatus: payment.callbackStatus ?? null,
    paymentConfirmed: Boolean(payment.paymentConfirmed),
    confirmedAt: payment.confirmedAt ?? null,
    createdAt: payment.createdAt ?? null,
    canConfirm: isConfirmable(payment),
  };
}

function toLookupItem(log: PaymentConfirmationLookupLog) {
  const paymentSnapshot = getPaymentSnapshot(log.responsePayload);

  return {
    id: log.id,
    uploadId: log.uploadId,
    rowNumber: log.rowNumber,
    paymentReference: log.paymentReference,
    matched: log.matched,
    actionStatus: log.actionStatus,
    fineractLoanId: log.fineractLoanId,
    fineractClientId: log.fineractClientId,
    loanAccountNo: log.loanAccountNo,
    clientName: log.clientName,
    createdAt: log.createdAt,
    rawRow: toStringRecord(log.rawRow),
    payment: log.matched
      ? {
          amount: paymentSnapshot?.amount ?? null,
          currency: getStringField(paymentSnapshot, ["currency"]),
          phoneNumber: getStringField(paymentSnapshot, ["phoneNumber"]),
          internalReferenceNumber:
            log.paymentInternalReference ||
            getStringField(paymentSnapshot, ["internalReferenceNumber"]),
          userReferenceNumber:
            log.paymentUserReference ||
            getStringField(paymentSnapshot, ["userReferenceNumber"]),
          providerReferenceNumber: log.paymentProviderReference,
          status: log.paymentStatus,
          callbackStatus: log.paymentCallbackStatus,
          paymentConfirmed: log.paymentConfirmed,
          confirmedAt: log.paymentConfirmedAt,
          canConfirm:
            Boolean(log.paymentProviderReference) &&
            String(log.paymentStatus || "").toUpperCase() === "COMPLETED" &&
            !log.paymentConfirmed,
        }
      : null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const access = await requirePaymentConfirmationAccess();
    if (!access.ok) return access.response;

    const body = await request.json();
    const { fileName, columnMapping, rows } = body as {
      fileName?: string;
      columnMapping?: Record<string, string>;
      rows?: LookupRowInput[];
    };

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No CSV rows provided" }, { status: 400 });
    }

    const normalizedRows: NormalizedLookupRow[] = rows
      .map((row, index) => {
        const paymentReference = normalizeReference(row.paymentReference);
        const explicitLoanId = parseOptionalInt(row.fineractLoanId);
        const referenceLoanId = parseOptionalInt(paymentReference);

        return {
          rowNumber: parseOptionalInt(row.rowNumber) ?? index + 1,
          paymentReference,
          fineractLoanId: explicitLoanId ?? referenceLoanId,
          fineractClientId: parseOptionalInt(row.fineractClientId),
          loanAccountNo: normalizeReference(row.loanAccountNo) || null,
          clientName: normalizeReference(row.clientName) || null,
          rawRow: row.rawRow,
        };
      })
      .filter((row) => row.paymentReference.length > 0);

    if (normalizedRows.length === 0) {
      return NextResponse.json(
        { error: "No payment references were found in the selected column" },
        { status: 400 }
      );
    }

    const paymentReferences = normalizedRows.map((row) => row.paymentReference);
    const lookupResult = await lookupPaymentsInBatches(
      access.tenant.slug,
      paymentReferences
    );

    const paymentByReference = new Map<string, PaymentLookupPayment>();
    for (const payment of lookupResult.items) {
      const reference = getPaymentReference(payment);
      if (reference) {
        paymentByReference.set(reference, payment);
      }
    }

    const loanIds = Array.from(
      new Set(
        normalizedRows
          .map((row) => row.fineractLoanId)
          .filter(
            (loanId): loanId is number =>
              typeof loanId === "number" && Number.isFinite(loanId)
          )
      )
    );
    const loanAccountNos = Array.from(
      new Set(
        normalizedRows
          .map((row) => row.loanAccountNo)
          .filter((accountNo): accountNo is string => Boolean(accountNo))
      )
    );
    const leadWhere: Prisma.LeadWhereInput[] = [];
    if (loanIds.length > 0) {
      leadWhere.push({ fineractLoanId: { in: loanIds } });
    }
    if (loanAccountNos.length > 0) {
      leadWhere.push({ fineractAccountNo: { in: loanAccountNos } });
    }

    const leads =
      leadWhere.length > 0
        ? await prisma.lead.findMany({
            where: {
              tenantId: access.tenant.id,
              OR: leadWhere,
            },
            select: {
              id: true,
              fineractLoanId: true,
              fineractClientId: true,
              fineractAccountNo: true,
              firstname: true,
              middlename: true,
              lastname: true,
              fullname: true,
            },
          })
        : [];

    const leadByLoanId = new Map(
      leads
        .filter((lead) => lead.fineractLoanId)
        .map((lead) => [lead.fineractLoanId as number, lead])
    );
    const leadByAccountNo = new Map(
      leads
        .filter((lead) => lead.fineractAccountNo)
        .map((lead) => [lead.fineractAccountNo as string, lead])
    );

    const upload = await prisma.paymentConfirmationUpload.create({
      data: {
        tenantId: access.tenant.id,
        fileName: fileName || "payment-confirmation.csv",
        uploadedById: access.actorId,
        uploadedByName: access.actorName,
        status: "LOOKED_UP",
        totalRows: normalizedRows.length,
        matchedCount: normalizedRows.filter((row) =>
          paymentByReference.has(row.paymentReference)
        ).length,
        unmatchedCount: normalizedRows.filter(
          (row) => !paymentByReference.has(row.paymentReference)
        ).length,
        columnMapping: columnMapping || undefined,
      },
    });

    await prisma.paymentConfirmationActionLog.createMany({
      data: normalizedRows.map((row) => {
        const payment = paymentByReference.get(row.paymentReference) || null;
        const lead =
          (row.fineractLoanId ? leadByLoanId.get(row.fineractLoanId) : null) ||
          (row.loanAccountNo ? leadByAccountNo.get(row.loanAccountNo) : null) ||
          null;
        const clientName =
          row.clientName ||
          lead?.fullname ||
          [lead?.firstname, lead?.middlename, lead?.lastname]
            .filter(Boolean)
            .join(" ") ||
          null;
        const paymentPayload = toPaymentPayload(payment);

        return {
          tenantId: access.tenant.id,
          uploadId: upload.id,
          rowNumber: row.rowNumber,
          paymentReference: row.paymentReference,
          matched: Boolean(payment),
          action: "LOOKUP",
          actionStatus: payment ? "MATCHED" : "UNMATCHED",
          leadId: lead?.id || null,
          fineractLoanId: row.fineractLoanId ?? lead?.fineractLoanId ?? null,
          fineractClientId:
            row.fineractClientId ?? lead?.fineractClientId ?? null,
          loanAccountNo: row.loanAccountNo ?? lead?.fineractAccountNo ?? null,
          clientName,
          paymentInternalReference: payment?.internalReferenceNumber ?? null,
          paymentUserReference: payment?.userReferenceNumber ?? null,
          paymentProviderReference: payment ? getProviderReference(payment) : null,
          paymentStatus: payment?.status ?? null,
          paymentCallbackStatus: payment?.callbackStatus ?? null,
          paymentConfirmed: Boolean(payment?.paymentConfirmed),
          paymentConfirmedAt: parseOptionalDate(payment?.confirmedAt),
          actedById: access.actorId,
          actedByName: access.actorName,
          rawRow: row.rawRow || undefined,
          requestPayload: { paymentReference: row.paymentReference },
          responsePayload: paymentPayload || undefined,
        };
      }),
    });

    const logs = await prisma.paymentConfirmationActionLog.findMany({
      where: { uploadId: upload.id, action: "LOOKUP" },
      orderBy: [{ rowNumber: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({
      upload,
      matched: logs.filter((log) => log.matched).map(toLookupItem),
      unmatched: logs.filter((log) => !log.matched).map(toLookupItem),
    });
  } catch (error) {
    console.error("Payment confirmation lookup failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to lookup payment references",
      },
      { status: 500 }
    );
  }
}
