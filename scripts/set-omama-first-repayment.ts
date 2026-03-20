/**
 * Sets the first repayment date strategy for the omama tenant
 * to "month-after-disbursement" (1 month after expected disbursement date).
 *
 * Run with: npx tsx scripts/set-omama-first-repayment.ts
 */
import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: "omama", isActive: true },
  });

  if (!tenant) {
    console.error("Tenant 'omama' not found");
    process.exit(1);
  }

  const currentSettings = (tenant.settings as any) || {};

  const updatedSettings = {
    ...currentSettings,
    firstRepaymentDate: {
      strategy: "month-after-disbursement",
    },
  };

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { settings: updatedSettings },
  });

  console.log("Updated omama tenant first repayment date settings:");
  console.log(JSON.stringify(updatedSettings.firstRepaymentDate, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
