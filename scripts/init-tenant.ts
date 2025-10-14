import { PrismaClient } from "../app/generated/prisma";
import { allTenantConfigs } from "../shared/defaults/tenants";

const prisma = new PrismaClient();

async function initTenant() {
  try {
    console.log("Initializing tenants...");

    for (const tenantConfig of allTenantConfigs) {
      // Check if tenant exists
      let tenant = await prisma.tenant.findUnique({
        where: { slug: tenantConfig.slug },
      });

      if (!tenant) {
        console.log(`Creating ${tenantConfig.name}...`);
        tenant = await prisma.tenant.create({
          data: tenantConfig,
        });
        console.log(`${tenantConfig.name} created:`, tenant);
      } else {
        console.log(`${tenantConfig.name} already exists:`, tenant);
      }
    }

    console.log("Tenant initialization completed successfully!");
  } catch (error) {
    console.error("Error initializing tenant:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

initTenant();
