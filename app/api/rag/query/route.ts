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

    const { query } = await request.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required and must be a string" },
        { status: 400 }
      );
    }

    const ragService = getRAGService();
    const response = await ragService.generateResponse(
      query,
      session.user.email
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in RAG query:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
