import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getTenantFromHeaders } from "@/lib/tenant-service";

function toStringValue(value: unknown): string {
  return value == null ? "0" : String(value);
}

export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const officeId = searchParams.get("officeId");
    const inventoryItemId = searchParams.get("inventoryItemId");
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);

    const movements = await prisma.inventoryMovement.findMany({
      where: {
        tenantId: tenant.id,
        ...(officeId ? { fineractOfficeId: Number(officeId) } : {}),
        ...(inventoryItemId ? { inventoryItemId } : {}),
      },
      include: {
        inventoryItem: {
          select: {
            id: true,
            sku: true,
            name: true,
            unitOfMeasure: true,
            currencyCode: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json(
      movements.map((movement) => ({
        id: movement.id,
        type: movement.type,
        fineractOfficeId: movement.fineractOfficeId,
        fineractOfficeName: movement.fineractOfficeName,
        quantityDelta: toStringValue(movement.quantityDelta),
        valueDelta: toStringValue(movement.valueDelta),
        currencyCode: movement.currencyCode,
        reason: movement.reason,
        actorUserId: movement.actorUserId,
        actorUserName: movement.actorUserName,
        fineractLoanId: movement.fineractLoanId,
        stockLoanIssueId: movement.stockLoanIssueId,
        createdAt: movement.createdAt.toISOString(),
        item: movement.inventoryItem,
      }))
    );
  } catch (error) {
    console.error("Error fetching inventory movements:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch inventory movements",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
