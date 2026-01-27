import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

/**
 * GET /api/fineract/glaccounts/[id]/balance
 * Get the running balance for a GL account from Fineract
 * 
 * This fetches the latest journal entry with running balance to get the current account balance
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const glAccountId = resolvedParams.id;

    // Fetch journal entries for this GL account with running balance
    // Sort by date descending and limit to 1 to get the most recent balance
    const journalData = await fetchFineractAPI(
      `/journalentries?glAccountId=${glAccountId}&runningBalance=true&limit=1&orderBy=id&sortOrder=DESC`
    );

    let balance = 0;
    let currency = "ZMW";

    if (journalData?.pageItems && journalData.pageItems.length > 0) {
      const latestEntry = journalData.pageItems[0];
      balance = latestEntry.organizationRunningBalance || latestEntry.officeRunningBalance || 0;
      currency = latestEntry.currency?.code || "ZMW";
    }

    // Also fetch the GL account details to get account info
    const glAccount = await fetchFineractAPI(`/glaccounts/${glAccountId}`);

    return NextResponse.json({
      glAccountId: parseInt(glAccountId),
      glAccountName: glAccount?.name,
      glAccountCode: glAccount?.glCode,
      balance,
      currency,
      accountType: glAccount?.type?.value,
    });
  } catch (error: any) {
    console.error("Error fetching GL account balance:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch GL account balance" },
      { status: 500 }
    );
  }
}
