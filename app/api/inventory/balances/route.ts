import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getTenantFromHeaders } from "@/lib/tenant-service";

function toNumber(value: unknown): number {
  return Number(String(value ?? "0"));
}

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

    const balances = await prisma.inventoryBalance.findMany({
      where: {
        tenantId: tenant.id,
        ...(officeId ? { fineractOfficeId: Number(officeId) } : {}),
      },
      include: {
        inventoryItem: {
          select: {
            id: true,
            sku: true,
            name: true,
            unitOfMeasure: true,
            currencyCode: true,
            defaultUnitValue: true,
          },
        },
      },
      orderBy: [{ fineractOfficeId: "asc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json(
      balances.map((balance) => {
        const onHand = toNumber(balance.quantityOnHand);
        const reserved = toNumber(balance.quantityReserved);

        return {
          id: balance.id,
          inventoryItemId: balance.inventoryItemId,
          fineractOfficeId: balance.fineractOfficeId,
          fineractOfficeName: balance.fineractOfficeName,
          quantityOnHand: toStringValue(balance.quantityOnHand),
          quantityReserved: toStringValue(balance.quantityReserved),
          availableQuantity: String(onHand - reserved),
          stockValue: toStringValue(balance.stockValue),
          currencyCode: balance.currencyCode,
          updatedAt: balance.updatedAt.toISOString(),
          item: {
            ...balance.inventoryItem,
            defaultUnitValue: toStringValue(balance.inventoryItem.defaultUnitValue),
          },
        };
      })
    );
  } catch (error) {
    console.error("Error fetching inventory balances:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch inventory balances",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
