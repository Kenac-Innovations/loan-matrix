import { NextRequest, NextResponse } from "next/server";
import { getRAGService } from "@/lib/rag-service";
import { getServerSession } from "next-auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get user session
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, content, metadata } = await request.json();
    const { id } = params;

    const ragService = getRAGService();
    await ragService.updatePolicyDocument(id, title, content, metadata);

    return NextResponse.json({
      message: "Policy document updated successfully",
    });
  } catch (error) {
    console.error("Error updating policy document:", error);
    return NextResponse.json(
      { error: "Failed to update policy document" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get user session
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const ragService = getRAGService();
    await ragService.deletePolicyDocument(id);

    return NextResponse.json({
      message: "Policy document deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting policy document:", error);
    return NextResponse.json(
      { error: "Failed to delete policy document" },
      { status: 500 }
    );
  }
}
