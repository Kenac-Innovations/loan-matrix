import { PrismaClient } from "../app/generated/prisma";
import * as fs from "fs";

const prisma = new PrismaClient();

async function updateApprovedLeads() {
  try {
    console.log("Starting to update approved leads...");

    // Read external IDs from file
    const externalIds = fs
      .readFileSync("/tmp/approved_lead_ids.txt", "utf-8")
      .split("\n")
      .filter((id) => id.trim() !== "");

    console.log(`Found ${externalIds.length} external IDs to update`);

    // Get the tenant (goodfellow)
    const tenant = await prisma.tenant.findFirst({
      where: { slug: "goodfellow", isActive: true },
    });

    if (!tenant) {
      console.error("Tenant 'goodfellow' not found!");
      return;
    }

    console.log(`Found tenant: ${tenant.name} (${tenant.id})`);

    // Find the "Approved" pipeline stage (use existing one we created)
    let approvedStage = await prisma.pipelineStage.findFirst({
      where: {
        tenantId: tenant.id,
        name: "Approved",
      },
    });

    if (!approvedStage) {
      console.error("Approved stage not found!");
      return;
    }

    console.log(`Found 'Approved' stage: ${approvedStage.name} (${approvedStage.id})`);

    // Update leads in larger batches - skip state transitions for speed
    const batchSize = 500;
    let updated = 0;
    let notFound = 0;

    for (let i = 0; i < externalIds.length; i += batchSize) {
      const batch = externalIds.slice(i, i + batchSize);

      // Update directly without checking existence first
      const result = await prisma.lead.updateMany({
        where: {
          id: { in: batch },
          tenantId: tenant.id,
        },
        data: {
          currentStageId: approvedStage.id,
          status: "APPROVED",
        },
      });

      updated += result.count;
      notFound += batch.length - result.count;

      console.log(
        `Processed ${Math.min(i + batchSize, externalIds.length)}/${externalIds.length} - Updated: ${updated}, Not found: ${notFound}`
      );
    }

    console.log("\n=== Summary ===");
    console.log(`Total external IDs: ${externalIds.length}`);
    console.log(`Leads updated: ${updated}`);
    console.log(`Leads not found in local DB: ${notFound}`);
  } catch (error) {
    console.error("Error updating approved leads:", error);
  } finally {
    await prisma.$disconnect();
  }
}

updateApprovedLeads();
