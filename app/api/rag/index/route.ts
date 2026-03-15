import { NextRequest, NextResponse } from "next/server";
import { getRAGService } from "@/lib/rag-service";
import { getServerSession } from "next-auth";

export async function POST(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // TODO: Add admin role check here
    // For now, allow any authenticated user to trigger indexing

    const ragService = getRAGService();
    await ragService.indexFineractData();

    return NextResponse.json({
      message: "Fineract data indexing completed successfully",
    });
  } catch (error) {
    console.error("Error indexing Fineract data:", error);
    return NextResponse.json(
      { error: "Failed to index Fineract data" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Return indexing status or statistics
    const ragService = getRAGService();

    // Get document counts by type
    const stats = await ragService.getIndexingStats();

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error getting indexing stats:", error);
    return NextResponse.json(
      { error: "Failed to get indexing stats" },
      { status: 500 }
    );
  }
}
