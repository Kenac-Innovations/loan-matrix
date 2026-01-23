import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantBySlug } from "@/lib/tenant-service";

/**
 * Fineract Loan Webhook Handler
 * 
 * Handles loan events from Fineract and creates appropriate alerts:
 * - CREATE: New loan application submitted
 * - APPROVE: Loan approved
 * - REJECT: Loan rejected
 * - DISBURSE: Loan disbursed
 */

interface FineractLoanWebhookPayload {
  createdByName: string;
  createdByFullName: string;
  createdBy: number; // Mifos user ID who performed the action
  clientId: number;
  officeId: number;
  entityName: string;
  actionName: "CREATE" | "APPROVE" | "REJECT" | "DISBURSE" | string;
  timestamp: string;
  request: {
    productId?: string;
    principal?: number;
    loanTermFrequency?: number;
    externalId?: string;
    clientId?: number;
    approvedLoanAmount?: number;
    approvedOnDate?: string;
    rejectedOnDate?: string;
    note?: string;
    [key: string]: any;
  };
  response: {
    clientId: number;
    loanId: number;
    resourceId: number;
    resourceExternalId?: string;
    changes?: {
      status?: {
        id: number;
        code: string;
        value: string;
      };
      [key: string]: any;
    };
  };
}

// POST /api/webhooks/fineract/loans
export async function POST(request: NextRequest) {
  try {
    const payload: FineractLoanWebhookPayload = await request.json();
    
    console.log("=== FINERACT LOAN WEBHOOK RECEIVED ===");
    console.log("Action:", payload.actionName);
    console.log("Loan ID:", payload.response?.loanId);
    console.log("External ID:", payload.response?.resourceExternalId);
    console.log("Created By:", payload.createdBy);
    
    // Get tenant from header or default
    const tenantSlug = request.headers.get("x-tenant-slug") || 
                       request.headers.get("Fineract-Platform-TenantId") || 
                       "goodfellow";
    const tenant = await getTenantBySlug(tenantSlug);
    
    if (!tenant) {
      console.error("Tenant not found:", tenantSlug);
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Handle different loan actions
    switch (payload.actionName) {
      case "CREATE":
        await handleLoanCreated(payload, tenant.id);
        break;
      case "APPROVE":
        await handleLoanApproved(payload, tenant.id);
        break;
      case "REJECT":
        await handleLoanRejected(payload, tenant.id);
        break;
      case "DISBURSE":
        await handleLoanDisbursed(payload, tenant.id);
        break;
      default:
        console.log("Unhandled action:", payload.actionName);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Webhook processed for action: ${payload.actionName}` 
    });
  } catch (error) {
    console.error("Error processing Fineract loan webhook:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}

/**
 * Handle new loan created - notify authorizers and the applicant
 */
async function handleLoanCreated(payload: FineractLoanWebhookPayload, tenantId: string) {
  const { response, request, createdBy, createdByFullName } = payload;
  const loanId = response.loanId;
  const externalId = response.resourceExternalId || request.externalId;
  const principal = request.principal;
  
  // Try to find client name from lead
  let clientName = "Unknown Client";
  let leadId = externalId;
  
  if (externalId) {
    const lead = await prisma.lead.findFirst({
      where: { 
        OR: [
          { id: externalId },
          { externalId: externalId }
        ]
      },
      select: { id: true, firstname: true, lastname: true },
    });
    
    if (lead) {
      clientName = [lead.firstname, lead.lastname].filter(Boolean).join(" ") || "Unknown Client";
      leadId = lead.id;
    }
  }

  const loanAmount = principal ? `$${principal.toLocaleString()}` : "N/A";

  // 1. Create alert for the user who submitted (createdBy)
  await prisma.alert.create({
    data: {
      tenantId,
      mifosUserId: createdBy,
      type: "INFO",
      title: "Application Submitted Successfully",
      message: `Your loan application for ${clientName} (${loanAmount}) has been submitted and is pending approval.`,
      actionUrl: leadId ? `/leads/${leadId}` : undefined,
      actionLabel: leadId ? "View Application" : undefined,
      metadata: {
        loanId,
        externalId,
        clientId: response.clientId,
        principal,
        action: "CREATE",
      },
      createdBy: "System",
    },
  });

  // 2. Create alerts for users with SUPER_USER or AUTHORIZER roles
  const authorizerRoles = await prisma.systemRole.findMany({
    where: {
      tenantId,
      name: {
        in: ["SUPER_USER", "AUTHORIZER"],
      },
    },
    select: { id: true },
  });

  if (authorizerRoles.length > 0) {
    const roleIds = authorizerRoles.map((r) => r.id);
    
    // Find all users with these roles
    const authorizers = await prisma.userRole.findMany({
      where: {
        tenantId,
        roleId: { in: roleIds },
        isActive: true,
      },
      select: { mifosUserId: true },
    });

    // Create alerts for each authorizer
    const alertPromises = authorizers.map((authorizer) =>
      prisma.alert.create({
        data: {
          tenantId,
          mifosUserId: authorizer.mifosUserId,
          type: "TASK",
          title: "New Loan Application Received",
          message: `${clientName} has submitted a loan application for ${loanAmount}. Review and take action.`,
          actionUrl: leadId ? `/leads/${leadId}` : undefined,
          actionLabel: "Review Application",
          metadata: {
            loanId,
            externalId,
            clientId: response.clientId,
            principal,
            submittedBy: createdByFullName,
            action: "CREATE",
          },
          createdBy: "System",
        },
      })
    );

    await Promise.all(alertPromises);
    console.log(`Created ${authorizers.length} alerts for authorizers`);
  }

  console.log("Loan CREATE alerts created successfully");
}

/**
 * Handle loan approved - notify the user who originally created the loan
 */
async function handleLoanApproved(payload: FineractLoanWebhookPayload, tenantId: string) {
  const { response, request, createdBy, createdByFullName } = payload;
  const loanId = response.loanId;
  const externalId = response.resourceExternalId;
  const approvedAmount = request.approvedLoanAmount;
  
  // Find the original creator of the loan from the lead
  let clientName = "Unknown Client";
  let leadId = externalId;
  
  if (externalId) {
    const lead = await prisma.lead.findFirst({
      where: { 
        OR: [
          { id: externalId },
          { externalId: externalId },
          { fineractLoanId: loanId }
        ]
      },
      select: { 
        id: true, 
        firstname: true, 
        lastname: true,
        userId: true, // The user who created the lead in the app
      },
    });
    
    if (lead) {
      clientName = [lead.firstname, lead.lastname].filter(Boolean).join(" ") || "Unknown Client";
      leadId = lead.id;
      // Note: lead.userId is the app user, we need to map to mifosUserId if needed
    }
  }

  const loanAmount = approvedAmount ? `$${approvedAmount.toLocaleString()}` : "N/A";

  // Create alert for the user who submitted the loan (createdBy from original submission)
  // In Fineract webhooks, createdBy is the user who performed THIS action (approval)
  // We need to look up who originally submitted the loan
  
  // For now, we'll create an alert for the approver to acknowledge
  // and also try to find the original submitter
  
  // Get the loan to find original submitter
  const loanRecord = await prisma.lead.findFirst({
    where: {
      OR: [
        { id: externalId || "" },
        { fineractLoanId: loanId }
      ]
    },
    select: {
      assignedToUserId: true,
      userId: true, // App user who created
    },
  });

  // If there's an assigned user, notify them
  if (loanRecord?.assignedToUserId) {
    await prisma.alert.create({
      data: {
        tenantId,
        mifosUserId: loanRecord.assignedToUserId,
        type: "SUCCESS",
        title: "Loan Application Approved",
        message: `Great news! The loan application for ${clientName} (${loanAmount}) has been approved by ${createdByFullName}.`,
        actionUrl: leadId ? `/leads/${leadId}` : undefined,
        actionLabel: "View Details",
        metadata: {
          loanId,
          externalId,
          approvedAmount,
          approvedBy: createdByFullName,
          action: "APPROVE",
        },
        createdBy: "System",
      },
    });
  }

  // Also notify the person who performed the approval (confirmation)
  await prisma.alert.create({
    data: {
      tenantId,
      mifosUserId: createdBy,
      type: "SUCCESS",
      title: "Loan Approved Successfully",
      message: `You approved the loan application for ${clientName} (${loanAmount}).`,
      actionUrl: leadId ? `/leads/${leadId}` : undefined,
      actionLabel: "View Details",
      metadata: {
        loanId,
        externalId,
        approvedAmount,
        action: "APPROVE",
      },
      createdBy: "System",
    },
  });

  console.log("Loan APPROVE alerts created successfully");
}

/**
 * Handle loan rejected - notify the user who originally created the loan
 */
async function handleLoanRejected(payload: FineractLoanWebhookPayload, tenantId: string) {
  const { response, request, createdBy, createdByFullName } = payload;
  const loanId = response.loanId;
  const externalId = response.resourceExternalId;
  const rejectionNote = request.note || "No reason provided";
  
  let clientName = "Unknown Client";
  let leadId = externalId;
  
  if (externalId) {
    const lead = await prisma.lead.findFirst({
      where: { 
        OR: [
          { id: externalId },
          { externalId: externalId },
          { fineractLoanId: loanId }
        ]
      },
      select: { 
        id: true, 
        firstname: true, 
        lastname: true,
        assignedToUserId: true,
      },
    });
    
    if (lead) {
      clientName = [lead.firstname, lead.lastname].filter(Boolean).join(" ") || "Unknown Client";
      leadId = lead.id;
      
      // Notify assigned user if exists
      if (lead.assignedToUserId) {
        await prisma.alert.create({
          data: {
            tenantId,
            mifosUserId: lead.assignedToUserId,
            type: "WARNING",
            title: "Loan Application Rejected",
            message: `The loan application for ${clientName} has been rejected by ${createdByFullName}. Reason: ${rejectionNote}`,
            actionUrl: `/leads/${lead.id}`,
            actionLabel: "View Details",
            metadata: {
              loanId,
              externalId,
              rejectedBy: createdByFullName,
              rejectionNote,
              action: "REJECT",
            },
            createdBy: "System",
          },
        });
      }
    }
  }

  // Notify the person who performed the rejection (confirmation)
  await prisma.alert.create({
    data: {
      tenantId,
      mifosUserId: createdBy,
      type: "INFO",
      title: "Loan Rejection Processed",
      message: `You rejected the loan application for ${clientName}.`,
      actionUrl: leadId ? `/leads/${leadId}` : undefined,
      actionLabel: "View Details",
      metadata: {
        loanId,
        externalId,
        rejectionNote,
        action: "REJECT",
      },
      createdBy: "System",
    },
  });

  console.log("Loan REJECT alerts created successfully");
}

/**
 * Handle loan disbursed - notify relevant users
 */
async function handleLoanDisbursed(payload: FineractLoanWebhookPayload, tenantId: string) {
  const { response, createdBy, createdByFullName } = payload;
  const loanId = response.loanId;
  const externalId = response.resourceExternalId;
  
  let clientName = "Unknown Client";
  let leadId = externalId;
  let disbursedAmount: number | null = null;
  
  if (externalId) {
    const lead = await prisma.lead.findFirst({
      where: { 
        OR: [
          { id: externalId },
          { externalId: externalId },
          { fineractLoanId: loanId }
        ]
      },
      select: { 
        id: true, 
        firstname: true, 
        lastname: true,
        assignedToUserId: true,
        requestedAmount: true,
      },
    });
    
    if (lead) {
      clientName = [lead.firstname, lead.lastname].filter(Boolean).join(" ") || "Unknown Client";
      leadId = lead.id;
      disbursedAmount = lead.requestedAmount;
      
      // Notify assigned user if exists
      if (lead.assignedToUserId) {
        const amountStr = disbursedAmount ? `$${disbursedAmount.toLocaleString()}` : "";
        const amountDisplay = amountStr ? ` (${amountStr})` : "";
        await prisma.alert.create({
          data: {
            tenantId,
            mifosUserId: lead.assignedToUserId,
            type: "SUCCESS",
            title: "Loan Disbursed",
            message: `The loan for ${clientName}${amountDisplay} has been disbursed by ${createdByFullName}.`,
            actionUrl: `/leads/${lead.id}`,
            actionLabel: "View Details",
            metadata: {
              loanId,
              externalId,
              disbursedBy: createdByFullName,
              disbursedAmount,
              action: "DISBURSE",
            },
            createdBy: "System",
          },
        });
      }
    }
  }

  // Notify the person who performed the disbursement (confirmation)
  await prisma.alert.create({
    data: {
      tenantId,
      mifosUserId: createdBy,
      type: "SUCCESS",
      title: "Loan Disbursement Complete",
      message: `You disbursed the loan for ${clientName}.`,
      actionUrl: leadId ? `/leads/${leadId}` : undefined,
      actionLabel: "View Details",
      metadata: {
        loanId,
        externalId,
        disbursedAmount,
        action: "DISBURSE",
      },
      createdBy: "System",
    },
  });

  console.log("Loan DISBURSE alerts created successfully");
}

// GET endpoint for testing/health check
export async function GET() {
  return NextResponse.json({ 
    status: "ok",
    endpoint: "Fineract Loan Webhook",
    supportedActions: ["CREATE", "APPROVE", "REJECT", "DISBURSE"],
  });
}
