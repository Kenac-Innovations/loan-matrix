#!/usr/bin/env tsx
/**
 * Quick script to find a lead by account number, loan ID, or other identifiers
 * 
 * Usage: npx tsx scripts/find-lead.ts "156789/46/1"
 */

import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

async function findLead(searchTerm: string) {
  try {
    console.log(`\nSearching for: "${searchTerm}"\n`);

    // Search by multiple fields
    const leads = await prisma.lead.findMany({
      where: {
        OR: [
          { id: { contains: searchTerm, mode: "insensitive" } },
          { externalId: { contains: searchTerm, mode: "insensitive" } },
          { fineractAccountNo: { contains: searchTerm, mode: "insensitive" } },
          { fineractLoanId: isNaN(Number(searchTerm)) ? undefined : Number(searchTerm) },
          { firstname: { contains: searchTerm, mode: "insensitive" } },
          { lastname: { contains: searchTerm, mode: "insensitive" } },
          { mobileNo: { contains: searchTerm, mode: "insensitive" } },
        ].filter(Boolean),
      },
      select: {
        id: true,
        firstname: true,
        lastname: true,
        externalId: true,
        fineractAccountNo: true,
        fineractLoanId: true,
        fineractClientId: true,
        status: true,
        userId: true,
        createdByUserName: true,
        assignedToUserId: true,
        assignedToUserName: true,
        assignedAt: true,
        requestedAmount: true,
        loanSubmittedToFineract: true,
        createdAt: true,
      },
      take: 10,
    });

    if (leads.length === 0) {
      console.log("No leads found matching that search term.");
      return;
    }

    console.log(`Found ${leads.length} lead(s):\n`);

    for (const lead of leads) {
      console.log("=".repeat(60));
      console.log("Lead ID:", lead.id);
      console.log("Name:", [lead.firstname, lead.lastname].filter(Boolean).join(" ") || "(no name)");
      console.log("External ID:", lead.externalId || "(none)");
      console.log("Fineract Account No:", lead.fineractAccountNo || "(none)");
      console.log("Fineract Loan ID:", lead.fineractLoanId || "(none)");
      console.log("Fineract Client ID:", lead.fineractClientId || "(none)");
      console.log("Status:", lead.status);
      console.log("Requested Amount:", lead.requestedAmount);
      console.log("Submitted to Fineract:", lead.loanSubmittedToFineract);
      console.log("Created By (userId):", lead.userId || "(none)");
      console.log("Created By (userName):", lead.createdByUserName || "(none)");
      console.log("Assigned To (userId):", lead.assignedToUserId || "(not assigned)");
      console.log("Assigned To (userName):", lead.assignedToUserName || "(not assigned)");
      console.log("Assigned At:", lead.assignedAt || "(not assigned)");
      console.log("Created At:", lead.createdAt);
      console.log("");
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

const searchTerm = process.argv[2];

if (!searchTerm) {
  console.log("Usage: npx tsx scripts/find-lead.ts <search-term>");
  console.log("Example: npx tsx scripts/find-lead.ts '156789/46/1'");
  process.exit(1);
}

findLead(searchTerm);
