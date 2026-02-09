import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

// Configuration
const FINERACT_BASE_URL = process.env.FINERACT_BASE_URL || "http://mifos-be.kenac.co.zw";
const FINERACT_TENANT_ID = "goodfellow";
const FINERACT_AUTH_TOKEN = process.env.FINERACT_AUTH_TOKEN || "bWlmb3M6cGFzc3dvcmQ="; // Base64 encoded credentials

interface FineractLoan {
  id: number;
  accountNo: string;
  externalId?: string;
  clientId: number;
  clientName?: string;
  loanProductName?: string;
  principal?: number;
  status: {
    id: number;
    code: string;
    value: string;
  };
  timeline?: {
    submittedOnDate?: number[];
    approvedOnDate?: number[];
    actualDisbursementDate?: number[];
  };
}

interface AssignmentResult {
  leadId: string;
  loanId: number;
  accountNo: string;
  clientName: string;
  originatorMifosId: number;
  alertCreated: boolean;
  status: "assigned" | "already_assigned" | "no_originator" | "lead_not_found" | "error";
  message: string;
}

/**
 * Fetch approved loans from Fineract
 */
async function fetchApprovedLoans(): Promise<FineractLoan[]> {
  console.log("\n=== Fetching Approved Loans from Fineract ===");
  
  try {
    // Fetch loans with status "Approved" (status id = 200)
    const url = `${FINERACT_BASE_URL}/fineract-provider/api/v1/loans?sqlSearch=l.loan_status_id=200`;
    console.log("Fetching from:", url);
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${FINERACT_AUTH_TOKEN}`,
        "Fineract-Platform-TenantId": FINERACT_TENANT_ID,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch loans: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const loans: FineractLoan[] = data.pageItems || data || [];
    
    console.log(`Found ${loans.length} approved loans in Fineract`);
    return loans;
  } catch (error) {
    console.error("Error fetching approved loans:", error);
    throw error;
  }
}

/**
 * Check if externalId is from our system (CUID format)
 */
function isValidSystemExternalId(externalId: string | undefined | null): boolean {
  if (!externalId) return false;
  // Our system generates CUIDs that start with "c" (e.g., "cmkqilit0001w53013uirgks9")
  return externalId.startsWith("c") && externalId.length >= 20;
}

/**
 * Process a single loan - assign to originator and create alert
 */
async function processLoan(
  loan: FineractLoan, 
  tenantId: string
): Promise<AssignmentResult> {
  const externalId = loan.externalId;
  const loanId = loan.id;
  const accountNo = loan.accountNo;
  const clientName = loan.clientName || "Unknown Client";

  // Skip loans without valid system external ID
  if (!isValidSystemExternalId(externalId)) {
    return {
      leadId: externalId || "",
      loanId,
      accountNo,
      clientName,
      originatorMifosId: 0,
      alertCreated: false,
      status: "lead_not_found",
      message: `External ID "${externalId}" is not from our system`,
    };
  }

  try {
    // Find the lead in our database
    const lead = await prisma.lead.findFirst({
      where: {
        OR: [
          { id: externalId! },
          { externalId: externalId! },
          { fineractLoanId: loanId },
        ],
      },
      select: {
        id: true,
        firstname: true,
        lastname: true,
        userId: true,
        assignedToUserId: true,
        requestedAmount: true,
      },
    });

    if (!lead) {
      return {
        leadId: externalId!,
        loanId,
        accountNo,
        clientName,
        originatorMifosId: 0,
        alertCreated: false,
        status: "lead_not_found",
        message: "Lead not found in local database",
      };
    }

    const leadClientName = [lead.firstname, lead.lastname].filter(Boolean).join(" ") || clientName;

    // Get originator Mifos ID from userId
    const originatorUserId = lead.userId;
    if (!originatorUserId) {
      return {
        leadId: lead.id,
        loanId,
        accountNo,
        clientName: leadClientName,
        originatorMifosId: 0,
        alertCreated: false,
        status: "no_originator",
        message: "Lead has no originator (userId is null)",
      };
    }

    const originatorMifosId = Number.parseInt(originatorUserId, 10);
    if (Number.isNaN(originatorMifosId)) {
      return {
        leadId: lead.id,
        loanId,
        accountNo,
        clientName: leadClientName,
        originatorMifosId: 0,
        alertCreated: false,
        status: "no_originator",
        message: `Invalid originator user ID: "${originatorUserId}"`,
      };
    }

    // Check if already assigned to the originator
    if (lead.assignedToUserId === originatorMifosId) {
      return {
        leadId: lead.id,
        loanId,
        accountNo,
        clientName: leadClientName,
        originatorMifosId,
        alertCreated: false,
        status: "already_assigned",
        message: `Already assigned to originator (Mifos ID: ${originatorMifosId})`,
      };
    }

    // Assign the lead to the originator
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        assignedToUserId: originatorMifosId,
        assignedAt: new Date(),
      },
    });

    // Create alert for the originator
    const loanAmount = lead.requestedAmount 
      ? `ZMK${lead.requestedAmount.toLocaleString()}` 
      : loan.principal 
        ? `ZMK${loan.principal.toLocaleString()}` 
        : "N/A";

    await prisma.alert.create({
      data: {
        tenantId,
        mifosUserId: originatorMifosId,
        type: "SUCCESS",
        title: "Loan Assigned to You",
        message: `The approved loan for ${leadClientName} (${loanAmount}) has been assigned to you for disbursement.`,
        actionUrl: `/leads/${lead.id}`,
        actionLabel: "View Details",
        metadata: {
          loanId,
          externalId,
          leadId: lead.id,
          accountNo,
          action: "AUTO_ASSIGN",
          principal: loan.principal,
        },
        createdBy: "System",
      },
    });

    return {
      leadId: lead.id,
      loanId,
      accountNo,
      clientName: leadClientName,
      originatorMifosId,
      alertCreated: true,
      status: "assigned",
      message: `Successfully assigned to originator (Mifos ID: ${originatorMifosId})`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      leadId: externalId || "",
      loanId,
      accountNo,
      clientName,
      originatorMifosId: 0,
      alertCreated: false,
      status: "error",
      message: `Error: ${errorMessage}`,
    };
  }
}

/**
 * Main function
 */
async function assignApprovedLoansToOriginators() {
  console.log("=".repeat(60));
  console.log("ASSIGN APPROVED LOANS TO ORIGINATORS");
  console.log("=".repeat(60));
  console.log(`Fineract URL: ${FINERACT_BASE_URL}`);
  console.log(`Tenant: ${FINERACT_TENANT_ID}`);
  console.log("=".repeat(60));

  try {
    // Get the tenant
    const tenant = await prisma.tenant.findFirst({
      where: { slug: FINERACT_TENANT_ID, isActive: true },
    });

    if (!tenant) {
      console.error(`Tenant '${FINERACT_TENANT_ID}' not found or inactive!`);
      return;
    }

    console.log(`\nUsing tenant: ${tenant.name} (${tenant.id})`);

    // Fetch approved loans from Fineract
    const approvedLoans = await fetchApprovedLoans();

    if (approvedLoans.length === 0) {
      console.log("\nNo approved loans found in Fineract.");
      return;
    }

    // Process each loan
    console.log("\n=== Processing Loans ===");
    const results: AssignmentResult[] = [];
    
    for (let i = 0; i < approvedLoans.length; i++) {
      const loan = approvedLoans[i];
      console.log(`\n[${i + 1}/${approvedLoans.length}] Processing loan ${loan.accountNo} (ID: ${loan.id})`);
      
      const result = await processLoan(loan, tenant.id);
      results.push(result);
      
      console.log(`  Status: ${result.status}`);
      console.log(`  Message: ${result.message}`);
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("SUMMARY");
    console.log("=".repeat(60));

    const assigned = results.filter(r => r.status === "assigned");
    const alreadyAssigned = results.filter(r => r.status === "already_assigned");
    const noOriginator = results.filter(r => r.status === "no_originator");
    const notFound = results.filter(r => r.status === "lead_not_found");
    const errors = results.filter(r => r.status === "error");

    console.log(`\nTotal loans processed: ${results.length}`);
    console.log(`  - Assigned to originators: ${assigned.length}`);
    console.log(`  - Already assigned: ${alreadyAssigned.length}`);
    console.log(`  - No originator: ${noOriginator.length}`);
    console.log(`  - Lead not found: ${notFound.length}`);
    console.log(`  - Errors: ${errors.length}`);

    if (assigned.length > 0) {
      console.log("\n--- Newly Assigned ---");
      assigned.forEach(r => {
        console.log(`  ${r.accountNo}: ${r.clientName} -> Mifos ID ${r.originatorMifosId}`);
      });
    }

    if (errors.length > 0) {
      console.log("\n--- Errors ---");
      errors.forEach(r => {
        console.log(`  ${r.accountNo}: ${r.message}`);
      });
    }

    console.log("\n" + "=".repeat(60));
    console.log("COMPLETE");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\nFatal error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
assignApprovedLoansToOriginators();
