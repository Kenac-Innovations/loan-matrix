#!/usr/bin/env tsx

/**
 * Database initialization script for cluster deployment
 * This script ensures the default tenant and required data exists
 */

import { PrismaClient } from "../app/generated/prisma";
import { getOrCreateDefaultTenant } from "../lib/tenant-service";

const prisma = new PrismaClient();

async function initializeDatabase() {
  try {
    console.log("🚀 Starting database initialization...");

    // Test database connection
    await prisma.$connect();
    console.log("✅ Database connection established");

    // Create or get default tenant
    console.log("🌱 Setting up default tenant...");
    const tenant = await getOrCreateDefaultTenant();
    console.log(`✅ Default tenant ready: ${tenant.name} (${tenant.slug})`);

    // Check if pipeline stages exist
    const existingStages = await prisma.pipelineStage.findMany({
      where: { tenantId: tenant.id },
    });

    if (existingStages.length === 0) {
      console.log("🌱 Creating default pipeline stages...");
      const { createDefaultPipelineStages } = await import(
        "../lib/tenant-service"
      );
      await createDefaultPipelineStages(tenant.id);
      console.log("✅ Default pipeline stages created");
    } else {
      console.log(
        `✅ Pipeline stages already exist (${existingStages.length} stages)`
      );
    }

    // Check if teams exist
    const existingTeams = await prisma.team.findMany({
      where: { tenantId: tenant.id },
    });

    if (existingTeams.length === 0) {
      console.log("🌱 Creating default team...");
      const defaultTeam = await prisma.team.create({
        data: {
          name: "Default Team",
          description: "Default team for the organization",
          tenantId: tenant.id,
          isActive: true,
        },
      });
      console.log(`✅ Default team created: ${defaultTeam.name}`);
    } else {
      console.log(`✅ Teams already exist (${existingTeams.length} teams)`);
    }

    console.log("🎉 Database initialization completed successfully!");
    return true;
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("❌ Initialization script failed:", error);
      process.exit(1);
    });
}

export { initializeDatabase };
