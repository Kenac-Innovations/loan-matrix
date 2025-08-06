import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const clientId = parseInt(id);

    if (isNaN(clientId)) {
      return NextResponse.json({ error: "Invalid client ID" }, { status: 400 });
    }

    const fineractService = await getFineractServiceWithSession();
    const loansResponse = await fineractService.getClientLoans(clientId);

    console.log("==========> log on server side getClientLoans response ::", loansResponse);

    // Handle different response formats from Fineract API
    let loans = [];
    if (Array.isArray(loansResponse)) {
      loans = loansResponse;
    } else if (loansResponse && Array.isArray((loansResponse as any).pageItems)) {
      loans = (loansResponse as any).pageItems;
    } else if (loansResponse && Array.isArray((loansResponse as any).content)) {
      loans = (loansResponse as any).content;
    } else if (loansResponse && Array.isArray((loansResponse as any).loanAccounts)) {
      loans = (loansResponse as any).loanAccounts;
    } else {
      console.warn("Unexpected loans response format:", loansResponse);
      loans = [];
    }

    return NextResponse.json(loans);
  } catch (error) {
    console.error("Failed to get client loans:", error);
    return NextResponse.json(
      { error: "Failed to get client loans" },
      { status: 500 }
    );
  }
}
