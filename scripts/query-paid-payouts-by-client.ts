/**
 * Query Loan Matrix DB for all paid-out loans for a given client.
 * Client can be identified by NRC (e.g. 367789/67/1) if it appears in clientName,
 * or by Fineract client ID via env FINERACT_CLIENT_ID.
 *
 * Usage:
 *   npx tsx scripts/query-paid-payouts-by-client.ts 367789/67/1
 *   FINERACT_CLIENT_ID=12345 npx tsx scripts/query-paid-payouts-by-client.ts
 *
 * Requires: DATABASE_URL
 */

import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const nrcOrIdentifier = process.argv[2] || process.env.CLIENT_IDENTIFIER;
  const fineractClientIdEnv = process.env.FINERACT_CLIENT_ID;

  if (!nrcOrIdentifier && !fineractClientIdEnv) {
    console.error("Usage: npx tsx scripts/query-paid-payouts-by-client.ts <NRC_or_identifier>");
    console.error("   or: FINERACT_CLIENT_ID=<id> npx tsx scripts/query-paid-payouts-by-client.ts");
    process.exit(1);
  }

  const fineractClientId = fineractClientIdEnv ? parseInt(fineractClientIdEnv, 10) : null;
  const searchTerm = nrcOrIdentifier?.trim() || "";

  console.log("Loan Matrix DB – paid-out loans for client:", searchTerm || `fineractClientId=${fineractClientId}`);
  console.log("");

  const where: { status: string; tenantId?: string; OR?: Array<{ clientName?: { contains: string; mode: "insensitive" }; fineractClientId?: number }> } = {
    status: "PAID",
  };

  if (fineractClientId != null && !Number.isNaN(fineractClientId)) {
    where.fineractClientId = fineractClientId;
  } else if (searchTerm) {
    where.OR = [
      { clientName: { contains: searchTerm, mode: "insensitive" } },
      { loanAccountNo: { contains: searchTerm, mode: "insensitive" } },
    ];
  }

  const payouts = await prisma.loanPayout.findMany({
    where,
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
  });

  if (payouts.length === 0) {
    console.log("No PAID payouts found.");
    if (searchTerm && !fineractClientIdEnv) {
      console.log("Tip: If 367789/67/1 is the NRC, Loan Matrix may store only client name.");
      console.log("     Find Fineract client ID for this NRC, then run:");
      console.log("     FINERACT_CLIENT_ID=<id> npx tsx scripts/query-paid-payouts-by-client.ts");
    }
    return;
  }

  console.log(`Found ${payouts.length} paid-out loan(s):\n`);
  console.log("─".repeat(100));

  for (const p of payouts) {
    console.log({
      loanAccountNo: p.loanAccountNo,
      fineractLoanId: p.fineractLoanId,
      fineractClientId: p.fineractClientId,
      clientName: p.clientName,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      paidAt: p.paidAt?.toISOString() ?? null,
      paidBy: p.paidBy ?? null,
      paymentMethod: p.paymentMethod ?? null,
      cashierId: p.cashierId ?? null,
      createdAt: p.createdAt?.toISOString(),
    });
    console.log("─".repeat(100));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
