import prisma from "./prisma";

type ItemSnapshot = {
  status: string;
  reversalStatus: string | null;
};

function isReversalActive(item: ItemSnapshot) {
  return (
    item.status === "SUCCESS" &&
    (item.reversalStatus === "QUEUED" || item.reversalStatus === "PROCESSING")
  );
}

export async function updateBulkRepaymentUploadCounters(
  uploadId: string
): Promise<void> {
  try {
    const [upload, items] = await Promise.all([
      prisma.bulkRepaymentUpload.findUnique({
        where: { id: uploadId },
        select: { totalRows: true },
      }),
      prisma.bulkRepaymentItem.findMany({
        where: { uploadId },
        select: { status: true, reversalStatus: true },
      }),
    ]);

    if (!upload) return;

    const stagedCount = items.filter((item) => item.status === "STAGED").length;
    const originalQueuedCount = items.filter(
      (item) => item.status === "QUEUED" || item.status === "PROCESSING"
    ).length;
    const reversalQueuedCount = items.filter(isReversalActive).length;
    const successCount = items.filter(
      (item) => item.status === "SUCCESS" && !isReversalActive(item)
    ).length;
    const failedCount = items.filter((item) => item.status === "FAILED").length;
    const reversedCount = items.filter((item) => item.status === "REVERSED").length;
    const queuedCount = originalQueuedCount + reversalQueuedCount;

    const status =
      stagedCount > 0
        ? "STAGING"
        : queuedCount > 0
          ? "PROCESSING"
          : "COMPLETED";

    await prisma.bulkRepaymentUpload.update({
      where: { id: uploadId },
      data: {
        queuedCount,
        successCount,
        failedCount,
        reversedCount,
        status,
      },
    });
  } catch (error) {
    console.error("[BulkRepayment] Failed to update upload counters:", error);
  }
}
