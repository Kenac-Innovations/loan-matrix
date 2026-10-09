import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { refreshBulkRepaymentUploadStats } from "@/lib/bulk-repayment-upload-stats";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const itemIds: string[] | undefined = body.itemIds;

    const where: any = { uploadId: id, status: "FAILED" };
    if (itemIds && itemIds.length > 0) {
      where.id = { in: itemIds };
    }

    const failedCount = await prisma.bulkRepaymentItem.count({ where });

    if (failedCount === 0) {
      return NextResponse.json(
        { error: "No failed items to retry" },
        { status: 400 }
      );
    }

    // Ensure upload is in PROCESSING state
    await prisma.bulkRepaymentUpload.update({
      where: { id },
      data: { status: "PROCESSING" },
    });

    // Re-queue the failed items. loan-matrix-be's bulk repayment worker
    // polls for QUEUED items and posts them to Fineract.
    await prisma.bulkRepaymentItem.updateMany({
      where,
      data: { status: "QUEUED", errorMessage: null, processedAt: null },
    });

    await refreshBulkRepaymentUploadStats(id);

    return NextResponse.json({
      success: true,
      retried: failedCount,
      total: failedCount,
    });
  } catch (error) {
    console.error("Error retrying failed items:", error);
    return NextResponse.json(
      { error: "Failed to retry items" },
      { status: 500 }
    );
  }
}
