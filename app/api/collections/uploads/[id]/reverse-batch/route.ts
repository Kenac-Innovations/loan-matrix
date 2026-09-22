import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { refreshBulkRepaymentUploadStats } from "@/lib/bulk-repayment-upload-stats";

/**
 * POST — Queue many bulk repayments for reversal in LIFO order.
 *
 * Body: { itemIds?: string[] } — if omitted, all eligible SUCCESS items are queued (LIFO).
 *
 * loan-matrix-be's bulk repayment reversal worker polls for reversalStatus
 * QUEUED items and posts the undo to Fineract.
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

    const queued: string[] = [];
    const failed: { itemId: string; loanId: number; error: string }[] = [];

    for (const item of items) {
      const tid = item.fineractTxnId?.trim();
      if (!tid) continue;

      try {
        await prisma.bulkRepaymentItem.update({
          where: { id: item.id },
          data: {
            reversalStatus: "QUEUED",
            reversalErrorMessage: null,
            reversedBy: session.user.id,
          },
        });

        queued.push(item.id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to queue undo";
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
