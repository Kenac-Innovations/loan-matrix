import prisma from "./prisma";

export async function refreshBulkRepaymentUploadStats(uploadId: string): Promise<void> {
  const [statusCounts, reversalCounts, upload] = await Promise.all([
    prisma.bulkRepaymentItem.groupBy({
      by: ["status"],
      where: { uploadId },
      _count: { status: true },
    }),
    prisma.bulkRepaymentItem.groupBy({
      by: ["reversalStatus"],
      where: {
        uploadId,
        NOT: { reversalStatus: null },
      },
      _count: { reversalStatus: true },
    }),
    prisma.bulkRepaymentUpload.findUnique({
      where: { id: uploadId },
      select: { totalRows: true, status: true },
    }),
  ]);

  if (!upload) return;

  const statusMap: Record<string, number> = {};
  statusCounts.forEach((entry) => {
    statusMap[entry.status] = entry._count.status;
  });

  const reversalMap: Record<string, number> = {};
  reversalCounts.forEach((entry) => {
    if (entry.reversalStatus) {
      reversalMap[entry.reversalStatus] = entry._count.reversalStatus;
    }
  });

  const successCount = statusMap["SUCCESS"] || 0;
  const failedCount = statusMap["FAILED"] || 0;
  const queuedCount = (statusMap["QUEUED"] || 0) + (statusMap["PROCESSING"] || 0);
  const reversedCount = reversalMap["REVERSED"] || 0;
  const totalProcessed = successCount + failedCount;
  const nextStatus =
    upload.status === "STAGING"
      ? "STAGING"
      : totalProcessed >= upload.totalRows
        ? "COMPLETED"
        : "PROCESSING";

  await prisma.bulkRepaymentUpload.update({
    where: { id: uploadId },
    data: {
      successCount,
      failedCount,
      queuedCount,
      reversedCount,
      status: nextStatus,
    },
  });
}
