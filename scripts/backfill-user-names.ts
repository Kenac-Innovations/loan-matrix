/**
 * Script to backfill existing leads with user names from Fineract
 * Run with: npx tsx scripts/backfill-user-names.ts
 */

import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

// Fineract configuration from environment
const FINERACT_BASE_URL = process.env.FINERACT_BASE_URL || "http://10.10.0.143";
// Force goodfellow tenant for user lookup
const FINERACT_TENANT_ID = "goodfellow";
const FINERACT_USERNAME = process.env.FINERACT_USERNAME || "mifos";
const FINERACT_PASSWORD = process.env.FINERACT_PASSWORD || "password";

async function fetchFineractUsers(): Promise<any[]> {
  const authToken = Buffer.from(
    `${FINERACT_USERNAME}:${FINERACT_PASSWORD}`
  ).toString("base64");

  const response = await fetch(
    `${FINERACT_BASE_URL}/fineract-provider/api/v1/users`,
    {
      headers: {
        Authorization: `Basic ${authToken}`,
        "Fineract-Platform-TenantId": FINERACT_TENANT_ID,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function main() {
  console.log("Starting backfill of user names...");
  console.log(`Fineract URL: ${FINERACT_BASE_URL}`);
  console.log(`Fineract Tenant: ${FINERACT_TENANT_ID}`);

  try {
    // Fetch all users from Fineract
    console.log("\nFetching users from Fineract...");
    const fineractUsers = await fetchFineractUsers();
    console.log(`Found ${fineractUsers.length} users in Fineract`);

    // Create a mapping of userId to user display name
    const userMap: Record<string, string> = {};
    for (const user of fineractUsers) {
      const userId = user.id.toString();
      const displayName =
        user.firstname && user.lastname
          ? `${user.firstname} ${user.lastname}`
          : user.username || `User ${userId}`;
      userMap[userId] = displayName;
      console.log(`  User ${userId}: ${displayName}`);
    }

    // Find all leads without createdByUserName
    console.log("\nFinding leads without user names...");
    const leadsToUpdate = await prisma.lead.findMany({
      where: {
        createdByUserName: null,
      },
      select: {
        id: true,
        userId: true,
      },
    });

    console.log(`Found ${leadsToUpdate.length} leads to update`);

    if (leadsToUpdate.length === 0) {
      console.log("No leads need updating. Exiting.");
      return;
    }

    // Update leads
    let updatedCount = 0;
    let skippedCount = 0;

    for (const lead of leadsToUpdate) {
      const userName = userMap[lead.userId];
      if (userName) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { createdByUserName: userName },
        });
        updatedCount++;
        console.log(`  Updated lead ${lead.id}: ${userName}`);
      } else {
        skippedCount++;
        console.log(`  Skipped lead ${lead.id}: No user found for userId ${lead.userId}`);
      }
    }

    console.log("\n=== Backfill Complete ===");
    console.log(`Total leads processed: ${leadsToUpdate.length}`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped (no matching user): ${skippedCount}`);
  } catch (error) {
    console.error("Error during backfill:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
