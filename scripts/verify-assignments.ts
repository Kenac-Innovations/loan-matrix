#!/usr/bin/env tsx
/**
 * Verify that all approved loans are assigned to their originators
 */

import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

// Fineract configuration
const FINERACT_BASE_URL = "http://mifos-be.kenac.co.zw";
const FINERACT_USERNAME = process.env.FINERACT_USERNAME || "mifos";
const FINERACT_PASSWORD = process.env.FINERACT_PASSWORD || "password";
const FINERACT_TENANT_ID = "goodfellow";

const APPROVED_REPORT_NAME = "system approved pending disbursement";

async function fetchApprovedLoans() {
  const authToken = Buffer.from(`${FINERACT_USERNAME}:${FINERACT_PASSWORD}`).toString("base64");
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = "2026-01-01";
  
  const encodedReportName = encodeURIComponent(APPROVED_REPORT_NAME);
  const url = `${FINERACT_BASE_URL}/fineract-provider/api/v1/runreports/${encodedReportName}?R_startDate=${startDate}&R_endDate=${endDate}&R_locale=en&R_dateFormat=yyyy-MM-dd`;

  console.log("Fetching approved loans from Fineract...");
  console.log(`Date range: ${startDate} to ${endDate}\n`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Basic ${authToken}`,
      "Fineract-Platform-TenantId": FINERACT_TENANT_ID,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch report: ${response.status}`);
  }

  const data = await response.json();
  
  // Parse report data
  const { columnHeaders, data: rows } = data;
  if (!columnHeaders || !rows) return [];

  const columns = columnHeaders.map((h: any) =>
    typeof h === "string" ? h : h.columnName || h.name || h
  );

  return rows.map((item: any) => {
    const row = item.row || item;
    const obj: any = {};
    columns.forEach((col: string, index: number) => {
      const key = col.toLowerCase().replace(/\s+/g, "_");
      obj[key] = row[index];
    });
    return obj;
  });
}

async function verify() {
  try {
    console.log("=== VERIFICATION: Approved Loans Assignment ===\n");

    const tenant = await prisma.tenant.findFirst({
      where: { slug: "goodfellow", isActive: true },
    });

    if (!tenant) {
      console.error("Tenant not found!");
      return;
    }

    const approvedLoans = await fetchApprovedLoans();
    console.log(`Found ${approvedLoans.length} approved loans in report\n`);

    // Extract all loan IDs and external IDs
    const loanIds: number[] = [];
    const externalIds: string[] = [];
    
    for (const loan of approvedLoans) {
      const loanId = loan.loan_id || loan.loanid || loan.id;
      const externalId = loan.external_id || loan.externalid;
      if (loanId) loanIds.push(Number(loanId));
      if (externalId) externalIds.push(String(externalId));
    }

    console.log("Fetching all matching leads from database...");

    // Fetch all leads at once
    const leads = await prisma.lead.findMany({
      where: {
        tenantId: tenant.id,
        OR: [
          { fineractLoanId: { in: loanIds } },
          { id: { in: externalIds } },
          { externalId: { in: externalIds } },
        ],
      },
      select: {
        id: true,
        firstname: true,
        lastname: true,
        userId: true,
        createdByUserName: true,
        assignedToUserId: true,
        assignedToUserName: true,
        fineractLoanId: true,
        externalId: true,
      },
    });

    console.log(`Found ${leads.length} matching leads in database\n`);

    // Create lookup maps
    const leadByLoanId = new Map<number, typeof leads[0]>();
    const leadByExternalId = new Map<string, typeof leads[0]>();
    
    for (const lead of leads) {
      if (lead.fineractLoanId) leadByLoanId.set(lead.fineractLoanId, lead);
      if (lead.externalId) leadByExternalId.set(lead.externalId, lead);
      leadByExternalId.set(lead.id, lead);
    }

    const mismatches: any[] = [];
    const notFound: any[] = [];
    const correct: any[] = [];

    console.log("Comparing assignments...\n");

    for (const loan of approvedLoans) {
      const loanId = loan.loan_id || loan.loanid || loan.id;
      const externalId = loan.external_id || loan.externalid;

      // Find lead from our maps
      let lead = loanId ? leadByLoanId.get(Number(loanId)) : undefined;
      if (!lead && externalId) lead = leadByExternalId.get(String(externalId));

      if (!lead) {
        notFound.push({ loanId, externalId, reason: "Lead not in DB" });
        continue;
      }

      const originatorId = lead.userId ? parseInt(lead.userId, 10) : null;
      const assignedId = lead.assignedToUserId;

      if (originatorId !== assignedId) {
        mismatches.push({
          loanId,
          leadId: lead.id,
          clientName: [lead.firstname, lead.lastname].filter(Boolean).join(" "),
          originatorId,
          originatorName: lead.createdByUserName,
          assignedId,
          assignedName: lead.assignedToUserName,
        });
      } else {
        correct.push({ loanId, leadId: lead.id, originatorId });
      }
    }

    // Summary
    console.log("=== RESULTS ===\n");
    console.log(`✓ Correctly assigned: ${correct.length}`);
    console.log(`✗ Mismatches: ${mismatches.length}`);
    console.log(`? Not found in DB: ${notFound.length}`);

    if (mismatches.length > 0) {
      console.log("\n=== MISMATCHES (need fixing) ===\n");
      for (const m of mismatches) {
        console.log(`Loan ${m.loanId} | Lead: ${m.leadId}`);
        console.log(`  Client: ${m.clientName}`);
        console.log(`  Created by: ${m.originatorName || 'N/A'} (ID: ${m.originatorId})`);
        console.log(`  Assigned to: ${m.assignedName || 'NOT ASSIGNED'} (ID: ${m.assignedId})`);
        console.log("");
      }
    } else {
      console.log("\n✓ All approved loans are correctly assigned to their originators!");
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
