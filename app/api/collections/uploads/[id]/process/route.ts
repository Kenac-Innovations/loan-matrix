import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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

    const stagedCount = await prisma.bulkRepaymentItem.count({
      where: { uploadId: id, status: "STAGED" },
    });

    if (stagedCount === 0) {
      return NextResponse.json(
        { error: "No staged items to process" },
        { status: 400 }
      );
    }

    // Mark the upload and its staged items QUEUED. loan-matrix-be's bulk
    // repayment worker polls for QUEUED items and posts them to Fineract.
    await prisma.bulkRepaymentUpload.update({
      where: { id },
      data: {
        status: "PROCESSING",
        queuedCount: stagedCount,
      },
    });

    await prisma.bulkRepaymentItem.updateMany({
      where: { uploadId: id, status: "STAGED" },
      data: { status: "QUEUED" },
    });

    return NextResponse.json({
      success: true,
      queued: stagedCount,
      total: stagedCount,
    });
  } catch (error) {
    console.error("Error processing upload:", error);
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 }
    );
  }
}
