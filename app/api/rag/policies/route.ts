import { NextRequest, NextResponse } from "next/server";
import { getRAGService } from "@/lib/rag-service";
import { getServerSession } from "next-auth";

export async function GET(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ragService = getRAGService();
    const policies = await ragService.getPolicyDocuments();

    return NextResponse.json(policies);
  } catch (error) {
    console.error("Error fetching policy documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch policy documents" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, content, metadata } = await request.json();

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    const ragService = getRAGService();
    await ragService.addPolicyDocument(title, content, metadata);

    return NextResponse.json({
      message: "Policy document added successfully",
    });
  } catch (error) {
    console.error("Error adding policy document:", error);
    return NextResponse.json(
      { error: "Failed to add policy document" },
      { status: 500 }
    );
  }
}
