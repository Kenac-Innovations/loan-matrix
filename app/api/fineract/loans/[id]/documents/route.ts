import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";
import { getSession } from "@/lib/auth";
import {
  extractTenantSlugFromRequest,
  getTenantBySlug,
} from "@/lib/tenant-service";
import {
  getFineractDocumentUploadRecords,
  recordFineractDocumentUpload,
} from "@/lib/fineract-document-upload-audit";

type FineractDocumentWithUpload = {
  id: number;
  parentEntityType?: string;
  parentEntityId?: number | string;
  uploadedBy?: string;
  uploadedAt?: string;
  [key: string]: unknown;
};

function enrichDocuments(
  documents: FineractDocumentWithUpload[],
  uploadRecords: Map<number, { username: string; documentSavedAt: Date }>
) {
  return documents.map((document) => {
    const uploadRecord = uploadRecords.get(Number(document.id));

    if (!uploadRecord) {
      return document;
    }

    return {
      ...document,
      uploadedBy: uploadRecord.username,
      uploadedAt: uploadRecord.documentSavedAt.toISOString(),
    };
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loanId } = await params;
    const numericLoanId = Number(loanId);

    if (!Number.isFinite(numericLoanId)) {
      return NextResponse.json(
        { error: "Invalid loan ID" },
        { status: 400 }
      );
    }

    const tenantSlug = extractTenantSlugFromRequest(request);
    const tenant = await getTenantBySlug(tenantSlug);
    const uploadRecords = tenant
      ? await getFineractDocumentUploadRecords(tenant.id, "loans", numericLoanId)
      : [];
    const uploadRecordMap = new Map(
      uploadRecords.map((record) => [record.documentId, record])
    );

    const data = await fetchFineractAPI(`/loans/${loanId}/documents`);

    if (data && Array.isArray(data)) {
      return NextResponse.json(
        enrichDocuments(data as FineractDocumentWithUpload[], uploadRecordMap)
      );
    }

    if (data?.pageItems && Array.isArray(data.pageItems)) {
      data.pageItems = enrichDocuments(
        data.pageItems as FineractDocumentWithUpload[],
        uploadRecordMap
      );
    } else if (data?.content && Array.isArray(data.content)) {
      data.content = enrichDocuments(
        data.content as FineractDocumentWithUpload[],
        uploadRecordMap
      );
    } else if (data?.documents && Array.isArray(data.documents)) {
      data.documents = enrichDocuments(
        data.documents as FineractDocumentWithUpload[],
        uploadRecordMap
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching loan documents:", error);

    const fineractError = error as {
      status?: number;
      errorData?: unknown;
    };

    if (fineractError.status && fineractError.errorData) {
      return NextResponse.json(fineractError.errorData, {
        status: fineractError.status,
      });
    }

    const message = error instanceof Error ? error.message : "Failed to fetch loan documents";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loanId } = await params;
    const numericLoanId = Number(loanId);

    if (!Number.isFinite(numericLoanId)) {
      return NextResponse.json(
        { error: "Invalid loan ID" },
        { status: 400 }
      );
    }

    const session = await getSession();
    const tenantSlug = extractTenantSlugFromRequest(request);
    const tenant = await getTenantBySlug(tenantSlug);

    const formData = await request.formData();
    const fineractFormData = new FormData();

    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const file = formData.get("file") as File;

    if (!name || !file) {
      return NextResponse.json(
        { error: "Name and file are required" },
        { status: 400 }
      );
    }

    fineractFormData.append("name", name);
    fineractFormData.append("file", file);
    if (description) {
      fineractFormData.append("description", description);
    }

    const data = await fetchFineractAPI(`/loans/${loanId}/documents`, {
      method: "POST",
      body: fineractFormData,
    });

    const uploadedDocumentId = Number(
      data?.resourceId ?? data?.resourceIdentifier ?? data?.id
    );

    if (
      tenant?.id &&
      Number.isFinite(uploadedDocumentId) &&
      session?.user?.userId &&
      session.user.name
    ) {
      try {
        const auditRecord = await recordFineractDocumentUpload({
          tenantId: tenant.id,
          entityType: "loans",
          entityId: numericLoanId,
          documentId: uploadedDocumentId,
          fineractUserId: session.user.userId,
          username: session.user.name,
        });

        console.log("Fineract document upload audit saved", {
          tenantId: tenant.id,
          entityType: "loans",
          entityId: numericLoanId,
          documentId: uploadedDocumentId,
          fineractUserId: session.user.userId,
          username: session.user.name,
          documentSavedAt: auditRecord?.documentSavedAt?.toISOString?.(),
        });
      } catch (auditError) {
        console.error(
          "Document upload audit save failed, but Fineract upload succeeded:",
          auditError
        );
      }
    } else {
      console.warn(
        "Skipping document upload audit because tenant, document id, or session user data was unavailable",
        {
          tenantId: tenant?.id,
          loanId: numericLoanId,
          uploadedDocumentId,
          fineractUserId: session?.user?.userId,
          username: session?.user?.name,
        }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error uploading loan document:", error);

    const fineractError = error as {
      status?: number;
      errorData?: unknown;
    };

    if (fineractError.status && fineractError.errorData) {
      return NextResponse.json(fineractError.errorData, {
        status: fineractError.status,
      });
    }

    const message = error instanceof Error ? error.message : "Failed to upload loan document";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
