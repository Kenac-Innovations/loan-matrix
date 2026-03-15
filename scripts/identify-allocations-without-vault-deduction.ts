/**
 * Identify transactions where we gave the cashier money but did not deduct from the teller vault.
 *
 * When allocating to a cashier, we create:
 *   - CashAllocation(cashierId: set, amount: +X) — money to cashier
 * We do NOT create:
 *   - CashAllocation(cashierId: null, amount: -X) — deduction from teller vault
 *
 * This script lists all cashier allocations (gave cashier money) and checks whether
 * a corresponding negative vault allocation exists. If not, it's "allocated but not deducted."
 *
 * Run: npx tsx scripts/identify-allocations-without-vault-deduction.ts
 */

import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  // All allocations TO cashiers (we gave them money)
  const cashierAllocations = await prisma.cashAllocation.findMany({
    where: {
      cashierId: { not: null },
      amount: { gt: 0 },
      status: "ACTIVE",
      notes: { not: { contains: "Variance" } },
    },
    include: {
      teller: { select: { id: true, name: true, fineractTellerId: true } },
      cashier: { select: { id: true, staffName: true, fineractCashierId: true } },
    },
    orderBy: { allocatedDate: "asc" },
  });

  const allocationsWithoutDeduction: typeof cashierAllocations = [];
  const allocationsWithDeduction: typeof cashierAllocations = [];

  for (const alloc of cashierAllocations) {
    // Check for a corresponding negative vault allocation (cashierId: null) on the same teller
    // within the same day, amount = -alloc.amount
    const allocDate = new Date(alloc.allocatedDate);
    const dayStart = new Date(allocDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(allocDate);
    dayEnd.setHours(23, 59, 59, 999);

    const vaultDeduction = await prisma.cashAllocation.findFirst({
      where: {
        tellerId: alloc.tellerId,
        tenantId: alloc.tenantId,
        cashierId: null,
        amount: {
          gte: -alloc.amount - 0.01,
          lte: -alloc.amount + 0.01,
        },
        status: "ACTIVE",
        allocatedDate: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    });

    if (!vaultDeduction) {
      allocationsWithoutDeduction.push(alloc);
    } else {
      allocationsWithDeduction.push(alloc);
    }
  }

  const totalWithoutDeduction = allocationsWithoutDeduction.reduce(
    (sum, a) => sum + a.amount,
    0
  );
  const totalWithDeduction = allocationsWithDeduction.reduce(
    (sum, a) => sum + a.amount,
    0
  );

  console.log("=== Allocations to Cashiers Without Vault Deduction ===\n");
  console.log(
    `Found ${allocationsWithoutDeduction.length} allocation(s) where we gave the cashier money but did NOT deduct from the teller vault.\n`
  );
  console.log(`Total amount not deducted: ${totalWithoutDeduction.toFixed(2)}\n`);

  if (allocationsWithoutDeduction.length > 0) {
    console.log("Details:\n");
    for (const a of allocationsWithoutDeduction) {
      console.log(`  ID: ${a.id}`);
      console.log(`  Teller: ${a.teller?.name} (${a.teller?.id})`);
      console.log(`  Cashier: ${a.cashier?.staffName} (${a.cashier?.id})`);
      console.log(`  Amount: ${a.amount} ${a.currency}`);
      console.log(`  Date: ${a.allocatedDate.toISOString()}`);
      console.log(`  Notes: ${a.notes || "(none)"}`);
      console.log("");
    }
  }

  console.log("--- Summary ---");
  console.log(
    `Without vault deduction: ${allocationsWithoutDeduction.length} (${totalWithoutDeduction.toFixed(2)} total)`
  );
  console.log(
    `With vault deduction: ${allocationsWithDeduction.length} (${totalWithDeduction.toFixed(2)} total)`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
