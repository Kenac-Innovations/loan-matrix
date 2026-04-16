import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const upload = await prisma.bulkRepaymentUpload.findUnique({
      where: { id },
      select: {
        id: true,
        fileName: true,
        status: true,
        totalRows: true,
        queuedCount: true,
        successCount: true,
        failedCount: true,
        reversedCount: true,
        totalAmount: true,
      },
    });

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    const items = await prisma.bulkRepaymentItem.findMany({
      where: { uploadId: id },
      select: { status: true, reversalStatus: true },
    });

    const processingCount = items.filter(
      (item) =>
        item.status === "PROCESSING" ||
        (item.status === "SUCCESS" && item.reversalStatus === "PROCESSING")
    ).length;
    const queuedCount = items.filter(
      (item) =>
        item.status === "QUEUED" ||
        (item.status === "SUCCESS" && item.reversalStatus === "QUEUED") ||
        item.status === "PROCESSING" ||
        (item.status === "SUCCESS" && item.reversalStatus === "PROCESSING")
    ).length;

    return NextResponse.json({
      ...upload,
      totalAmount: upload.totalAmount.toString(),
      stagedCount: items.filter((item) => item.status === "STAGED").length,
      queuedCount,
      processingCount,
      successCount: upload.successCount,
      failedCount: upload.failedCount,
      reversedCount: upload.reversedCount,
    });
  } catch (error) {
    console.error("Error fetching upload stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
