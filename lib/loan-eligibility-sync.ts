import prisma from "@/lib/prisma";

const BATCH_SIZE = 100;

function ussdBaseUrl() {
  return (process.env.USSD_BASE_URL ?? "").replace(/\/$/, "");
}

function syncApiKey() {
  return process.env.USSD_LOAN_PRODUCT_SYNC_API_KEY ?? "";
}

type SyncEntry = { name: string; nrc: string; phone: string };
type BatchEntryResult = { phone: string; success: boolean; errorMessage: string | null };
type BatchResponse = { batchNumber: number; results: BatchEntryResult[] };

async function pushBatch(params: {
  productExternalId: string;
  uploadId: string;
  batchNumber: number;
  isFirstBatch: boolean;
  entries: SyncEntry[];
}): Promise<BatchResponse> {
  const base = ussdBaseUrl();
  if (!base) throw new Error("USSD_LOAN_PRODUCTS_BASE_URL is not configured");

  const url = `${base}/api/v1/loan-products/external/${encodeURIComponent(params.productExternalId)}/whitelist/batch`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = syncApiKey();
  if (key) headers["X-Sync-Api-Key"] = key;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      uploadId: params.uploadId,
      batchNumber: params.batchNumber,
      firstBatch: params.isFirstBatch,
      entries: params.entries,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`USSD batch ${params.batchNumber} failed (${response.status}): ${text || response.statusText}`);
  }

  return response.json() as Promise<BatchResponse>;
}

export async function performEligibilitySync(uploadId: string): Promise<void> {
  const upload = await prisma.loanEligibilityUpload.findUnique({
    where: { id: uploadId },
    select: { id: true, productExternalId: true, syncedRows: true, status: true },
  });

  if (!upload || upload.status === "SYNCING") return;

  const isFirstSync = upload.syncedRows === 0;

  const items = await prisma.loanEligibilityUploadItem.findMany({
    where: { uploadId, status: { in: ["PENDING", "FAILED"] } },
    orderBy: { rowNumber: "asc" },
    select: { id: true, name: true, nrc: true, normalizedPhone: true },
  });

  if (items.length === 0) {
    // Nothing left to sync — recount and mark final status
    await finaliseCounts(uploadId);
    return;
  }

  await prisma.loanEligibilityUpload.update({
    where: { id: uploadId },
    data: { status: "SYNCING", syncError: null },
  });

  const chunks: typeof items[] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    chunks.push(items.slice(i, i + BATCH_SIZE));
  }

  let lastError: string | null = null;

  for (let i = 0; i < chunks.length; i++) {
    const batch = chunks[i];
    const isFirstBatch = isFirstSync && i === 0;

    try {
      const result = await pushBatch({
        productExternalId: upload.productExternalId,
        uploadId,
        batchNumber: i + 1,
        isFirstBatch,
        entries: batch.map((item) => ({ name: item.name, nrc: item.nrc, phone: item.normalizedPhone })),
      });

      const resultMap = new Map(result.results.map((r) => [r.phone, r]));

      await Promise.all(
        batch.map((item) => {
          const r = resultMap.get(item.normalizedPhone);
          const success = r?.success ?? false;
          return prisma.loanEligibilityUploadItem.update({
            where: { id: item.id },
            data: {
              status: success ? "SYNCED" : "FAILED",
              errorMessage: success ? null : (r?.errorMessage ?? "No result returned"),
            },
          });
        })
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Sync failed";
      lastError = message;

      await prisma.loanEligibilityUploadItem.updateMany({
        where: { id: { in: batch.map((item) => item.id) } },
        data: { status: "FAILED", errorMessage: message },
      });
    }

    // Update live counts after each batch so UI polling sees progress
    await updateLiveCounts(uploadId);
  }

  await finaliseCounts(uploadId, lastError);
}

async function updateLiveCounts(uploadId: string) {
  const [syncedRows, failedRows] = await Promise.all([
    prisma.loanEligibilityUploadItem.count({ where: { uploadId, status: "SYNCED" } }),
    prisma.loanEligibilityUploadItem.count({ where: { uploadId, status: "FAILED" } }),
  ]);
  await prisma.loanEligibilityUpload.update({
    where: { id: uploadId },
    data: { syncedRows, failedRows },
  });
}

async function finaliseCounts(uploadId: string, lastError: string | null = null) {
  const [syncedRows, failedRows] = await Promise.all([
    prisma.loanEligibilityUploadItem.count({ where: { uploadId, status: "SYNCED" } }),
    prisma.loanEligibilityUploadItem.count({ where: { uploadId, status: "FAILED" } }),
  ]);

  let status: string;
  if (failedRows === 0) {
    status = "SYNCED";
  } else if (syncedRows === 0) {
    status = "FAILED";
  } else {
    status = "PARTIAL";
  }

  await prisma.loanEligibilityUpload.update({
    where: { id: uploadId },
    data: { status, syncedRows, failedRows, syncError: lastError },
  });
}
