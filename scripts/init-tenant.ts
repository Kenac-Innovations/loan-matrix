import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

async function initTenant() {
  try {
    console.log("Initializing tenant...");

    // Check if default tenant exists
    let tenant = await prisma.tenant.findUnique({
      where: { slug: "default" },
    });

    if (!tenant) {
      console.log("Creating default tenant...");
      tenant = await prisma.tenant.create({
        data: {
          name: "Default Organization",
          slug: "default",
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
      console.log("Demo tenant created:", demoTenant);
    } else {
      console.log("Demo tenant already exists:", demoTenant);
    }

    // Create goodfellow tenant for production
    let goodfellowTenant = await prisma.tenant.findUnique({
      where: { slug: "goodfellow" },
    });

    if (!goodfellowTenant) {
      console.log("Creating goodfellow tenant...");
      goodfellowTenant = await prisma.tenant.create({
        data: {
          name: "GoodFellow Organization",
          slug: "goodfellow",
          domain: "goodfellow.kenacloanmatrix.com",
          settings: {
            theme: "default",
            features: {
              statemachine: true,
              notifications: true,
            },
          },
        },
      });
      console.log("GoodFellow tenant created:", goodfellowTenant);
    } else {
      console.log("GoodFellow tenant already exists:", goodfellowTenant);
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
