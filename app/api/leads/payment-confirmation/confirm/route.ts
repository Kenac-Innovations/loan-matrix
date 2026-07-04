import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma";
import prisma from "@/lib/prisma";
import { requirePaymentConfirmationAccess } from "@/lib/payment-confirmation-access";
import { confirmPayments } from "@/lib/payment-service";

function normalizeReferences(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  return Array.from(
    new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))
  );
}

function parseConfirmedAt(value: unknown): Date {
  if (!value) return new Date();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export async function POST(request: NextRequest) {
  try {
    const access = await requirePaymentConfirmationAccess();
    if (!access.ok) return access.response;

    const body = await request.json();
    const uploadId = String(body?.uploadId || "").trim();
    const paymentReferences = normalizeReferences(body?.paymentReferences);

    if (!uploadId) {
      return NextResponse.json({ error: "uploadId is required" }, { status: 400 });
    }

    if (paymentReferences.length === 0) {
      return NextResponse.json(
        { error: "At least one payment reference is required" },
        { status: 400 }
      );
    }

    const upload = await prisma.paymentConfirmationUpload.findFirst({
      where: { id: uploadId, tenantId: access.tenant.id },
      select: { id: true },
    });

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    const confirmationResult = await confirmPayments(
      access.tenant.slug,
      paymentReferences
    );
    const confirmedSet = new Set(
      confirmationResult.confirmedPaymentReferences.map((ref) => ref.trim())
    );
    const confirmedAt = parseConfirmedAt(confirmationResult.confirmedAt);

    const lookupLogs = await prisma.paymentConfirmationActionLog.findMany({
      where: {
        tenantId: access.tenant.id,
        uploadId,
        action: "LOOKUP",
        paymentReference: { in: paymentReferences },
      },
      orderBy: [{ rowNumber: "asc" }, { createdAt: "asc" }],
    });
    const lookupByReference = new Map(
      lookupLogs.map((log) => [log.paymentReference, log])
    );

    await prisma.paymentConfirmationActionLog.createMany({
      data: paymentReferences.map((paymentReference) => {
        const lookupLog = lookupByReference.get(paymentReference);
        const confirmed = confirmedSet.has(paymentReference);

        return {
          tenantId: access.tenant.id,
          uploadId,
          rowNumber: lookupLog?.rowNumber ?? null,
          paymentReference,
          matched: Boolean(lookupLog?.matched),
          action: "CONFIRM_PAYMENT",
          actionStatus: confirmed ? "SUCCESS" : "FAILED",
          leadId: lookupLog?.leadId ?? null,
          fineractLoanId: lookupLog?.fineractLoanId ?? null,
          fineractClientId: lookupLog?.fineractClientId ?? null,
          loanAccountNo: lookupLog?.loanAccountNo ?? null,
          clientName: lookupLog?.clientName ?? null,
          paymentInternalReference:
            lookupLog?.paymentInternalReference ?? paymentReference,
          paymentUserReference: lookupLog?.paymentUserReference ?? null,
          paymentProviderReference: lookupLog?.paymentProviderReference ?? null,
          paymentStatus: lookupLog?.paymentStatus ?? null,
          paymentCallbackStatus: lookupLog?.paymentCallbackStatus ?? null,
          paymentConfirmed: confirmed,
          paymentConfirmedAt: confirmed ? confirmedAt : null,
          actedById: access.actorId,
          actedByName: access.actorName,
          errorMessage: confirmed
            ? null
            : "Payment service did not confirm this reference",
          requestPayload: { paymentReferences },
          responsePayload: {
            confirmation: confirmationResult.raw,
            payment: lookupLog?.responsePayload ?? null,
          } as Prisma.InputJsonValue,
        };
      }),
    });

    const confirmedReferences = paymentReferences.filter((reference) =>
      confirmedSet.has(reference)
    );
    const failedReferences = paymentReferences.filter(
      (reference) => !confirmedSet.has(reference)
    );

    if (confirmedReferences.length > 0) {
      await prisma.paymentConfirmationActionLog.updateMany({
        where: {
          tenantId: access.tenant.id,
          uploadId,
          action: "LOOKUP",
          paymentReference: { in: confirmedReferences },
        },
        data: {
          actionStatus: "CONFIRMED",
          paymentConfirmed: true,
          paymentConfirmedAt: confirmedAt,
        },
      });
    }

    await prisma.paymentConfirmationUpload.update({
      where: { id: uploadId },
      data: {
        confirmedCount: { increment: confirmedReferences.length },
        failedCount: { increment: failedReferences.length },
        status: failedReferences.length > 0 ? "PARTIAL" : "COMPLETED",
      },
    });

    return NextResponse.json({
      confirmedPaymentReferences: confirmedReferences,
      failedPaymentReferences: failedReferences,
      confirmedAt,
    });
  } catch (error) {
    console.error("Payment confirmation failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to confirm payments",
      },
      { status: 500 }
    );
  }
}
