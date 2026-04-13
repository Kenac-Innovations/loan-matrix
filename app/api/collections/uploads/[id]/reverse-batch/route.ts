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
      "Failed to queue batch undo"
    );
  }

  return "Failed to queue batch undo";
}

/**
 * POST — Queue many bulk repayments for reversal in LIFO order.
 *
 * Body: { itemIds?: string[] } — if omitted, all eligible SUCCESS items are queued (LIFO).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: uploadId } = await params;
    const body = await request.json().catch(() => ({}));
    const itemIds: string[] | undefined = Array.isArray(body.itemIds)
      ? body.itemIds.filter((x: unknown) => typeof x === "string")
      : undefined;

    const upload = await prisma.bulkRepaymentUpload.findFirst({
      where: { id: uploadId, tenantId: tenant.id },
    });

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    const items = await prisma.bulkRepaymentItem.findMany({
      where: {
        uploadId,
        status: "SUCCESS",
        AND: [
          { fineractTxnId: { not: null } },
          { NOT: { fineractTxnId: "" } },
          {
            OR: [
              { reversalStatus: null },
              { reversalStatus: "FAILED" },
            ],
          },
          ...(itemIds?.length ? [{ id: { in: itemIds } }] : []),
        ],
      },
      orderBy: [{ processedAt: "desc" }, { rowNumber: "desc" }],
    });

    if (items.length === 0) {
      return NextResponse.json({
        queued: [],
        message: "No eligible SUCCESS items available for undo",
      });
    }

    const queueService = getBulkRepaymentReversalQueueService();
    const queued: string[] = [];
    const failed: { itemId: string; loanId: number; error: string }[] = [];

    for (const item of items) {
      const tid = item.fineractTxnId?.trim();
      if (!tid) continue;

      const txnDate =
        item.transactionDate ?? item.processedAt ?? new Date();

      try {
        await prisma.bulkRepaymentItem.update({
          where: { id: item.id },
          data: {
            reversalStatus: "QUEUED",
            reversalErrorMessage: null,
          },
        });

        await queueService.publishReversal({
          itemId: item.id,
          uploadId,
          tenantSlug: tenant.slug,
          loanId: item.loanId,
          fineractTransactionId: tid,
          transactionDate: txnDate.toISOString(),
          amount: Number(item.amount),
          reversedBy: session.user.id,
        });

        queued.push(item.id);
      } catch (err: unknown) {
        const msg = getQueueErrorMessage(err);
        await prisma.bulkRepaymentItem.update({
          where: { id: item.id },
          data: {
            reversalStatus: "FAILED",
            reversalErrorMessage: msg,
          },
        });
        console.error(
          `[BulkRepayment] Batch reverse item ${item.id} failed to queue:`,
          err
        );
        failed.push({ itemId: item.id, loanId: item.loanId, error: msg });
      }
    }

    await refreshBulkRepaymentUploadStats(uploadId);

    return NextResponse.json({
      success: true,
      queued,
      failed,
      totalRequested: items.length,
      queuedCount: queued.length,
      failedCount: failed.length,
    });
  } catch (error) {
    console.error("Reverse batch error:", error);
    return NextResponse.json(
      { error: "Failed to queue batch undo" },
      { status: 500 }
    );
  }
}
