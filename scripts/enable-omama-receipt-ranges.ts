/**
 * Enables the receiptRanges feature flag for the omama tenant.
 *
 * Run with: npx tsx scripts/enable-omama-receipt-ranges.ts
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
    features: {
      ...currentSettings.features,
      receiptRanges: true,
    },
  };

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { settings: updatedSettings },
  });

  console.log("Enabled receiptRanges feature for omama tenant");
  console.log(JSON.stringify(updatedSettings.features, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
