import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { refreshBulkRepaymentUploadStats } from "@/lib/bulk-repayment-upload-stats";
import { getBulkRepaymentReversalQueueService } from "@/lib/bulk-repayment-reversal-queue-service";

function getQueueErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const apiError = error as {
      message?: string;
      errorData?: {
        defaultUserMessage?: string;
        errors?: Array<{ defaultUserMessage?: string }>;
      };
    };

    return (
      apiError.message ||
      "Failed to queue undo"
    );
  }

  return "Failed to queue undo";
}

/**
 * POST — Queue a Fineract repayment undo for one bulk item.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: uploadId, itemId } = await params;

    const item = await prisma.bulkRepaymentItem.findFirst({
      where: { id: itemId, uploadId },
      include: { upload: { select: { tenantId: true } } },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (item.upload.tenantId !== tenant.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (item.status !== "SUCCESS") {
      return NextResponse.json(
        {
          error: `Only successful items can be reversed (current status: ${item.status})`,
        },
        { status: 400 }
      );
    }

    if (!item.fineractTxnId?.trim()) {
      return NextResponse.json(
        { error: "Item has no Fineract transaction id to undo" },
        { status: 400 }
      );
    }

    if (item.reversalStatus === "QUEUED" || item.reversalStatus === "PROCESSING") {
      return NextResponse.json(
        { error: "Undo is already queued for this row" },
        { status: 409 }
      );
    }

    try {
      await prisma.bulkRepaymentItem.update({
        where: { id: itemId },
        data: {
          reversalStatus: "QUEUED",
          reversalErrorMessage: null,
        },
      });

      const queueService = getBulkRepaymentReversalQueueService();
      const txnDate = item.transactionDate ?? item.processedAt ?? new Date();

      await queueService.publishReversal({
        itemId,
        uploadId,
        tenantSlug: tenant.slug,
        loanId: item.loanId,
        fineractTransactionId: item.fineractTxnId.trim(),
        transactionDate: txnDate.toISOString(),
        amount: Number(item.amount),
        reversedBy: session.user.id,
      });

      await refreshBulkRepaymentUploadStats(uploadId);
    } catch (err: unknown) {
      const msg = getQueueErrorMessage(err);
      await prisma.bulkRepaymentItem.update({
        where: { id: itemId },
        data: {
          reversalStatus: "FAILED",
          reversalErrorMessage: msg,
        },
      });
      console.error("[BulkRepayment] Reverse item failed to queue:", err);
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      itemId,
      status: "QUEUED",
    });
  } catch (error) {
    console.error("Reverse bulk item error:", error);
    return NextResponse.json(
      { error: "Failed to queue undo" },
      { status: 500 }
    );
  }
}
