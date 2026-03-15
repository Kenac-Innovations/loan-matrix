#!/usr/bin/env tsx
/**
 * Script to assign approved loans to their originators and generate alerts
 * Uses the same Fineract report that the leads page uses
 * 
 * This script:
 * 1. Fetches all approved loans from Fineract via the "system approved pending disbursement" report
 * 2. For each loan, finds the corresponding lead in the local database
 * 3. Assigns the lead to the originator (the user who created it)
 * 4. Creates alerts for the assigned originators
 * 
 * Usage: npx tsx scripts/assign-approved-loans.ts
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
  
  // Parse the report data
  const parsedData = parseReportData(data);
  
  console.log(`Report returned ${parsedData.length} approved loans\n`);
  return parsedData;
}

/**
 * Parse Fineract report data into a usable format
 */
function parseReportData(reportData: any): ApprovedLoanRow[] {
  if (!reportData) return [];

  // If it's already an array of objects
  if (Array.isArray(reportData) && reportData.length > 0) {
    if (typeof reportData[0] === "object" && !Array.isArray(reportData[0]) && !reportData[0].row) {
      return reportData;
    }
  }

  // Handle Fineract standard report format
  const { columnHeaders, data } = reportData;

  if (!columnHeaders || !data) {
    return [];
  }

  // Extract column names
  const columns = columnHeaders.map((h: any) =>
    typeof h === "string" ? h : h.columnName || h.name || h
  );

  // Map each row to an object
  return data.map((item: any) => {
    const row = item.row || item;
    const obj: any = {};
    columns.forEach((col: string, index: number) => {
      const key = col.toLowerCase().replace(/\s+/g, "_");
      obj[key] = row[index];
    });
    return obj;
  });
}

/**
 * Fetch all Fineract users to map IDs to names
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

  console.log(`Fetched ${users.length} Fineract users`);
  return userMap;
}

/**
 * Get user display name from a Fineract user
 */
function getUserDisplayName(user: FineractUser): string {
  if (user.firstname && user.lastname) {
    return `${user.firstname} ${user.lastname}`;
  }
  return user.username || `User ${user.id}`;
}

/**
 * Main function to assign approved loans to originators
 */
async function assignApprovedLoans() {
  try {
    console.log("=== Starting Approved Loans Assignment Script ===\n");

    // Get the tenant
    const tenant = await prisma.tenant.findFirst({
      where: { slug: "goodfellow", isActive: true },
    });

    if (!tenant) {
      console.error("Tenant 'goodfellow' not found!");
      return;
    }

    console.log(`Found tenant: ${tenant.name} (${tenant.id})\n`);

    // Fetch all Fineract users for name mapping
    const userMap = await fetchFineractUsers();

    // Fetch all approved loans from Fineract report
    const approvedLoans = await fetchApprovedLoansViaReport();

    if (approvedLoans.length === 0) {
      console.log("No approved loans found to process.");
      return;
    }

    // Statistics
    let assigned = 0;
    let alreadyAssigned = 0;
    let notFoundInDb = 0;
    let noOriginator = 0;
    let alertsCreated = 0;
    let errors = 0;

    console.log(`Processing ${approvedLoans.length} approved loans sequentially...\n`);

    // Process each loan one at a time
    for (let i = 0; i < approvedLoans.length; i++) {
      const loan = approvedLoans[i];
      
      try {
        // Extract loan identifiers (handle various column name formats)
        const loanId = loan.loan_id || loan.loanid || loan.id;
        const externalId = loan.external_id || loan.externalid || loan.external_loan_id;
        const principal = loan.principal || loan.loan_amount || loan.amount;

        console.log(`[${i + 1}/${approvedLoans.length}] Processing loan ${loanId}...`);

        // Build query conditions to find the lead
        const queryConditions: any[] = [];
        
        if (externalId) {
          queryConditions.push({ id: String(externalId) });
          queryConditions.push({ externalId: String(externalId) });
        }
        
        if (loanId) {
          queryConditions.push({ fineractLoanId: Number(loanId) });
        }

        if (queryConditions.length === 0) {
          console.log(`  ⏭ Skipped: No identifiers`);
          notFoundInDb++;
          continue;
        }

        // Find the corresponding lead in the local database
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
          },
        });

        if (!lead) {
          console.log(`  ⏭ Skipped: Lead not found in DB`);
          notFoundInDb++;
          continue;
        }

        // Get the originator (the user who created the lead)
        const originatorUserIdStr = lead.userId;
        
        if (!originatorUserIdStr) {
          console.log(`  ⏭ Skipped: No originator userId`);
          noOriginator++;
          continue;
        }

        // Convert userId to number (Fineract/Mifos user ID)
        const originatorMifosId = parseInt(originatorUserIdStr, 10);
        
        if (isNaN(originatorMifosId)) {
          console.log(`  ⏭ Skipped: Invalid originator userId`);
          noOriginator++;
          continue;
        }

        // Check if already assigned to the originator - skip if so
        if (lead.assignedToUserId === originatorMifosId) {
          console.log(`  ⏭ Skipped: Already assigned to originator`);
          alreadyAssigned++;
          continue;
        }

        // If assigned to someone else, we'll reassign to the originator
        const wasReassigned = lead.assignedToUserId !== null;

        // Get the originator's display name
        const originatorUser = userMap.get(originatorMifosId);
        const originatorDisplayName = originatorUser 
          ? getUserDisplayName(originatorUser) 
          : lead.createdByUserName || `User ${originatorMifosId}`;

        // Assign the lead to the originator
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            assignedToUserId: originatorMifosId,
            assignedToUserName: originatorDisplayName,
            assignedAt: new Date(),
          },
        });

        assigned++;

        // Create alert for the originator
        const clientName = [lead.firstname, lead.lastname].filter(Boolean).join(" ") || "Unknown Client";
        const loanAmount = lead.requestedAmount 
          ? `ZMK${lead.requestedAmount.toLocaleString()}` 
          : principal 
            ? `ZMK${Number(principal).toLocaleString()}`
            : "N/A";

        await prisma.alert.create({
          data: {
            tenantId: tenant.id,
            mifosUserId: originatorMifosId,
            type: "SUCCESS",
            title: "Loan Application Approved",
            message: `Great news! The loan application for ${clientName} (${loanAmount}) has been approved and assigned to you.`,
            actionUrl: `/leads/${lead.id}`,
            actionLabel: "View Details",
            metadata: {
              loanId: loanId,
              leadId: lead.id,
              externalId: externalId,
              clientName,
              principal: principal,
              requestedAmount: lead.requestedAmount,
              action: "APPROVE_ASSIGN",
              scriptAssigned: true,
            },
            createdBy: "System (Script)",
          },
        });

        alertsCreated++;

        const action = wasReassigned ? 'Reassigned' : 'Assigned';
        console.log(`  ✓ ${action} to ${originatorDisplayName}`);
      } catch (error) {
        console.error(`  ✗ Error:`, error);
        errors++;
      }
    }

    // Print summary
    console.log("\n=== Summary ===");
    console.log(`Total approved loans from report: ${approvedLoans.length}`);
    console.log(`Successfully assigned: ${assigned}`);
    console.log(`Already assigned: ${alreadyAssigned}`);
    console.log(`Not found in local DB: ${notFoundInDb}`);
    console.log(`No originator found: ${noOriginator}`);
    console.log(`Alerts created: ${alertsCreated}`);
    console.log(`Errors: ${errors}`);

  } catch (error) {
    console.error("Error in assignApprovedLoans:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
assignApprovedLoans();
