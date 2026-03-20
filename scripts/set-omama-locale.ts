/**
 * Sets the locale settings for the omama tenant.
 * Run with: npx tsx scripts/set-omama-locale.ts
 */
import { PrismaClient } from "@prisma/client";

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
    locale: {
      countryCode: "+263",
      countryName: "Zimbabwe",
      countryIso: "ZW",
      phoneDigits: 9,
      phoneFormat: "XX XXX XXXX",
      phonePlaceholder: "771234567",
    },
  };

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { settings: updatedSettings },
  });

  console.log("Updated omama tenant locale settings:");
  console.log(JSON.stringify(updatedSettings.locale, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
