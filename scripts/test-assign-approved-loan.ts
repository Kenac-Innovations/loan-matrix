#!/usr/bin/env tsx
/**
 * Test script - Assign only the FIRST approved loan to its originator
 * Uses the same Fineract report that the leads page uses
 * 
 * Usage: npx tsx scripts/test-assign-approved-loan.ts
 */

import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

// Fineract configuration
const FINERACT_BASE_URL = "http://mifos-be.kenac.co.zw";
const FINERACT_USERNAME = process.env.FINERACT_USERNAME || "mifos";
const FINERACT_PASSWORD = process.env.FINERACT_PASSWORD || "password";
const FINERACT_TENANT_ID = "goodfellow";

// Report name for approved loans (same as leads page)
const APPROVED_REPORT_NAME = "system approved pending disbursement";

interface FineractUser {
  id: number;
  username: string;
  firstname?: string;
  lastname?: string;
}

interface ApprovedLoanRow {
  loan_id: number;
  external_id?: string;
  client_name?: string;
  client_id?: number;
  principal?: number;
  submitted_on?: string;
  approved_on?: string;
  submitted_by?: string;
  approved_by?: string;
  [key: string]: any;
}

/**
 * Run Fineract report to get approved loans
 */
async function fetchApprovedLoansViaReport(): Promise<ApprovedLoanRow[]> {
  const authToken = Buffer.from(`${FINERACT_USERNAME}:${FINERACT_PASSWORD}`).toString("base64");
  
  // Get date range (1 Jan 2026 to today)
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = "2026-01-01";
  
  const encodedReportName = encodeURIComponent(APPROVED_REPORT_NAME);
  const url = `${FINERACT_BASE_URL}/fineract-provider/api/v1/runreports/${encodedReportName}?R_startDate=${startDate}&R_endDate=${endDate}&R_locale=en&R_dateFormat=yyyy-MM-dd`;
  
  console.log("Fetching approved loans via Fineract report...");
  console.log("Report:", APPROVED_REPORT_NAME);
  console.log("Date range:", startDate, "to", endDate);
  console.log("URL:", url);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Basic ${authToken}`,
      "Fineract-Platform-TenantId": FINERACT_TENANT_ID,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch report: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  // Parse the report data - Fineract returns { columnHeaders: [...], data: [...] }
  const parsedData = parseReportData(data);
  
  console.log(`Report returned ${parsedData.length} approved loans`);
  return parsedData;
}

/**
 * Parse Fineract report data into a usable format
 * Fineract reports return: { columnHeaders: [...], data: [{"row": [...]}, {"row": [...]}] }
 */
function parseReportData(reportData: any): ApprovedLoanRow[] {
  if (!reportData) return [];

  // If it's already an array of objects (not row format)
  if (Array.isArray(reportData) && reportData.length > 0) {
    if (typeof reportData[0] === "object" && !Array.isArray(reportData[0]) && !reportData[0].row) {
      return reportData;
    }
  }

  // Handle Fineract standard report format
  const { columnHeaders, data } = reportData;

  if (!columnHeaders || !data) {
    console.log("Report data structure:", Object.keys(reportData || {}));
    return [];
  }

  // Extract column names (handle both {columnName: "name"} and "name" formats)
  const columns = columnHeaders.map((h: any) =>
    typeof h === "string" ? h : h.columnName || h.name || h
  );

  console.log("Report columns:", columns);

  // Map each row to an object
  return data.map((item: any) => {
    const row = item.row || item;
    const obj: any = {};
    columns.forEach((col: string, index: number) => {
      // Convert column names to snake_case for consistency
      const key = col.toLowerCase().replace(/\s+/g, "_");
      obj[key] = row[index];
    });
    return obj;
  });
}

/**
 * Fetch Fineract users
 */
async function fetchFineractUsers(): Promise<Map<number, FineractUser>> {
  const authToken = Buffer.from(`${FINERACT_USERNAME}:${FINERACT_PASSWORD}`).toString("base64");

  const response = await fetch(
    `${FINERACT_BASE_URL}/fineract-provider/api/v1/users`,
    {
      headers: {
        Authorization: `Basic ${authToken}`,
        "Fineract-Platform-TenantId": FINERACT_TENANT_ID,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch users: ${response.status}`);
  }

  const users: FineractUser[] = await response.json();
  const userMap = new Map<number, FineractUser>();
  
  for (const user of users) {
    userMap.set(user.id, user);
  }

  return userMap;
}

function getUserDisplayName(user: FineractUser): string {
  if (user.firstname && user.lastname) {
    return `${user.firstname} ${user.lastname}`;
  }
  return user.username || `User ${user.id}`;
}

