import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  applyLeadVisibilityScope,
  getLeadViewerAccessContext,
} from "@/lib/lead-policy";
import { getTenantAndFineractInfo } from "@/lib/fineract-tenant-service";
import { getLoanMatrixBackendContext, loanMatrixBackendFetch } from "@/lib/loan-matrix-backend";

/**
 * POST /api/leads/[id]/contracts
 * Generate and upload contracts to Fineract via the backend
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

    // Get tenant info
    const tenantInfo = await getTenantAndFineractInfo();

    // Load lead with tenant info
    const leadRecord = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        tenantId: true,
        fineractLoanId: true,
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
        fineractLoanId: true,
      },
    });

    if (!accessibleLead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Verify body.loanId matches the lead's fineractLoanId
    const bodyLoanId = Number(body?.loanId);
    if (!Number.isInteger(bodyLoanId) || bodyLoanId <= 0) {
      return NextResponse.json(
        { error: "Invalid loanId in request body" },
        { status: 400 }
      );
    }

    if (accessibleLead.fineractLoanId !== bodyLoanId) {
      return NextResponse.json(
        { error: "Loan ID mismatch" },
        { status: 400 }
      );
    }

    const response = await loanMatrixBackendFetch(
      `/api/v1/leads/${encodeURIComponent(leadId)}/contracts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      ctx,
      { actingUser: true }
    );

    const responseBody = await response.json().catch(() => ({}));

    // Pass through the status (200 or 207 for partial failures)
    return NextResponse.json(responseBody, { status: response.status });
  } catch (error) {
    console.error("Error uploading contracts:", error);
    const message = error instanceof Error ? error.message : "Failed to upload contracts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
