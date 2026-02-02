import { NextRequest, NextResponse } from "next/server";
import { FineractAPIService } from "@/lib/fineract-api";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantBySlug } from "@/lib/tenant-service";

// POST /api/fineract/loans/[id]/action - Perform an action on a loan
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loanId } = await params;
    const body = await request.json();
    const {
      action,
      note,
      approvedOnDate,
      approvedLoanAmount,
      actualDisbursementDate,
    } = body;

    if (!action) {
      return NextResponse.json(
        { error: "Action is required" },
        { status: 400 }
      );
    }

    // Get session for auth
    const session = await getSession();
    const accessToken =
      session?.base64EncodedAuthenticationKey || session?.accessToken;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Unauthorized - no access token" },
        { status: 401 }
      );
    }

    // Get tenant
    const tenantSlug =
      request.headers.get("x-tenant-slug") ||
      request.nextUrl.hostname.split(".")[0] ||
      "goodfellow";
    const tenantId = await getFineractTenantId();

    const fineractService = new FineractAPIService({
      baseUrl: process.env.FINERACT_BASE_URL || "http://10.10.0.143",
      username: process.env.FINERACT_USERNAME || "mifos",
      password: process.env.FINERACT_PASSWORD || "password",
      tenantId: tenantId,
    });

    // Build the request body based on action
    let actionBody: any = {};
    let command = "";

    switch (action) {
      case "approve":
        command = "approve";
        actionBody = {
          approvedOnDate: formatDate(approvedOnDate || new Date()),
          dateFormat: "dd MMMM yyyy",
          locale: "en",
          note: note || undefined,
        };
        if (approvedLoanAmount) {
          actionBody.approvedLoanAmount = approvedLoanAmount;
        }
        break;

      case "reject":
        command = "reject";
        actionBody = {
          rejectedOnDate: formatDate(new Date()),
          dateFormat: "dd MMMM yyyy",
          locale: "en",
          note: note || "Loan application rejected",
        };
        break;

      case "disburse":
        command = "disburse";
        actionBody = {
          actualDisbursementDate: formatDate(
            actualDisbursementDate || new Date()
          ),
          dateFormat: "dd MMMM yyyy",
          locale: "en",
          note: note || undefined,
        };
        break;

      case "undo_approval":
        command = "undoapproval";
        actionBody = {
          note: note || "Approval undone",
        };
        break;

      case "write_off":
        command = "writeoff";
        actionBody = {
          transactionDate: formatDate(new Date()),
          dateFormat: "dd MMMM yyyy",
          locale: "en",
          note: note || "Loan written off",
        };
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    console.log(`Performing loan action: ${command} on loan ${loanId}`);
    console.log("Action body:", actionBody);

    // Call Fineract API
    const response = await fetch(
      `${
        process.env.FINERACT_BASE_URL || "http://10.10.0.143"
      }/fineract-provider/api/v1/loans/${loanId}?command=${command}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${accessToken}`,
          "Fineract-Platform-TenantId": tenantId,
        },
        body: JSON.stringify(actionBody),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Fineract loan action error:", errorData);
      return NextResponse.json(
        {
          error:
            errorData.defaultUserMessage ||
            errorData.error ||
            `Failed to ${action} loan`,
          details: errorData,
        },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log("Loan action result:", result);

    // Transition lead stage based on action
    try {
      await transitionLeadStage(loanId, action, tenantSlug);
    } catch (transitionError) {
      console.error("Error transitioning lead stage:", transitionError);
      // Don't fail the request if stage transition fails
    }

    return NextResponse.json({
      success: true,
      message: `Loan ${action.replace("_", " ")} successful`,
      result,
    });
  } catch (error: any) {
    console.error("Error performing loan action:", error);
    return NextResponse.json(
      { error: error.message || "Failed to perform loan action" },
      { status: 500 }
    );
  }
}

// Format date to Fineract format (dd MMMM yyyy)
function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Transition lead pipeline stage based on loan action
 */
async function transitionLeadStage(
  loanId: string,
  action: string,
  tenantSlug: string
) {
  // Map loan actions to target stage names
  const actionToStageMap: Record<string, string> = {
    approve: "Approval",
    reject: "Rejected",
    disburse: "Disbursement",
  };

  const targetStageName = actionToStageMap[action];
  if (!targetStageName) {
    console.log(`No stage transition needed for action: ${action}`);
    return;
  }

  // Get tenant
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) {
    console.error(`Tenant not found: ${tenantSlug}`);
    return;
  }

  // Find lead by fineractLoanId
  const lead = await prisma.lead.findFirst({
    where: {
      tenantId: tenant.id,
      fineractLoanId: parseInt(loanId),
    },
    include: {
      currentStage: true,
    },
  });

  if (!lead) {
    console.log(`No lead found with fineractLoanId: ${loanId}`);
    return;
  }

  // Find target stage
  const targetStage = await prisma.pipelineStage.findFirst({
    where: {
      tenantId: tenant.id,
      name: targetStageName,
      isActive: true,
    },
  });

  if (!targetStage) {
    console.error(`Target stage not found: ${targetStageName}`);
    return;
  }

  // Check if lead is already in the target stage
  if (lead.currentStageId === targetStage.id) {
    console.log(`Lead ${lead.id} is already in stage: ${targetStageName}`);
    return;
  }

  // Create state transition record
  await prisma.stateTransition.create({
    data: {
      leadId: lead.id,
      tenantId: tenant.id,
      fromStageId: lead.currentStageId || targetStage.id,
      toStageId: targetStage.id,
      event: `loan_${action}`,
      triggeredBy: "system",
      triggeredAt: new Date(),
      metadata: {
        loanId: loanId,
        action: action,
        automated: true,
      },
    },
  });

  // Update lead's current stage
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      currentStageId: targetStage.id,
      updatedAt: new Date(),
    },
  });

  console.log(
    `Lead ${lead.id} transitioned from "${lead.currentStage?.name}" to "${targetStageName}"`
  );
}
