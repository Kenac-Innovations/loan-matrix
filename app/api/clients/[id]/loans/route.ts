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
    const loans = await fineractService.getClientLoans(clientId);

    return NextResponse.json(loans);
  } catch (error) {
    console.error("Failed to get client loans:", error);
    return NextResponse.json(
      { error: "Failed to get client loans" },
      { status: 500 }
    );
  }
}
