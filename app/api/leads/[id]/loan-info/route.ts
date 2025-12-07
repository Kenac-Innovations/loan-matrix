import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/leads/[id]/loan-info
 * Fetches complete loan information for a lead
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: leadId } = params;

    console.log("Fetching loan info for lead:", leadId);

    // Fetch the lead
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        fineractClientId: true,
        fineractLoanId: true,
        stateMetadata: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Parse state metadata to get loan details and terms
    const stateMetadata = lead.stateMetadata as any;
    const loanDetails = stateMetadata?.loanDetails || null;
    const loanTerms = stateMetadata?.loanTerms || null;
    const repaymentSchedule = stateMetadata?.repaymentSchedule || null;
    const signatures = stateMetadata?.signatures || null;

    return NextResponse.json({
      fineractClientId: lead.fineractClientId,
      fineractLoanId: lead.fineractLoanId,
      loanDetails,
      loanTerms,
      repaymentSchedule,
      signatures,
    });
  } catch (error) {
    console.error("Error fetching loan info:", error);
    return NextResponse.json(
      { error: "Failed to fetch loan information" },
      { status: 500 }
    );
  }
}

