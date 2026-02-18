import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const results = await prisma.$queryRaw`
    SELECT 
      ca.amount,
      ca."allocatedDate",
      ca."allocatedBy",
      ca.notes,
      t.name as teller_name,
      t."officeName",
      c."staffName" as cashier_name,
      ca.status
    FROM "CashAllocation" ca
    JOIN "Teller" t ON ca."tellerId" = t.id
    LEFT JOIN "Cashier" c ON ca."cashierId" = c.id
    WHERE t."officeName" ILIKE '%mazabuka%'
      AND ca.status = 'ACTIVE'
    ORDER BY ca."allocatedDate" DESC
  `;
  
  console.log("\n=== MAZABUKA CASH ALLOCATIONS ===\n");
  console.log(JSON.stringify(results, null, 2));
  
  // Also show summary
  const summary = await prisma.$queryRaw`
    SELECT 
      t."officeName",
      SUM(ca.amount) as total_allocated,
      COUNT(*) as allocation_count
    FROM "CashAllocation" ca
    JOIN "Teller" t ON ca."tellerId" = t.id
    WHERE t."officeName" ILIKE '%mazabuka%'
      AND ca.status = 'ACTIVE'
    GROUP BY t."officeName"
  `;
  
  console.log("\n=== SUMMARY ===\n");
  console.log(JSON.stringify(summary, null, 2));
  
  await prisma.$disconnect();
}

main().catch(console.error);
