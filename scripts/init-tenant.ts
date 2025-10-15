import { PrismaClient } from "../app/generated/prisma";
import { allTenantConfigs } from "../shared/defaults/tenants";

const prisma = new PrismaClient();

async function initTenant() {
  try {
    console.log("Initializing tenants...");

    // Check if default tenant exists
    let tenant = await prisma.tenant.findUnique({
      where: { slug: "default" },
    });

    if (!tenant) {
      console.log("Creating default tenant...");
      tenant = await prisma.tenant.create({
        data: {
          name: "Default Organization",
          slug: "goodfellow",
          domain: "localhost",
          settings: {
            theme: "default",
            features: {
              statemachine: true,
              notifications: true,
            },
          },
        },
      });
      console.log("Default tenant created:", tenant);
    } else {
      console.log("Default tenant already exists:", tenant);
    }

    // Also create a demo tenant if it doesn't exist
    let demoTenant = await prisma.tenant.findUnique({
      where: { slug: "demo" },
    });

    if (!demoTenant) {
      console.log("Creating demo tenant...");
      demoTenant = await prisma.tenant.create({
        data: {
          name: "Demo Organization",
          slug: "demo",
          domain: "demo.localhost",
          settings: {
            theme: "default",
            features: {
              statemachine: true,
              notifications: true,
            },
          },
        },
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
