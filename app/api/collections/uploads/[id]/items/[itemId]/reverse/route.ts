import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { undoLoanRepaymentTransaction } from "@/lib/bulk-repayment-reverse";

/**
 * POST — Undo the Fineract repayment for one bulk item (must be SUCCESS with fineractTxnId).
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

    const txnDate =
      item.transactionDate ?? item.processedAt ?? new Date();

    try {
      await undoLoanRepaymentTransaction({
        loanId: item.loanId,
        fineractTransactionId: item.fineractTxnId.trim(),
        transactionDate: txnDate,
      });
    } catch (err: any) {
      const msg =
        err?.errorData?.defaultUserMessage ||
        err?.errorData?.errors?.[0]?.defaultUserMessage ||
        err?.message ||
        "Fineract undo failed";
      console.error("[BulkRepayment] Reverse item failed:", err);
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    await prisma.bulkRepaymentItem.update({
      where: { id: itemId },
      data: {
        status: "REVERSED",
        reversedAt: new Date(),
        reversedBy: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      itemId,
      status: "REVERSED",
    });
  } catch (error) {
    console.error("Reverse bulk item error:", error);
    return NextResponse.json(
      { error: "Failed to reverse item" },
      { status: 500 }
    );
  }
}
