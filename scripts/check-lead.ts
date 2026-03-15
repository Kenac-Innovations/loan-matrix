#!/usr/bin/env tsx
/**
 * Check a specific lead for payout button eligibility
 */

import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

const FINERACT_BASE_URL = "http://mifos-be.kenac.co.zw";
const FINERACT_USERNAME = "mifos";
const FINERACT_PASSWORD = "password";
const FINERACT_TENANT_ID = "goodfellow";

const LEAD_ID = "cml59l9r0028e8h01ppgjo98u";

async function check() {
  const authToken = Buffer.from(`${FINERACT_USERNAME}:${FINERACT_PASSWORD}`).toString("base64");

  console.log(`=== Checking Lead: ${LEAD_ID} ===\n`);

  // 1. Get lead from local database
  console.log("--- Local Database ---");
  const lead = await prisma.lead.findUnique({
    where: { id: LEAD_ID },
    select: {
      id: true,
      firstname: true,
      lastname: true,
      fineractClientId: true,
      fineractLoanId: true,
      status: true,
      userId: true,
      assignedToUserId: true,
      externalId: true,
    },
  });

  if (!lead) {
    console.log("Lead NOT FOUND in database!");
    await prisma.$disconnect();
    return;
  }

  console.log(`Lead ID: ${lead.id}`);
  console.log(`Name: ${lead.firstname} ${lead.lastname}`);
  console.log(`Status: ${lead.status}`);
  console.log(`fineractClientId: ${lead.fineractClientId ?? 'NULL'} ${!lead.fineractClientId ? '⚠️ MISSING - Payout button won\'t show!' : '✓'}`);
  console.log(`fineractLoanId: ${lead.fineractLoanId ?? 'NULL'}`);
  console.log(`externalId: ${lead.externalId ?? 'NULL'}`);
  console.log(`userId (originator): ${lead.userId}`);
  console.log(`assignedToUserId: ${lead.assignedToUserId}`);

  // 2. Check Fineract for loan by external ID (lead ID)
  console.log("\n--- Fineract Loan Search ---");
  try {
    const searchUrl = `${FINERACT_BASE_URL}/fineract-provider/api/v1/loans?externalId=${encodeURIComponent(LEAD_ID)}`;
    console.log(`Searching by externalId: ${LEAD_ID}`);
    
    const response = await fetch(searchUrl, {
      headers: {
        Authorization: `Basic ${authToken}`,
        "Fineract-Platform-TenantId": FINERACT_TENANT_ID,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const loans = data.pageItems || data || [];
      
      if (loans.length === 0) {
        console.log("No loan found with this externalId in Fineract");
      } else {
        for (const loan of loans) {
          console.log(`\nLoan found in Fineract:`);
          console.log(`  Loan ID: ${loan.id}`);
          console.log(`  Account No: ${loan.accountNo}`);
          console.log(`  Client ID: ${loan.clientId}`);
          console.log(`  Client Name: ${loan.clientName}`);
          console.log(`  Status: ${loan.status?.value} (code: ${loan.status?.code})`);
          console.log(`  External ID: ${loan.externalId}`);
          console.log(`  Principal: ${loan.principal}`);
          
          // Check status for payout eligibility
          const statusValue = loan.status?.value?.toLowerCase() || '';
          const isActive = statusValue.includes('active');
          console.log(`\n--- Payout Button Eligibility ---`);
          console.log(`  Status includes 'active': ${isActive ? '✓ YES' : '✗ NO'}`);
          
          if (!isActive) {
            console.log(`  ⚠️ Loan status is "${loan.status?.value}" - Payout button requires "Active" status`);
          }
          
          // Check if fineractClientId matches
          if (lead.fineractClientId && lead.fineractClientId !== loan.clientId) {
            console.log(`  ⚠️ fineractClientId mismatch! DB: ${lead.fineractClientId}, Fineract: ${loan.clientId}`);
          }
          
          // Summary
          console.log(`\n--- SUMMARY ---`);
          const hasLoanId = !!loan.id;
          const hasClientId = !!lead.fineractClientId;
          const canShowPayout = hasLoanId && hasClientId && isActive;
          
          console.log(`  Has loanId: ${hasLoanId ? '✓' : '✗'}`);
          console.log(`  Has fineractClientId in DB: ${hasClientId ? '✓' : '✗'}`);
          console.log(`  Status is Active: ${isActive ? '✓' : '✗'}`);
          console.log(`  \n  PAYOUT BUTTON SHOULD SHOW: ${canShowPayout ? '✓ YES' : '✗ NO'}`);
          
          if (!canShowPayout) {
            console.log(`\n  FIX NEEDED:`);
            if (!hasClientId) {
              console.log(`    - Update lead.fineractClientId to ${loan.clientId}`);
            }
            if (!isActive) {
              console.log(`    - Loan needs to be disbursed first (current status: ${loan.status?.value})`);
            }
          }
        }
      }
    } else {
      console.log(`Fineract search failed: ${response.status}`);
    }
  } catch (error) {
    console.error("Error:", error);
  }

  // 3. Also try searching by fineractLoanId if available
  if (lead.fineractLoanId) {
    console.log(`\n--- Also checking by fineractLoanId: ${lead.fineractLoanId} ---`);
    try {
      const loanUrl = `${FINERACT_BASE_URL}/fineract-provider/api/v1/loans/${lead.fineractLoanId}`;
      const response = await fetch(loanUrl, {
        headers: {
          Authorization: `Basic ${authToken}`,
          "Fineract-Platform-TenantId": FINERACT_TENANT_ID,
        },
      });
      
      if (response.ok) {
        const loan = await response.json();
        console.log(`Loan Status: ${loan.status?.value}`);
        console.log(`Client ID: ${loan.clientId}`);
      }
    } catch (e) {
      console.log("Could not fetch by loan ID");
    }
  }

  await prisma.$disconnect();
}

check();
