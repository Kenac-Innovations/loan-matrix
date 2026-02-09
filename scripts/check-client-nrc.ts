#!/usr/bin/env tsx
/**
 * Check for client/loan by NRC number
 */

import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

const FINERACT_BASE_URL = "http://mifos-be.kenac.co.zw";
const FINERACT_USERNAME = "mifos";
const FINERACT_PASSWORD = "password";
const FINERACT_TENANT_ID = "goodfellow";

const NRC_TO_FIND = "838477/11/1";

async function check() {
  const authToken = Buffer.from(`${FINERACT_USERNAME}:${FINERACT_PASSWORD}`).toString("base64");

  console.log(`=== Searching for NRC: ${NRC_TO_FIND} ===\n`);

  // Search Fineract for client
  console.log("\n--- Fineract Search ---");
  try {
    const searchUrl = `${FINERACT_BASE_URL}/fineract-provider/api/v1/search?query=${encodeURIComponent(NRC_TO_FIND)}&resource=clients`;
    const response = await fetch(searchUrl, {
      headers: {
        Authorization: `Basic ${authToken}`,
        "Fineract-Platform-TenantId": FINERACT_TENANT_ID,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const results = await response.json();
      if (results && results.length > 0) {
        console.log(`Found ${results.length} result(s) in Fineract:`);
        for (const r of results) {
          console.log(`  Entity: ${r.entityType} | ID: ${r.entityId} | Name: ${r.entityName}`);
          
          // If it's a client, get their loans
          if (r.entityType === "CLIENT") {
            const clientId = r.entityId;
            
            // Check local database for this fineractClientId
            console.log(`\n--- Local Database (fineractClientId: ${clientId}) ---`);
            const lead = await prisma.lead.findFirst({
              where: { fineractClientId: clientId },
              select: {
                id: true,
                firstname: true,
                lastname: true,
                fineractClientId: true,
                fineractLoanId: true,
                status: true,
                userId: true,
                assignedToUserId: true,
              },
            });
            
            if (lead) {
              console.log("Found lead in local DB:");
              console.log(`  Lead ID: ${lead.id}`);
              console.log(`  Name: ${lead.firstname} ${lead.lastname}`);
              console.log(`  Status: ${lead.status}`);
              console.log(`  fineractClientId: ${lead.fineractClientId || 'NULL'}`);
              console.log(`  fineractLoanId: ${lead.fineractLoanId || 'NULL'}`);
              console.log(`  userId (originator): ${lead.userId}`);
              console.log(`  assignedToUserId: ${lead.assignedToUserId}`);
            } else {
              console.log("No lead found in local DB with this fineractClientId");
            }
            
            // Get loans from Fineract
            const loansUrl = `${FINERACT_BASE_URL}/fineract-provider/api/v1/clients/${clientId}/accounts?fields=loanAccounts`;
            const loansRes = await fetch(loansUrl, {
              headers: {
                Authorization: `Basic ${authToken}`,
                "Fineract-Platform-TenantId": FINERACT_TENANT_ID,
              },
            });
            if (loansRes.ok) {
              const loansData = await loansRes.json();
              const loans = loansData.loanAccounts || [];
              console.log(`\n--- Loans in Fineract for client ${clientId} ---`);
              for (const loan of loans) {
                console.log(`  Loan ID: ${loan.id} | Account: ${loan.accountNo} | Status: ${loan.status?.value}`);
                console.log(`    Principal: ${loan.originalLoan || loan.loanBalance || 'N/A'}`);
                console.log(`    ExternalId: ${loan.externalId || 'none'}`);
                
                // Check if this loan exists in local DB
                if (loan.externalId) {
                  const localLead = await prisma.lead.findFirst({
                    where: { 
                      OR: [
                        { id: loan.externalId },
                        { fineractLoanId: loan.id }
                      ]
                    },
                    select: { id: true, fineractClientId: true, fineractLoanId: true }
                  });
                  if (localLead) {
                    console.log(`    Local Lead: ${localLead.id} | fineractClientId: ${localLead.fineractClientId || 'NULL'}`);
                  } else {
                    console.log(`    Local Lead: NOT FOUND`);
                  }
                }
              }
            }
          }
        }
      } else {
        console.log("No results found in Fineract search");
      }
    } else {
      console.log(`Fineract search failed: ${response.status}`);
    }
  } catch (error) {
    console.error("Error searching Fineract:", error);
  }

  await prisma.$disconnect();
}

check();
