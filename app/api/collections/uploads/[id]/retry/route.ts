import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getBulkRepaymentQueueService } from "@/lib/bulk-repayment-queue-service";

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

    const failedItems = await prisma.bulkRepaymentItem.findMany({
      where,
      orderBy: { rowNumber: "asc" },
    });

    if (failedItems.length === 0) {
      return NextResponse.json(
        { error: "No failed items to retry" },
        { status: 400 }
      );
    }

    // Reset items to QUEUED
    await prisma.bulkRepaymentItem.updateMany({
      where: { id: { in: failedItems.map((i) => i.id) } },
      data: {
        status: "QUEUED",
        errorMessage: null,
        processedAt: null,
      },
    });

    // Ensure upload is in PROCESSING state
    const upload = await prisma.bulkRepaymentUpload.update({
      where: { id },
      data: { status: "PROCESSING" },
    });

    const tenant = await prisma.tenant.findUnique({
      where: { id: upload.tenantId },
      select: { slug: true },
    });
    const tenantSlug = tenant?.slug || "goodfellow";

    // Re-publish to queue
    const queueService = getBulkRepaymentQueueService();
    let publishedCount = 0;

    for (const item of failedItems) {
      try {
        await queueService.publishRepayment({
          itemId: item.id,
          uploadId: id,
          tenantSlug,
          loanId: item.loanId,
          amount: Number(item.amount),
          transactionDate: item.transactionDate
            ? item.transactionDate.toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
          paymentTypeId: item.paymentTypeId || undefined,
          accountNumber: item.accountNumber || undefined,
          chequeNumber: item.chequeNumber || undefined,
          routingCode: item.routingCode || undefined,
          receiptNumber: item.receiptNumber || undefined,
          bankNumber: item.bankNumber || undefined,
          note: item.note || "Bulk repayment (retry)",
          locale: "en",
          dateFormat: "yyyy-MM-dd",
        });
        publishedCount++;
      } catch (err) {
        console.error(`Failed to re-queue item ${item.id}:`, err);
        await prisma.bulkRepaymentItem.update({
          where: { id: item.id },
          data: {
            status: "FAILED",
            errorMessage: "Failed to re-queue for processing",
            processedAt: new Date(),
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      retried: publishedCount,
      total: failedItems.length,
    });
  } catch (error) {
    console.error("Error retrying failed items:", error);
    return NextResponse.json(
      { error: "Failed to retry items" },
      { status: 500 }
    );
  }
}
