import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { refreshBulkRepaymentUploadStats } from "@/lib/bulk-repayment-upload-stats";

/**
 * POST — Queue a Fineract repayment undo for one bulk item.
 *
 * loan-matrix-be's bulk repayment reversal worker polls for reversalStatus
 * QUEUED items and posts the undo to Fineract.
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
          reversedBy: session.user.id,
        },
      });

      await refreshBulkRepaymentUploadStats(uploadId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to queue undo";
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
