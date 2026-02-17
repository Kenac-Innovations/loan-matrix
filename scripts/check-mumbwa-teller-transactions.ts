import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("\n=== MUMBWA TELLER TRANSACTIONS ===\n");

  // 1. Find tellers for Mumbwa
  const tellers = await prisma.teller.findMany({
    where: {
      officeName: { contains: "mumbwa", mode: "insensitive" },
    },
    include: {
      bank: { select: { id: true, name: true, code: true, glAccountId: true, glAccountName: true } },
    },
  });

  if (tellers.length === 0) {
    // Try broader search
    const allTellers = await prisma.teller.findMany({
      where: {
        OR: [
          { officeName: { contains: "mumbwa", mode: "insensitive" } },
          { name: { contains: "mumbwa", mode: "insensitive" } },
          { description: { contains: "mumbwa", mode: "insensitive" } },
        ],
      },
      include: {
        bank: { select: { id: true, name: true, code: true, glAccountId: true, glAccountName: true } },
      },
    });
    
    if (allTellers.length === 0) {
      console.log("No tellers found for Mumbwa.");
      
      // Check if there's a bank for Mumbwa
      const banks = await prisma.bank.findMany({
        where: {
          OR: [
            { name: { contains: "mumbwa", mode: "insensitive" } },
            { code: { contains: "mumbwa", mode: "insensitive" } },
            { officeName: { contains: "mumbwa", mode: "insensitive" } },
            { glAccountName: { contains: "mumbwa", mode: "insensitive" } },
          ],
        },
      });
      console.log("\nBanks matching 'mumbwa':", JSON.stringify(banks, null, 2));
      await prisma.$disconnect();
      return;
    }
    
    tellers.push(...allTellers);
  }

  console.log(`Found ${tellers.length} teller(s) for Mumbwa:\n`);

  for (const teller of tellers) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Teller: ${teller.name}`);
    console.log(`  ID: ${teller.id}`);
    console.log(`  Fineract ID: ${teller.fineractTellerId}`);
    console.log(`  Office: ${teller.officeName} (ID: ${teller.officeId})`);
    console.log(`  Status: ${teller.status} | Active: ${teller.isActive}`);
    console.log(`  Bank: ${teller.bank?.name || "N/A"} (${teller.bank?.code || "N/A"})`);
    console.log(`  Bank GL: ${teller.bank?.glAccountName || "N/A"} (ID: ${teller.bank?.glAccountId || "N/A"})`);

    // 2. Get vault allocations (cashierId = null)
    const vaultAllocations = await prisma.cashAllocation.findMany({
      where: {
        tellerId: teller.id,
        cashierId: null,
        status: "ACTIVE",
      },
      orderBy: { allocatedDate: "asc" },
    });

    const vaultBalance = vaultAllocations.reduce((sum, a) => sum + a.amount, 0);
    console.log(`\n  VAULT (${vaultAllocations.length} allocations):`);
    console.log(`  Total Vault Balance: ${vaultBalance.toLocaleString()} ZMW`);
    
    for (const alloc of vaultAllocations) {
      const sign = alloc.amount >= 0 ? "+" : "";
      console.log(`    ${sign}${alloc.amount.toLocaleString()} ZMW | ${alloc.allocatedDate.toISOString().split("T")[0]} | By: ${alloc.allocatedBy} | ${alloc.notes || "(no notes)"}`);
    }

    // 3. Get cashier allocations
    const cashierAllocations = await prisma.cashAllocation.findMany({
      where: {
        tellerId: teller.id,
        cashierId: { not: null },
        status: "ACTIVE",
      },
      include: {
        cashier: { select: { staffName: true, fineractCashierId: true, status: true } },
      },
      orderBy: { allocatedDate: "asc" },
    });

    const totalCashierAllocated = cashierAllocations.reduce((sum, a) => sum + a.amount, 0);
    console.log(`\n  CASHIER ALLOCATIONS (${cashierAllocations.length} records):`);
    console.log(`  Total Allocated to Cashiers: ${totalCashierAllocated.toLocaleString()} ZMW`);
    
    for (const alloc of cashierAllocations) {
      const sign = alloc.amount >= 0 ? "+" : "";
      console.log(`    ${sign}${alloc.amount.toLocaleString()} ZMW | ${alloc.allocatedDate.toISOString().split("T")[0]} | Cashier: ${alloc.cashier?.staffName || "Unknown"} | ${alloc.notes || "(no notes)"}`);
    }

    // 4. Get cashiers
    const cashiers = await prisma.cashier.findMany({
      where: { tellerId: teller.id },
      include: {
        cashAllocations: { where: { status: "ACTIVE" } },
        sessions: { orderBy: { sessionStartTime: "desc" }, take: 3 },
      },
    });

    console.log(`\n  CASHIERS (${cashiers.length}):`);
    for (const cashier of cashiers) {
      const cashierBal = cashier.cashAllocations.reduce((sum, a) => sum + a.amount, 0);
      const latestSession = cashier.sessions[0];
      console.log(`    ${cashier.staffName} (Fineract: ${cashier.fineractCashierId}) | Status: ${cashier.status} | Balance: ${cashierBal.toLocaleString()} ZMW`);
      if (latestSession) {
        console.log(`      Latest Session: ${latestSession.sessionStatus} | Start: ${latestSession.sessionStartTime?.toISOString() || "N/A"} | CashIn: ${latestSession.cashIn} | CashOut: ${latestSession.cashOut}`);
      }
    }

    // 5. Get settlements
    const settlements = await prisma.cashSettlement.findMany({
      where: { tellerId: teller.id },
      include: {
        cashier: { select: { staffName: true } },
      },
      orderBy: { settlementDate: "desc" },
      take: 10,
    });

    console.log(`\n  RECENT SETTLEMENTS (${settlements.length}):`);
    for (const s of settlements) {
      console.log(`    ${s.settlementDate.toISOString().split("T")[0]} | ${s.cashier?.staffName || "?"} | Open: ${s.openingBalance.toLocaleString()} | Close: ${s.closingBalance.toLocaleString()} | Expected: ${s.expectedBalance.toLocaleString()} | Actual: ${s.actualBalance.toLocaleString()} | Variance: ${(s.actualBalance - s.expectedBalance).toLocaleString()} | Status: ${s.status}`);
    }

    // 6. Summary
    const availableBalance = vaultBalance - totalCashierAllocated;
    console.log(`\n  ═══════════════════════════════════════`);
    console.log(`  SUMMARY:`);
    console.log(`    Vault Balance:           ${vaultBalance.toLocaleString()} ZMW`);
    console.log(`    Allocated to Cashiers:   ${totalCashierAllocated.toLocaleString()} ZMW`);
    console.log(`    Available in Vault:      ${availableBalance.toLocaleString()} ZMW`);
    console.log(`  ═══════════════════════════════════════\n`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