async function testAssignApprovedLoan() {
  try {
    console.log("=== TEST: Assign First Approved Loan ===\n");

    // Get the tenant
    const tenant = await prisma.tenant.findFirst({
      where: { slug: "goodfellow", isActive: true },
    });

    if (!tenant) {
      console.error("Tenant 'goodfellow' not found!");
      return;
    }
    console.log(`Tenant: ${tenant.name} (${tenant.id})\n`);

    // Fetch approved loans via report
    const approvedLoans = await fetchApprovedLoansViaReport();

    if (approvedLoans.length === 0) {
      console.log("No approved loans found in Fineract report.");
      return;
    }

    // Get first loan
    const loan = approvedLoans[0];

    console.log("=== First Approved Loan from Report ===");
    console.log("  Raw data:", JSON.stringify(loan, null, 2));
    console.log("");

    // Try to find common column names
    const loanId = loan.loan_id || loan.loanid || loan.id;
    const externalId = loan.external_id || loan.externalid || loan.external_loan_id;
    const clientName = loan.client_name || loan.clientname || loan.client;
    const principal = loan.principal || loan.loan_amount || loan.amount;
    
    console.log("  Parsed values:");
    console.log("    Loan ID:", loanId);
    console.log("    External ID:", externalId || "(none)");
    console.log("    Client Name:", clientName || "(not provided)");
    console.log("    Principal:", principal);
    console.log("");

    if (!loanId && !externalId) {
      console.log(">>> Cannot identify loan - no loan_id or external_id found.");
      return;
    }

    // Find the corresponding lead
    const queryConditions: any[] = [];
    
    if (externalId) {
      queryConditions.push({ id: externalId });
      queryConditions.push({ externalId: externalId });
    }
    
    if (loanId) {
      queryConditions.push({ fineractLoanId: Number(loanId) });
    }

    const lead = await prisma.lead.findFirst({
      where: { 
        tenantId: tenant.id,
        OR: queryConditions 
      },
      select: {
        id: true,
        firstname: true,
        lastname: true,
        userId: true,
        createdByUserName: true,
        assignedToUserId: true,
        assignedToUserName: true,
        requestedAmount: true,
        fineractLoanId: true,
        status: true,
      },
    });

    if (!lead) {
      console.log("=== Lead NOT FOUND in local database ===");
      console.log("Searched with conditions:", JSON.stringify(queryConditions, null, 2));
      return;
    }

    console.log("=== Matching Lead Found ===");
    console.log("  Lead ID:", lead.id);
    console.log("  Client Name:", [lead.firstname, lead.lastname].filter(Boolean).join(" ") || "(none)");
    console.log("  Status:", lead.status);
    console.log("  Requested Amount:", lead.requestedAmount);
    console.log("  Fineract Loan ID:", lead.fineractLoanId);
    console.log("  Created By (userId):", lead.userId);
    console.log("  Created By (userName):", lead.createdByUserName || "(not set)");
    console.log("  Currently Assigned To:", lead.assignedToUserId ? `${lead.assignedToUserName} (ID: ${lead.assignedToUserId})` : "(not assigned)");
    console.log("");

    if (lead.assignedToUserId !== null) {
      console.log(">>> Lead is already assigned, but will reassign to originator.");
    }

    if (!lead.userId) {
      console.log(">>> Lead has no originator userId. Cannot assign.");
      return;
    }

    const originatorMifosId = parseInt(lead.userId, 10);
    if (isNaN(originatorMifosId)) {
      console.log(">>> Invalid originator userId:", lead.userId);
      return;
    }

    // Get user info
    const userMap = await fetchFineractUsers();
    const originatorUser = userMap.get(originatorMifosId);
    const originatorDisplayName = originatorUser 
      ? getUserDisplayName(originatorUser) 
      : lead.createdByUserName || `User ${originatorMifosId}`;

    console.log("=== Will Assign To ===");
    console.log("  Originator Mifos ID:", originatorMifosId);
    console.log("  Originator Name:", originatorDisplayName);
    console.log("");

    // Proceed with assignment
    console.log(">>> Proceeding with assignment...\n");

    // Update the lead
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        assignedToUserId: originatorMifosId,
        assignedToUserName: originatorDisplayName,
        assignedAt: new Date(),
      },
    });

    console.log("✓ Lead assigned successfully!");

    // Create alert
    const alertClientName = [lead.firstname, lead.lastname].filter(Boolean).join(" ") || "Unknown Client";
    const loanAmount = lead.requestedAmount 
      ? `ZMK${lead.requestedAmount.toLocaleString()}` 
      : principal 
        ? `ZMK${Number(principal).toLocaleString()}`
        : "N/A";

    const alert = await prisma.alert.create({
      data: {
        tenantId: tenant.id,
        mifosUserId: originatorMifosId,
        type: "SUCCESS",
        title: "Loan Application Approved",
        message: `Great news! The loan application for ${alertClientName} (${loanAmount}) has been approved and assigned to you.`,
        actionUrl: `/leads/${lead.id}`,
        actionLabel: "View Details",
        metadata: {
          loanId: loanId,
          leadId: lead.id,
          externalId: externalId,
          clientName: alertClientName,
          principal: principal,
          requestedAmount: lead.requestedAmount,
          action: "APPROVE_ASSIGN",
          scriptAssigned: true,
        },
        createdBy: "System (Test Script)",
      },
    });

    console.log("✓ Alert created!");
    console.log("  Alert ID:", alert.id);
    console.log("  Title:", alert.title);
    console.log("  Message:", alert.message);
    console.log("");

    console.log("=== TEST COMPLETE ===");

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testAssignApprovedLoan();
