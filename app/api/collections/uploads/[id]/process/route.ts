import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getBulkRepaymentQueueService } from "@/lib/bulk-repayment-queue-service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const upload = await prisma.bulkRepaymentUpload.findUnique({
      where: { id },
    });

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    if (upload.status !== "STAGING") {
      return NextResponse.json(
        { error: `Upload is already ${upload.status}` },
        { status: 400 }
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: upload.tenantId },
      select: { slug: true },
    });
    const tenantSlug = tenant?.slug || "goodfellow";

    const stagedItems = await prisma.bulkRepaymentItem.findMany({
      where: { uploadId: id, status: "STAGED" },
      orderBy: { rowNumber: "asc" },
    });

    if (stagedItems.length === 0) {
      return NextResponse.json(
        { error: "No staged items to process" },
        { status: 400 }
      );
    }

    // Update upload status
    await prisma.bulkRepaymentUpload.update({
      where: { id },
      data: {
        status: "PROCESSING",
        queuedCount: stagedItems.length,
      },
    });

    // Update all items to QUEUED
    await prisma.bulkRepaymentItem.updateMany({
      where: { uploadId: id, status: "STAGED" },
      data: { status: "QUEUED" },
    });

    // Publish each item to RabbitMQ
    const queueService = getBulkRepaymentQueueService();

    let publishedCount = 0;
    for (const item of stagedItems) {
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
          note: item.note || "Bulk repayment",
          locale: "en",
          dateFormat: "yyyy-MM-dd",
        });
        publishedCount++;
      } catch (err) {
        console.error(`Failed to queue item ${item.id}:`, err);
        // Mark this specific item as failed
        await prisma.bulkRepaymentItem.update({
          where: { id: item.id },
          data: {
            status: "FAILED",
            errorMessage: "Failed to queue for processing",
            processedAt: new Date(),
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      queued: publishedCount,
      total: stagedItems.length,
    });
  } catch (error) {
    console.error("Error processing upload:", error);
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 }
    );
  }
}
