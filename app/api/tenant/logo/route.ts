import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { prisma } from "@/lib/prisma";
import { uploadDocument } from "@/lib/document-service-client";

/**
 * POST /api/tenant/logo
 * Upload organization logo to document service and save link/URL on current tenant.
 * Requires auth. Uses document service tenantId: "loanmatrix".
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const baseUrl =
      process.env.DOCUMENT_SERVICE_URL ||
      process.env.DOCUMENT_SERVICE_BASE_URL;
    if (!baseUrl) {
      return NextResponse.json(
        { error: "DOCUMENT_SERVICE_URL or DOCUMENT_SERVICE_BASE_URL is not configured" },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing or invalid file. Send as multipart/form-data with field 'file'." },
        { status: 400 }
      );
    }

    const fileName = file.name || "logo.png";
    const res = await uploadDocument(file, fileName, baseUrl);

    if (!res.success || !res.data) {
      return NextResponse.json(
        { error: res.message || "Upload failed" },
        { status: 502 }
      );
    }

    const { fileUrl, documentId } = res.data;
    const linkId = documentId; // or extract from fileUrl path; spec says linkId is the UUID in fileUrl

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        logoLinkId: linkId,
        logoFileUrl: fileUrl,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      logoFileUrl: fileUrl,
      logoLinkId: linkId,
    });
  } catch (error) {
    console.error("Tenant logo upload error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to upload logo",
      },
      { status: 500 }
    );
  }
}
