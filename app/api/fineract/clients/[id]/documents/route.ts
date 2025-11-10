import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

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
    const { searchParams } = new URL(request.url);
    const offset = searchParams.get("offset") || "0";
    const limit = searchParams.get("limit") || "20";

    // Try different possible Fineract endpoints for client documents
    let data;
    let error;

    // First try the standard documents endpoint with client filter
    try {
      const endpoint = `/documents?entityType=clients&entityId=${id}&offset=${offset}&limit=${limit}`;
      data = await fetchFineractAPI(endpoint);
    } catch (e: any) {
      error = e;
      console.log("First endpoint failed, trying alternative...");

      // Try alternative endpoint
      try {
        const endpoint = `/clients/${id}/documents?offset=${offset}&limit=${limit}`;
        data = await fetchFineractAPI(endpoint);
      } catch (e2: any) {
        error = e2;
        console.log("Second endpoint failed, trying documents endpoint...");

        // Try the general documents endpoint
        try {
          const endpoint = `/documents?offset=${offset}&limit=${limit}`;
          data = await fetchFineractAPI(endpoint);

          // Filter by client ID if we get all documents
          if (data && Array.isArray(data.pageItems)) {
            data.pageItems = data.pageItems.filter(
              (doc: any) =>
                doc.parentEntityType === "clients" && doc.parentEntityId == id
            );
          }
        } catch (e3: any) {
          error = e3;
          throw e3;
        }
      }
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching client documents:", error);
    return NextResponse.json(
      { error: error.message || "Unknown error" },
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
    const data = await fetchFineractAPI(`/clients/${id}/documents`, {
      method: "POST",
      body: fineractFormData,
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error uploading client document:", error);

    // If it's a Fineract API error with status code, preserve it
    if (error.status && error.errorData) {
      return NextResponse.json(error.errorData, { status: error.status });
    }

    return NextResponse.json(
      { error: error.message || "Failed to upload document" },
      { status: 500 }
    );
  }
}
