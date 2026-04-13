import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getBulkRepaymentReversalQueueService } from "@/lib/bulk-repayment-reversal-queue-service";
import { updateBulkRepaymentUploadCounters } from "@/lib/bulk-repayment-upload-stats";

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
      ? body.itemIds.filter((value: unknown) => typeof value === "string")
      : undefined;

    const upload = await prisma.bulkRepaymentUpload.findFirst({
      where: { id: uploadId, tenantId: tenant.id },
      include: {
        tenant: {
          select: {
            slug: true,
          },
        },
      },
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
          {
            OR: [
              { reversalStatus: null },
              { reversalStatus: "FAILED" },
            ],
          },
          ...(itemIds?.length ? [{ id: { in: itemIds } }] : []),
        ],
      },
      orderBy: [{ processedAt: "desc" }, { rowNumber: "desc" }],
      select: {
        id: true,
        loanId: true,
        fineractTxnId: true,
        transactionDate: true,
        processedAt: true,
      },
    });

    if (items.length === 0) {
      return NextResponse.json({
        queued: [],
        queuedCount: 0,
        message: "No eligible success items with Fineract transaction ids",
      });
    }

    const queueService = getBulkRepaymentReversalQueueService();
    const queued: string[] = [];
    const failed: Array<{ itemId: string; error: string }> = [];

    for (const item of items) {
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
        failed.push({
          itemId: item.id,
          error: "Item is no longer eligible for undo",
        });
        continue;
      }

      try {
        await queueService.publishReversal({
          itemId: item.id,
          uploadId,
          tenantSlug: upload.tenant.slug,
          loanId: item.loanId,
          fineractTxnId: item.fineractTxnId!.trim(),
          transactionDate: (item.transactionDate ?? item.processedAt ?? new Date()).toISOString(),
          requestedBy: session.user.id,
        });
        queued.push(item.id);
      } catch {
        await prisma.bulkRepaymentItem.update({
          where: { id: item.id },
          data: {
            reversalStatus: "FAILED",
            reversalErrorMessage: "Failed to queue undo request",
          },
        });
        failed.push({
          itemId: item.id,
          error: "Failed to queue undo request",
        });
      }
    }

    await updateBulkRepaymentUploadCounters(uploadId);

    return NextResponse.json({
      queued,
      failed,
      totalRequested: items.length,
      queuedCount: queued.length,
    });
  } catch (error) {
    console.error("Reverse batch error:", error);
    return NextResponse.json(
      { error: "Failed to queue batch undo" },
      { status: 500 }
    );
  }
}
