import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const loanId = parseInt(id);

    if (isNaN(loanId)) {
      return NextResponse.json({ error: "Invalid loan ID" }, { status: 400 });
    }

    const fineractService = await getFineractServiceWithSession();
    const loanResponse = await fineractService.getLoan(loanId);

    console.log("==========> log on server side getLoan response ::", loanResponse);

    return NextResponse.json(loanResponse);
  } catch (error) {
    console.error("Failed to get loan details:", error);
    return NextResponse.json(
      { error: "Failed to get loan details" },
      { status: 500 }
    );
  }
} 