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

/**
 * Check if externalId is from our system (CUID format)
 * Skip notifications for external IDs like "LA..." which are not from our system
 */
function isValidSystemExternalId(externalId: string | undefined | null): boolean {
  if (!externalId) return false;
  // Our system generates CUIDs that start with "c" (e.g., "cmkqilit0001w53013uirgks9")
  // Skip IDs that start with "LA" or other non-CUID patterns
  // CUIDs are 25 characters long and start with "c"
  return externalId.startsWith("c") && externalId.length >= 20;
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
    
    // Check if this loan is from our system
    const externalId = payload.response?.resourceExternalId || payload.request?.externalId;
    if (!isValidSystemExternalId(externalId)) {
      console.log("Skipping webhook - external ID is not from our system:", externalId);
      return NextResponse.json({ 
        success: true, 
        message: "Skipped - external ID not from this system",
        externalId 
      });
    }
    
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
 * and automatically assign the loan to the originator
 */
async function handleLoanApproved(payload: FineractLoanWebhookPayload, tenantId: string) {
  const { response, request, createdBy, createdByFullName } = payload;
  const loanId = response.loanId;
  const externalId = response.resourceExternalId;
  
  console.log("=== APPROVE WEBHOOK DEBUG ===");
  console.log("Loan ID:", loanId);
  console.log("External ID:", externalId);
  
  // Find the original creator of the loan from the lead
  let clientName = "";
  let leadId: string | null = null;
  let originatorUserId: string | null = null;
  let originatorMifosId: number | null = null;
  
  // Build query conditions - only include valid conditions
  const queryConditions: any[] = [];
  if (externalId) {
    queryConditions.push({ id: externalId });
    queryConditions.push({ externalId: externalId });
  }
  if (loanId) {
    queryConditions.push({ fineractLoanId: loanId });
  }
  
  console.log("Query conditions:", JSON.stringify(queryConditions));
  
  // Get the loan record to find the originator
  const loanRecord = queryConditions.length > 0 
    ? await prisma.lead.findFirst({
        where: { OR: queryConditions },
        select: {
          id: true,
          firstname: true,
          lastname: true,
          userId: true,
          assignedToUserId: true,
        },
      })
    : null;

  console.log("Lead record found:", loanRecord ? loanRecord.id : "NOT FOUND");

  if (loanRecord) {
    const fullName = [loanRecord.firstname, loanRecord.lastname].filter(Boolean).join(" ");
    clientName = fullName || "";
    leadId = loanRecord.id;
    originatorUserId = loanRecord.userId;
    
    console.log("Client name:", clientName);
    console.log("Lead ID:", leadId);
    console.log("Originator user ID:", originatorUserId);
    
    // The userId in the lead is the Mifos user ID (stored as string)
    // Convert it to number for assignment
    if (originatorUserId) {
      originatorMifosId = Number.parseInt(originatorUserId, 10);
      if (Number.isNaN(originatorMifosId)) {
        originatorMifosId = null;
      }
    }
  }

  // === AUTO-ASSIGN LOAN TO ORIGINATOR (Local DB only) ===
  if (originatorMifosId && leadId) {
    try {
      console.log(`Assigning lead ${leadId} to originator (Mifos ID: ${originatorMifosId})`);
      
      // Update local lead record with assignment
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          assignedToUserId: originatorMifosId,
          assignedAt: new Date(),
        },
      });
      
      console.log(`Successfully assigned lead ${leadId} to originator (Mifos ID: ${originatorMifosId})`);
    } catch (assignError) {
      console.error("Failed to auto-assign lead to originator:", assignError);
      // Continue with alerts even if assignment fails
    }
  }

  // === CREATE ALERTS ===
  
  // Build client display name
  const clientDisplay = clientName || "the client";
  const actionUrl = leadId ? `/leads/${leadId}` : undefined;
  
  console.log("Action URL for alerts:", actionUrl);
  
  // Notify the originator (or assigned user) about approval
  const notifyUserId = originatorMifosId || loanRecord?.assignedToUserId;
  if (notifyUserId) {
    await prisma.alert.create({
      data: {
        tenantId,
        mifosUserId: notifyUserId,
        type: "SUCCESS",
        title: "Loan Application Approved",
        message: `Great news! The loan application for ${clientDisplay} has been approved by ${createdByFullName}.`,
        actionUrl,
        actionLabel: actionUrl ? "View Details" : undefined,
        metadata: {
          loanId,
          externalId,
          leadId,
          approvedBy: createdByFullName,
          autoAssigned: !!originatorMifosId,
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
      message: `You approved the loan application for ${clientDisplay}.`,
      actionUrl,
      actionLabel: actionUrl ? "View Details" : undefined,
      metadata: {
        loanId,
        externalId,
        leadId,
        action: "APPROVE",
      },
      createdBy: "System",
    },
  });

  console.log("Loan APPROVE alerts created and loan auto-assigned successfully");
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
