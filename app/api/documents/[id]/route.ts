import { NextRequest, NextResponse } from "next/server";
import { extractDocumentId } from "@/lib/document-utils";

/**
 * GET /api/documents/[id]
 * Proxy to document service for preview and download. Avoids CORS when the app
 * and document service are on different origins.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await context.params;
    const documentId = extractDocumentId(rawId);
    if (!documentId) {
      return NextResponse.json({ error: "Invalid document ID" }, { status: 400 });
    }

    const baseUrl =
      process.env.DOCUMENT_SERVICE_URL ||
      process.env.DOCUMENT_SERVICE_BASE_URL;
    if (!baseUrl) {
      return NextResponse.json(
        { error: "Document service not configured" },
        { status: 503 }
      );
    }

    const docUrl = `${baseUrl.replace(/\/$/, "")}/api/documents/${documentId}`;
    const res = await fetch(docUrl, {
      method: "GET",
      headers: { Accept: "*/*" },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Document not found or failed to fetch" },
        { status: res.status }
      );
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const contentDisposition = res.headers.get("content-disposition") || "";
    const body = await res.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        ...(contentDisposition && { "Content-Disposition": contentDisposition }),
      },
    });
  } catch (error) {
    console.error("Document proxy error:", error);
    return NextResponse.json(
      { error: "Failed to load document" },
      { status: 500 }
    );
  }
}
