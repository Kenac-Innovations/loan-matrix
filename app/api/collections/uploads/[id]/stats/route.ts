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
        totalAmount: true,
      },
    });

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    const statusCounts = await prisma.bulkRepaymentItem.groupBy({
      by: ["status"],
      where: { uploadId: id },
      _count: { status: true },
    });

    const countMap: Record<string, number> = {};
    statusCounts.forEach((s) => {
      countMap[s.status] = s._count.status;
    });

    return NextResponse.json({
      ...upload,
      totalAmount: upload.totalAmount.toString(),
      stagedCount: countMap["STAGED"] || 0,
      queuedCount: countMap["QUEUED"] || 0,
      processingCount: countMap["PROCESSING"] || 0,
      successCount: countMap["SUCCESS"] || 0,
      failedCount: countMap["FAILED"] || 0,
    });
  } catch (error) {
    console.error("Error fetching upload stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
