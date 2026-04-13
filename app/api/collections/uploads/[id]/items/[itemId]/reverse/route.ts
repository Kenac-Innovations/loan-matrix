import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getBulkRepaymentReversalQueueService } from "@/lib/bulk-repayment-reversal-queue-service";
import { updateBulkRepaymentUploadCounters } from "@/lib/bulk-repayment-upload-stats";

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
      include: {
        upload: {
          select: {
            tenantId: true,
            tenant: {
              select: {
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (item.upload.tenantId !== tenant.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (item.status !== "SUCCESS") {
      return NextResponse.json(
        { error: `Only successful items can be undone (current status: ${item.status})` },
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
        { error: "Undo is already queued for this item" },
        { status: 409 }
      );
    }

    const updateResult = await prisma.bulkRepaymentItem.updateMany({
      where: {
        id: item.id,
        status: "SUCCESS",
        OR: [
          { reversalStatus: null },
          { reversalStatus: "FAILED" },
        ],
      },
      data: {
        reversalStatus: "QUEUED",
        reversalErrorMessage: null,
      },
    });

    if (updateResult.count === 0) {
      return NextResponse.json(
        { error: "Item is no longer eligible for undo" },
        { status: 409 }
      );
    }

    const queueService = getBulkRepaymentReversalQueueService();
    const transactionDate = item.transactionDate ?? item.processedAt ?? new Date();

    try {
      await queueService.publishReversal({
        itemId: item.id,
        uploadId,
        tenantSlug: item.upload.tenant.slug,
        loanId: item.loanId,
        fineractTxnId: item.fineractTxnId.trim(),
        transactionDate: transactionDate.toISOString(),
        requestedBy: session.user.id,
      });
      await updateBulkRepaymentUploadCounters(uploadId);
    } catch (error) {
      await prisma.bulkRepaymentItem.update({
        where: { id: item.id },
        data: {
          reversalStatus: "FAILED",
          reversalErrorMessage: "Failed to queue undo request",
        },
      });
      await updateBulkRepaymentUploadCounters(uploadId);
      throw error;
    }

    return NextResponse.json({
      success: true,
      itemId,
      reversalStatus: "QUEUED",
    });
  } catch (error) {
    console.error("Reverse bulk item error:", error);
    return NextResponse.json(
      { error: "Failed to queue item undo" },
      { status: 500 }
    );
  }
}
