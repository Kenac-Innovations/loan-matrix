import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  applyLeadVisibilityScope,
  getLeadViewerAccessContext,
} from "@/lib/lead-policy";
import { getTenantAndFineractInfo } from "@/lib/fineract-tenant-service";
import { isLeadContractsBackendEnabled } from "@/lib/lead-contracts-backend-flag";
import { getLoanMatrixBackendContext, loanMatrixBackendFetch } from "@/lib/loan-matrix-backend";

/**
 * POST /api/leads/[id]/contracts/signatures
 * Upload a signature file to the backend
 * Expects multipart form data with: file, role ("borrower"|"guarantor"), clientId
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.id || !session.user.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: leadId } = await params;
    const formData = await request.formData();
    const ctx = await getLoanMatrixBackendContext();

    // Get tenant info for flag check
    const tenantInfo = await getTenantAndFineractInfo();
    const backendEnabled = isLeadContractsBackendEnabled(tenantInfo.tenant?.slug ?? null);
    if (!backendEnabled) {
      return NextResponse.json({ error: "Backend mode is not enabled" }, { status: 404 });
    }

    // Load lead with tenant info
    const leadRecord = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        tenantId: true,
        fineractClientId: true,
      },
    });

    // The backend acts with a Fineract service account in the caller's tenant, so the
    // lead must belong to that same tenant.
    if (!leadRecord || !tenantInfo.tenant?.id || leadRecord.tenantId !== tenantInfo.tenant.id) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Apply visibility scope to ensure user has access
    const leadAccess = await getLeadViewerAccessContext(
      leadRecord.tenantId,
      session.user.userId ?? null
    );
    const accessibleLead = await prisma.lead.findFirst({
      where: applyLeadVisibilityScope(
        {
          id: leadId,
          tenantId: leadRecord.tenantId,
        },
        leadAccess.visibleOfficeIds
      ),
      select: {
        id: true,
        fineractClientId: true,
      },
    });

    if (!accessibleLead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Validate role
    const role = formData.get("role");
    if (role !== "borrower" && role !== "guarantor") {
      return NextResponse.json(
        { error: 'Role must be "borrower" or "guarantor"' },
        { status: 400 }
      );
    }

    // Validate clientId matches lead's fineractClientId
    const formClientId = formData.get("clientId");
    let clientIdNum: number | null = null;
    if (formClientId) {
      clientIdNum = Number(formClientId);
      if (!Number.isInteger(clientIdNum) || clientIdNum <= 0) {
        return NextResponse.json(
          { error: "Invalid clientId in form data" },
          { status: 400 }
        );
      }
    }

    if (clientIdNum !== accessibleLead.fineractClientId) {
      return NextResponse.json(
        { error: "Client ID mismatch" },
        { status: 400 }
      );
    }

    // Rebuild FormData to send to backend (preserving all fields)
    const backendFormData = new FormData();
    for (const [key, value] of formData) {
      backendFormData.append(key, value);
    }

    const response = await loanMatrixBackendFetch(
      `/api/v1/leads/${encodeURIComponent(leadId)}/signatures`,
      {
        method: "POST",
        body: backendFormData,
      },
      ctx,
      { actingUser: true }
    );

    const responseBody = await response.json().catch(() => ({}));
    return NextResponse.json(responseBody, { status: response.status });
  } catch (error) {
    console.error("Error uploading signature:", error);
    const message = error instanceof Error ? error.message : "Failed to upload signature";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
