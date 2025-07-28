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
    const transactions = await fineractService.getClientTransactions(clientId);

    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Failed to get client transactions:", error);
    return NextResponse.json(
      { error: "Failed to get client transactions" },
      { status: 500 }
    );
  }
}
