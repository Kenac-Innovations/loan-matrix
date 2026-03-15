import { PrismaClient } from "../app/generated/prisma";
import * as fs from "fs";

const prisma = new PrismaClient();

async function updateRejectedLeads() {
  try {
    console.log("Starting to update rejected leads...");

    // Read external IDs from file
    const externalIds = fs
      .readFileSync("/tmp/rejected_lead_ids.txt", "utf-8")
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

    // Find or create the "Rejected" pipeline stage
    let rejectedStage = await prisma.pipelineStage.findFirst({
      where: {
        tenantId: tenant.id,
        name: { contains: "Rejected", mode: "insensitive" },
      },
    });

    if (!rejectedStage) {
      // Check for "Declined" or similar
      rejectedStage = await prisma.pipelineStage.findFirst({
        where: {
          tenantId: tenant.id,
          name: { contains: "Declined", mode: "insensitive" },
        },
      });
    }

    if (!rejectedStage) {
      // List available stages
      const stages = await prisma.pipelineStage.findMany({
        where: { tenantId: tenant.id, isActive: true },
        orderBy: { order: "asc" },
      });

      console.log("\nAvailable pipeline stages:");
      stages.forEach((s) => console.log(`  - ${s.name} (${s.id})`));

      // Create the rejected stage if it doesn't exist
      const maxOrder = Math.max(...stages.map((s) => s.order), 0);
      rejectedStage = await prisma.pipelineStage.create({
        data: {
          tenantId: tenant.id,
          name: "Rejected",
          description: "Loan applications that were rejected",
          order: maxOrder + 1,
          color: "#EF4444", // Red color
          isActive: true,
          isFinalState: true,
          allowedTransitions: [],
        },
      });
      console.log(`\nCreated 'Rejected' pipeline stage: ${rejectedStage.id}`);
    } else {
      console.log(`Found 'Rejected' stage: ${rejectedStage.name} (${rejectedStage.id})`);
    }

    // Update leads in batches
    const batchSize = 50;
    let updated = 0;
    let notFound = 0;

    for (let i = 0; i < externalIds.length; i += batchSize) {
      const batch = externalIds.slice(i, i + batchSize);

      // First, find leads that exist
      const existingLeads = await prisma.lead.findMany({
        where: {
          id: { in: batch },
          tenantId: tenant.id,
        },
        select: { id: true },
      });

      const existingIds = existingLeads.map((l) => l.id);
      notFound += batch.length - existingIds.length;

      if (existingIds.length > 0) {
        // Update the leads to Rejected stage
        const result = await prisma.lead.updateMany({
          where: {
            id: { in: existingIds },
            tenantId: tenant.id,
          },
          data: {
            currentStageId: rejectedStage.id,
            status: "REJECTED",
            closedReason: "Loan rejected in Fineract",
          },
        });

        updated += result.count;

        // Create state transitions for each lead
        for (const leadId of existingIds) {
          await prisma.stateTransition.create({
            data: {
              leadId,
              tenantId: tenant.id,
              toStageId: rejectedStage.id,
              event: "LOAN_REJECTED",
              triggeredBy: "system",
              metadata: {
                source: "fineract_sync",
                syncedAt: new Date().toISOString(),
              },
            },
          });
        }
      }

      console.log(
        `Processed ${Math.min(i + batchSize, externalIds.length)}/${externalIds.length} - Updated: ${updated}, Not found: ${notFound}`
      );
    }

    console.log("\n=== Summary ===");
    console.log(`Total external IDs: ${externalIds.length}`);
    console.log(`Leads updated: ${updated}`);
    console.log(`Leads not found in local DB: ${notFound}`);
  } catch (error) {
    console.error("Error updating rejected leads:", error);
  } finally {
    await prisma.$disconnect();
  }
}

updateRejectedLeads();
