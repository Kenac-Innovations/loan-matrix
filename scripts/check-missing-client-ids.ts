#!/usr/bin/env tsx
/**
 * Check for disbursed loans with missing fineractClientId
 */

import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

// Fineract configuration
const FINERACT_BASE_URL = "http://mifos-be.kenac.co.zw";
const FINERACT_USERNAME = "mifos";
const FINERACT_PASSWORD = "password";
const FINERACT_TENANT_ID = "goodfellow";

async function fetchDisbursedLoans() {
  const authToken = Buffer.from(`${FINERACT_USERNAME}:${FINERACT_PASSWORD}`).toString("base64");
  
  // Fetch loans with status "Active" (status id = 300 = disbursed/active)
  const url = `${FINERACT_BASE_URL}/fineract-provider/api/v1/loans?sqlSearch=l.loan_status_id=300&limit=1000`;

  console.log("Fetching disbursed (Active) loans from Fineract...\n");

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${authToken}`,
      "Fineract-Platform-TenantId": FINERACT_TENANT_ID,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch loans: ${response.status}`);
  }

  const data = await response.json();
  return data.pageItems || data || [];
}

async function check() {
  try {
    console.log("=== CHECK: Missing fineractClientId for Disbursed Loans ===\n");

    const tenant = await prisma.tenant.findFirst({
      where: { slug: "goodfellow", isActive: true },
    });

    if (!tenant) {
      console.error("Tenant not found!");
      return;
    }

    const disbursedLoans = await fetchDisbursedLoans();
    console.log(`Found ${disbursedLoans.length} disbursed loans in Fineract\n`);

    // Get all loan IDs and external IDs from Fineract response
    const loanIds: number[] = [];
    const externalIds: string[] = [];
    
    for (const loan of disbursedLoans) {
      if (loan.id) loanIds.push(Number(loan.id));
      if (loan.externalId) externalIds.push(String(loan.externalId));
    }

    // Fetch all matching leads
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
        fineractClientId: true,
        fineractLoanId: true,
        externalId: true,
      },
    });

    console.log(`Found ${leads.length} matching leads in database\n`);

    // Create lookup
    const leadByLoanId = new Map<number, typeof leads[0]>();
    const leadByExternalId = new Map<string, typeof leads[0]>();
    
    for (const lead of leads) {
      if (lead.fineractLoanId) leadByLoanId.set(lead.fineractLoanId, lead);
      if (lead.externalId) leadByExternalId.set(lead.externalId, lead);
      leadByExternalId.set(lead.id, lead);
    }

    const missingClientId: any[] = [];
    const hasClientId: any[] = [];
    const notFound: any[] = [];

    for (const loan of disbursedLoans) {
      const loanId = loan.id;
      const externalId = loan.externalId;
      const clientName = loan.clientName || "Unknown";
      const clientId = loan.clientId;
      const accountNo = loan.accountNo;

      let lead = loanId ? leadByLoanId.get(Number(loanId)) : undefined;
      if (!lead && externalId) lead = leadByExternalId.get(String(externalId));

      if (!lead) {
        notFound.push({ loanId, externalId, clientName, accountNo });
        continue;
      }

      if (!lead.fineractClientId) {
        missingClientId.push({
          loanId,
          leadId: lead.id,
          clientName,
          accountNo,
          fineractClientId: clientId, // From Fineract - can be used to fix
          fineractLoanId: lead.fineractLoanId,
        });
      } else {
        hasClientId.push({ loanId, leadId: lead.id, clientName });
      }
    }

    console.log("=== RESULTS ===\n");
    console.log(`✓ Has fineractClientId (Payout will work): ${hasClientId.length}`);
    console.log(`✗ Missing fineractClientId (NO Payout button): ${missingClientId.length}`);
    console.log(`? Not found in DB: ${notFound.length}`);

    if (missingClientId.length > 0) {
      console.log("\n=== LEADS MISSING fineractClientId (can be fixed) ===\n");
      for (const m of missingClientId) {
        console.log(`Loan ${m.loanId} (${m.accountNo}) | Lead: ${m.leadId}`);
        console.log(`  Client: ${m.clientName}`);
        console.log(`  Fineract clientId available: ${m.fineractClientId}`);
        console.log("");
      }
    }

    if (notFound.length > 0) {
      console.log("\n=== NOT FOUND IN DATABASE ===\n");
      for (const n of notFound) {
        console.log(`Loan ${n.loanId} (${n.accountNo}) | ExternalId: ${n.externalId || 'none'} | Client: ${n.clientName}`);
      }
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

check();
