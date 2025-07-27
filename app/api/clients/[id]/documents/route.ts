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

    // Note: This would need a getClientDocuments method in the service
    // For now, return empty array as documents endpoint needs to be implemented
    const documents: any[] = [];

    return NextResponse.json(documents);
  } catch (error) {
    console.error("Failed to get client documents:", error);
    return NextResponse.json(
      { error: "Failed to get client documents" },
      { status: 500 }
    );
  }
}
