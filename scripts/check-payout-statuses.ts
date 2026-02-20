#!/usr/bin/env tsx
/**
 * Check LoanPayout status values in the Loan Matrix DB.
 * Run: npx tsx scripts/check-payout-statuses.ts
 */

import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const counts = await prisma.loanPayout.groupBy({
    by: ["status"],
    _count: { status: true },
  });

  console.log("LoanPayout.status values in DB:\n");
  if (counts.length === 0) {
    console.log("  (no rows in LoanPayout)");
  } else {
    for (const row of counts) {
      const repr = JSON.stringify(row.status);
      console.log(`  ${repr}  →  ${row._count.status} row(s)`);
    }
  }

  // Show a few sample rows with non-PENDING status so we see exact strings
  const samples = await prisma.loanPayout.findMany({
    take: 5,
    where: { status: { not: "PENDING" } },
    select: { id: true, fineractLoanId: true, status: true, paidAt: true },
  });
  if (samples.length > 0) {
    console.log("\nSample paid/voided rows (exact status string):");
    samples.forEach((s) => console.log(`  id=${s.id.slice(0, 8)}... fineractLoanId=${s.fineractLoanId} status=${JSON.stringify(s.status)} paidAt=${s.paidAt}`));
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
