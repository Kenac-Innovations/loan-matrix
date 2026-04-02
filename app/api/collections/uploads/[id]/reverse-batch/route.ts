import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { undoLoanRepaymentTransaction } from "@/lib/bulk-repayment-reverse";

/**
 * POST — Reverse many bulk repayments in LIFO order (last posted in Fineract terms: highest processedAt first).
 * Fineract usually requires undoing the loan’s latest transaction first; processing order ≈ queue order,
 * so reversing newest-first minimizes "not the last transaction" failures.
 *
 * Body: { itemIds?: string[] } — if omitted, all SUCCESS items for the upload are reversed (LIFO).
 *
 * Each row is attempted independently: a Fineract failure on one item does not skip the rest.
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
          ...(itemIds?.length ? [{ id: { in: itemIds } }] : []),
        ],
      },
      orderBy: [{ processedAt: "desc" }, { rowNumber: "desc" }],
    });

    if (items.length === 0) {
      return NextResponse.json({
        reversed: [],
        message: "No eligible SUCCESS items with Fineract transaction ids",
      });
    }

    const reversed: string[] = [];
    const failed: { itemId: string; loanId: number; error: string }[] = [];

    for (const item of items) {
      const tid = item.fineractTxnId?.trim();
      if (!tid) continue;

      const txnDate =
        item.transactionDate ?? item.processedAt ?? new Date();

      try {
        await undoLoanRepaymentTransaction({
          loanId: item.loanId,
          fineractTransactionId: tid,
          transactionDate: txnDate,
        });

        await prisma.bulkRepaymentItem.update({
          where: { id: item.id },
          data: {
            status: "REVERSED",
            reversedAt: new Date(),
            reversedBy: session.user.id,
          },
        });
        reversed.push(item.id);
      } catch (err: any) {
        const msg =
          err?.errorData?.defaultUserMessage ||
          err?.errorData?.errors?.[0]?.defaultUserMessage ||
          err?.message ||
          "Fineract undo failed";
        console.error(`[BulkRepayment] Batch reverse item ${item.id} failed (continuing):`, err);
        failed.push({ itemId: item.id, loanId: item.loanId, error: msg });
      }
    }

    return NextResponse.json({
      reversed,
      failed,
      totalRequested: items.length,
      reversedCount: reversed.length,
      failedCount: failed.length,
    });
  } catch (error) {
    console.error("Reverse batch error:", error);
    return NextResponse.json(
      { error: "Failed to reverse batch" },
      { status: 500 }
    );
  }
}
