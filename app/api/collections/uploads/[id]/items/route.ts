import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");
    const reversalStatusFilter = searchParams.get("reversalStatus");
    const filterMode = searchParams.get("mode") === "or" ? "or" : "and";

    const statusValues = statusFilter
      ? statusFilter.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    const reversalStatusValues = reversalStatusFilter
      ? reversalStatusFilter.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const where: Prisma.BulkRepaymentItemWhereInput = { uploadId: id };

    if (statusValues.length > 0 && reversalStatusValues.length > 0) {
      if (filterMode === "or") {
        where.OR = [
          { status: { in: statusValues } },
          { reversalStatus: { in: reversalStatusValues } },
        ];
      } else {
        where.status = { in: statusValues };
        where.reversalStatus = { in: reversalStatusValues };
      }
    } else if (statusValues.length > 0) {
      where.status = { in: statusValues };
    } else if (reversalStatusValues.length > 0) {
      where.reversalStatus = { in: reversalStatusValues };
    }

    const items = await prisma.bulkRepaymentItem.findMany({
      where,
      orderBy: [{ rowNumber: "asc" }],
    });

    return NextResponse.json({
      items: items.map((item) => ({
        ...item,
        amount: item.amount.toString(),
        reversalStatus: item.reversalStatus ?? null,
        reversalErrorMessage: item.reversalErrorMessage ?? null,
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
