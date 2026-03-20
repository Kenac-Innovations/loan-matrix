import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";

export async function GET() {
  try {
    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const ranges = await prisma.receiptRange.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
    });

    const usedCounts = await Promise.all(
      ranges.map((r) =>
        prisma.usedReceipt.count({ where: { tenantId: tenant.id } })
      )
    );

    const rangesWithStats = ranges.map((range, i) => ({
      ...range,
      totalInRange: range.rangeEnd - range.rangeStart + 1,
      usedCount: usedCounts[i],
    }));

    return NextResponse.json({ ranges: rangesWithStats });
  } catch (error) {
    console.error("Error fetching receipt ranges:", error);
    return NextResponse.json(
      { error: "Failed to fetch receipt ranges" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await request.json();
    const { prefix, rangeStart, rangeEnd } = body;

    if (!rangeStart || !rangeEnd || rangeStart >= rangeEnd) {
      return NextResponse.json(
        { error: "Invalid range: start must be less than end" },
        { status: 400 }
      );
    }

    // Check for overlapping active ranges
    const overlapping = await prisma.receiptRange.findFirst({
      where: {
        tenantId: tenant.id,
        isActive: true,
        OR: [
          { rangeStart: { lte: rangeEnd }, rangeEnd: { gte: rangeStart } },
        ],
      },
    });

    if (overlapping) {
      return NextResponse.json(
        {
          error: `Overlaps with existing range ${overlapping.prefix ?? ""}${overlapping.rangeStart}–${overlapping.rangeEnd}`,
        },
        { status: 409 }
      );
    }

    const range = await prisma.receiptRange.create({
      data: {
        tenantId: tenant.id,
        prefix: prefix || null,
        rangeStart,
        rangeEnd,
      },
    });

    return NextResponse.json({ range }, { status: 201 });
  } catch (error) {
    console.error("Error creating receipt range:", error);
    return NextResponse.json(
      { error: "Failed to create receipt range" },
      { status: 500 }
    );
  }
}
