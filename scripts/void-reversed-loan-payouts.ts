/**
 * Mark Loan Matrix payouts as REVERSED for disbursements that were reversed in Fineract.
 * Reversals show in cashier transaction history (Cash In). Cashier: Chileshe Mingochi - Kafue.
 *
 * Reversed in Fineract:
 * - 349967/16/1 Mocris Muma K600  (fineractLoanId 101756) reversed 2026-02-10
 * - 167803/18/1 Chiteta Chinyama K5000 (fineractLoanId 95682) reversed 2026-02-11
 */

import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

const GOODFELLOW_TENANT_ID = "cmh607k3d0000vc0k5xxjocsi";
const REVERSED_BY = "Chileshe Mingochi - Kafue";
const REVERSAL_REASON =
  "Reversed in Fineract; cashier credited (reversal script)";

const REVERSED_PAYOUTS: { fineractLoanId: number; reversedAt: Date }[] = [
  { fineractLoanId: 101756, reversedAt: new Date("2026-02-10") }, // Mocris Muma K600
  { fineractLoanId: 95682, reversedAt: new Date("2026-02-11") },   // Chiteta Chinyama K5000
];

async function main() {
  console.log("Marking reversed loan payouts in Loan Matrix (REVERSED status)...\n");

  for (const { fineractLoanId, reversedAt } of REVERSED_PAYOUTS) {
    const existing = await prisma.loanPayout.findFirst({
      where: {
        tenantId: GOODFELLOW_TENANT_ID,
        fineractLoanId,
      },
    });

    if (!existing) {
      console.log(
        `  Skip fineractLoanId ${fineractLoanId}: no LoanPayout found.`
      );
      continue;
    }

    if (existing.status === "REVERSED") {
      console.log(
        `  Skip fineractLoanId ${fineractLoanId} (${existing.clientName} ${existing.amount}): already REVERSED.`
      );
      continue;
    }

    const updated = await prisma.loanPayout.update({
      where: { id: existing.id },
      data: {
        status: "REVERSED",
        voidedAt: reversedAt,
        voidedBy: REVERSED_BY,
        voidReason: REVERSAL_REASON,
      },
    });

    console.log(
      `  Reversed: fineractLoanId ${fineractLoanId} | ${updated.clientName} | ${updated.amount} ${updated.currency} | reversedAt ${updated.voidedAt?.toISOString()}`
    );
  }

  console.log("\nDone. Reversals will appear in cashier transaction history.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
