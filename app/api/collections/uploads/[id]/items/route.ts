import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");

    const where: any = { uploadId: id };
    if (statusFilter) {
      const statuses = statusFilter.split(",").map((s) => s.trim());
      where.status = { in: statuses };
    }

    const items = await prisma.bulkRepaymentItem.findMany({
      where,
      orderBy: { rowNumber: "asc" },
    });

    return NextResponse.json({
      items: items.map((item) => ({
        ...item,
        amount: item.amount.toString(),
      })),
    });
  } catch (error) {
    console.error("Error fetching upload items:", error);
    return NextResponse.json(
      { error: "Failed to fetch items" },
      { status: 500 }
    );
  }
}
