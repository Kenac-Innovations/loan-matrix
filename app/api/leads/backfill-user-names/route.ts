import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getFineractService } from "@/lib/fineract-api";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";

/**
 * POST /api/leads/backfill-user-names
 * Backfill existing leads with user names from Fineract
 * This is a one-time migration endpoint
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken =
      session.base64EncodedAuthenticationKey || session.accessToken;
    if (!accessToken) {
      return NextResponse.json(
        { error: "No access token available" },
        { status: 401 }
      );
    }

    // Get Fineract tenant ID
    const fineractTenantId = await getFineractTenantId();
    const fineractService = getFineractService(accessToken, fineractTenantId);

    // Fetch all users from Fineract
    console.log("Fetching users from Fineract...");
    const fineractUsers = await fineractService.getUsers();
    console.log(`Found ${fineractUsers.length} users in Fineract`);

    // Create a mapping of userId to user display name
    const userMap: Record<string, string> = {};
    for (const user of fineractUsers) {
      // userId in leads is stored as a string
      const userId = user.id.toString();
      // Create display name from firstname + lastname, or fall back to username
      const displayName =
        user.firstname && user.lastname
          ? `${user.firstname} ${user.lastname}`
          : user.username || `User ${userId}`;
      userMap[userId] = displayName;
    }

    console.log("User mapping created:", Object.keys(userMap).length, "users");

    // Find all leads without createdByUserName
    const leadsToUpdate = await prisma.lead.findMany({
      where: {
        createdByUserName: null,
        userId: { not: undefined },
      },
      select: {
        id: true,
        userId: true,
      },
    });

    console.log(`Found ${leadsToUpdate.length} leads to update`);

    // Update leads in batches
    let updatedCount = 0;
    let skippedCount = 0;
    const batchSize = 50;

    for (let i = 0; i < leadsToUpdate.length; i += batchSize) {
      const batch = leadsToUpdate.slice(i, i + batchSize);
      
      const updatePromises = batch.map(async (lead) => {
        const userName = userMap[lead.userId];
        if (userName) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { createdByUserName: userName },
          });
          return { updated: true };
        }
        return { updated: false };
      });

      const results = await Promise.all(updatePromises);
      updatedCount += results.filter((r) => r.updated).length;
      skippedCount += results.filter((r) => !r.updated).length;

      console.log(
        `Processed batch ${Math.floor(i / batchSize) + 1}: ${updatedCount} updated, ${skippedCount} skipped`
      );
    }

    return NextResponse.json({
      success: true,
      message: `Backfill complete`,
      stats: {
        totalLeads: leadsToUpdate.length,
        updated: updatedCount,
        skipped: skippedCount,
        totalFineractUsers: fineractUsers.length,
      },
    });
  } catch (error) {
    console.error("Error backfilling user names:", error);
    return NextResponse.json(
      {
        error: "Failed to backfill user names",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/leads/backfill-user-names
 * Check the status of leads that need backfilling
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Count leads without createdByUserName
    const leadsWithoutUserName = await prisma.lead.count({
      where: {
        createdByUserName: null,
      },
    });

    // Count leads with createdByUserName
    const leadsWithUserName = await prisma.lead.count({
      where: {
        createdByUserName: { not: null },
      },
    });

    return NextResponse.json({
      leadsWithoutUserName,
      leadsWithUserName,
      totalLeads: leadsWithoutUserName + leadsWithUserName,
      needsBackfill: leadsWithoutUserName > 0,
    });
  } catch (error) {
    console.error("Error checking backfill status:", error);
    return NextResponse.json(
      { error: "Failed to check backfill status" },
      { status: 500 }
    );
  }
}
