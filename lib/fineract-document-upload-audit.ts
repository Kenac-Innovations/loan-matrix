import { prisma } from "@/lib/prisma";

export type RecordFineractDocumentUploadInput = {
  tenantId: string | null | undefined;
  entityType: string;
  entityId: number;
  documentId: number;
  fineractUserId: number | null | undefined;
  username: string | null | undefined;
  documentSavedAt?: Date;
};

export type FineractDocumentUploadRecord = {
  documentId: number;
  username: string;
  documentSavedAt: Date;
};

/**
 * Persist a Loan Matrix audit record for a document upload that was saved in Fineract.
 * This stays intentionally small and reusable so it can be called from any Fineract
 * document-save route.
 */
export async function recordFineractDocumentUpload(
  input: RecordFineractDocumentUploadInput
) {
  const {
    tenantId,
    entityType,
    entityId,
    documentId,
    fineractUserId,
    username,
    documentSavedAt = new Date(),
  } = input;
  const resolvedFineractUserId = Number(fineractUserId);

  if (
    !tenantId ||
    !entityType ||
    !Number.isFinite(entityId) ||
    !Number.isFinite(documentId) ||
    !Number.isFinite(resolvedFineractUserId) ||
    !username?.trim()
  ) {
    return null;
  }

  return prisma.fineractDocumentUpload.upsert({
    where: {
      tenantId_documentId: {
        tenantId,
        documentId,
      },
    },
    create: {
      tenantId,
      entityType,
      entityId,
      documentId,
      fineractUserId: resolvedFineractUserId,
      username: username.trim(),
      documentSavedAt,
    },
    update: {
      entityType,
      entityId,
      fineractUserId: resolvedFineractUserId,
      username: username.trim(),
      documentSavedAt,
    },
  });
}

/**
 * Fetch document upload audit records for a tenant/entity pair.
 */
export async function getFineractDocumentUploadRecords(
  tenantId: string,
  entityType: string,
  entityId: number
): Promise<FineractDocumentUploadRecord[]> {
  try {
    return await prisma.fineractDocumentUpload.findMany({
      where: {
        tenantId,
        entityType,
        entityId,
      },
      select: {
        documentId: true,
        username: true,
        documentSavedAt: true,
      },
      orderBy: {
        documentSavedAt: "desc",
      },
    });
  } catch (error) {
    console.warn(
      "Failed to load Fineract document upload audit records; continuing without enrichment:",
      error
    );
    return [];
  }
}
