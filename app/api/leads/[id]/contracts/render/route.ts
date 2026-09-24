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
 * POST /api/leads/[id]/contracts/render
 * Proxy contract render requests to the backend
 * Returns HTML or PDF based on the format parameter
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
    const body = await request.json();
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

    // Validate signatures: every fineractClientId must match lead's, dataUrls must start with "data:image/"
    if (body.signatures) {
      const signatures = body.signatures;
      const leadClientId = accessibleLead.fineractClientId;

      if (signatures.borrower) {
        if (
          signatures.borrower.fineractClientId &&
          signatures.borrower.fineractClientId !== leadClientId
        ) {
          // Drop this signature
          signatures.borrower = null;
        } else if (
          signatures.borrower.dataUrl &&
          !signatures.borrower.dataUrl.startsWith("data:image/")
        ) {
          // Drop this signature
          signatures.borrower = null;
        }
      }

      if (signatures.guarantor) {
        if (
          signatures.guarantor.fineractClientId &&
          signatures.guarantor.fineractClientId !== leadClientId
        ) {
          // Drop this signature
          signatures.guarantor = null;
        } else if (
          signatures.guarantor.dataUrl &&
          !signatures.guarantor.dataUrl.startsWith("data:image/")
        ) {
          // Drop this signature
          signatures.guarantor = null;
        }
      }

      if (signatures.loanOfficer) {
        if (
          signatures.loanOfficer.fineractClientId &&
          signatures.loanOfficer.fineractClientId !== leadClientId
        ) {
          // Drop this signature
          signatures.loanOfficer = null;
        } else if (
          signatures.loanOfficer.dataUrl &&
          !signatures.loanOfficer.dataUrl.startsWith("data:image/")
        ) {
          // Drop this signature
          signatures.loanOfficer = null;
        }
      }
    }

    const response = await loanMatrixBackendFetch(
      `/api/v1/leads/${encodeURIComponent(leadId)}/contracts/render`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      ctx
    );

    if (!response.ok) {
      const errorBody = await response.text();
      return new NextResponse(errorBody, {
        status: response.status,
        headers: {
          "Content-Type": response.headers.get("Content-Type") || "text/plain",
        },
      });
    }

    const responseBody = await response.blob();
    const contentType = response.headers.get("Content-Type") || "text/html";
    const contentDisposition = response.headers.get("Content-Disposition") || "";

    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        "Content-Type": contentType,
        ...(contentDisposition && { "Content-Disposition": contentDisposition }),
      },
    });
  } catch (error) {
    console.error("Error rendering contract:", error);
    const message = error instanceof Error ? error.message : "Failed to render contract";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
