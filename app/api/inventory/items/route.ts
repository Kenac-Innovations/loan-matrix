import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getTenantFromHeaders } from "@/lib/tenant-service";

function decimalToString(value: unknown): string {
  return value == null ? "0" : String(value);
}

function serializeItem(item: {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unitOfMeasure: string;
  defaultUnitValue: unknown;
  currencyCode: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...item,
    defaultUnitValue: decimalToString(item.defaultUnitValue),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function GET() {
  try {
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const items = await prisma.inventoryItem.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    return NextResponse.json(items.map(serializeItem));
  } catch (error) {
    console.error("Error fetching inventory items:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch inventory items",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const sku = String(body.sku ?? "").trim();
    const name = String(body.name ?? "").trim();
    const unitOfMeasure = String(body.unitOfMeasure ?? "").trim();
    const defaultUnitValue = String(body.defaultUnitValue ?? "").trim();
    const currencyCode = String(body.currencyCode ?? "USD").trim().toUpperCase();
    const description = String(body.description ?? "").trim();

    if (!sku || !name || !unitOfMeasure || !defaultUnitValue) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: sku, name, unitOfMeasure, defaultUnitValue",
        },
        { status: 400 }
      );
    }

    const item = await prisma.inventoryItem.create({
      data: {
        tenantId: tenant.id,
        sku,
        name,
        unitOfMeasure,
        defaultUnitValue,
        currencyCode,
        description: description || null,
      },
    });

    return NextResponse.json(serializeItem(item), { status: 201 });
  } catch (error) {
    console.error("Error creating inventory item:", error);
    return NextResponse.json(
      {
        error: "Failed to create inventory item",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
