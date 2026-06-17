import { NextResponse } from "next/server";
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

/**
 * GET /api/fineract/clients/[id]/documents
 * Gets documents for a specific client
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const clientId = Number(id);

    if (!Number.isFinite(clientId)) {
      return NextResponse.json(
        { error: "Invalid client ID" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const offset = searchParams.get("offset") || "0";
    const limit = searchParams.get("limit") || "20";
    const tenantSlug = extractTenantSlugFromRequest(request);
    const tenant = await getTenantBySlug(tenantSlug);
    const uploadRecords = tenant
      ? await getFineractDocumentUploadRecords(tenant.id, "clients", clientId)
      : [];
    const uploadRecordMap = new Map(
      uploadRecords.map((record) => [record.documentId, record])
    );

    // Try different possible Fineract endpoints for client documents
    let data;

    // First try the standard documents endpoint with client filter
    try {
      const endpoint = `/documents?entityType=clients&entityId=${clientId}&offset=${offset}&limit=${limit}`;
      data = await fetchFineractAPI(endpoint, { authMode: "service" });
    } catch (e) {
      console.log("First endpoint failed, trying alternative...", e);

      // Try alternative endpoint
      try {
        const endpoint = `/clients/${clientId}/documents?offset=${offset}&limit=${limit}`;
        data = await fetchFineractAPI(endpoint, { authMode: "service" });
      } catch (e2) {
        console.log("Second endpoint failed, trying documents endpoint...", e2);

        // Try the general documents endpoint
        try {
          const endpoint = `/documents?offset=${offset}&limit=${limit}`;
          data = await fetchFineractAPI(endpoint, { authMode: "service" });

          // Filter by client ID if we get all documents
          if (data && Array.isArray(data.pageItems)) {
            data.pageItems = data.pageItems.filter(
              (doc: {
                parentEntityType?: string;
                parentEntityId?: string | number;
              }) =>
                doc.parentEntityType === "clients" &&
                doc.parentEntityId == clientId
            );
          }
        } catch (e3) {
          throw e3;
        }
      }
    }

    if (data && Array.isArray(data)) {
      data = enrichDocuments(data as FineractDocumentWithUpload[], uploadRecordMap);
    } else if (data?.pageItems && Array.isArray(data.pageItems)) {
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
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching client documents:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fineract/clients/[id]/documents
 * Uploads a document for a client
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const clientId = Number(id);

    if (!Number.isFinite(clientId)) {
      return NextResponse.json(
        { error: "Invalid client ID" },
        { status: 400 }
      );
    }

    const session = await getSession();
    const tenantSlug = extractTenantSlugFromRequest(request);
    const tenant = await getTenantBySlug(tenantSlug);

    // Handle multipart form data for file upload
    const formData = await request.formData();

    // Create FormData for the Fineract API call
    const fineractFormData = new FormData();

    // Get the form fields
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const file = formData.get("file") as File;

    if (!name || !file) {
      return NextResponse.json(
        { error: "Name and file are required" },
        { status: 400 }
      );
    }

    // Add fields to FormData for Fineract API
    fineractFormData.append("name", name);
    fineractFormData.append("file", file);
    if (description) {
      fineractFormData.append("description", description);
    }

    // Use the existing fetchFineractAPI helper (now handles FormData correctly)
    const data = await fetchFineractAPI(`/clients/${clientId}/documents`, {
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
          entityType: "clients",
          entityId: clientId,
          documentId: uploadedDocumentId,
          fineractUserId: session.user.userId,
          username: session.user.name,
        });

        console.log("Fineract document upload audit saved", {
          tenantId: tenant.id,
          entityType: "clients",
          entityId: clientId,
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
          clientId,
          uploadedDocumentId,
          fineractUserId: session?.user?.userId,
          username: session?.user?.name,
        }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error uploading client document:", error);

    // If it's a Fineract API error with status code, preserve it
    const fineractError = error as {
      status?: number;
      errorData?: unknown;
    };

    if (fineractError.status && fineractError.errorData) {
      return NextResponse.json(fineractError.errorData, {
        status: fineractError.status,
      });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to upload document",
      },
      { status: 500 }
    );
  }
}
