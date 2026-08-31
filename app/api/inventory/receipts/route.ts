import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import {
  InventoryLedgerServiceError,
  receiveInventory,
  type InventoryDb,
} from "@/lib/inventory/inventory-ledger-service";

function sessionUserValue(session: Awaited<ReturnType<typeof getSession>>, key: string) {
  return (session?.user as Record<string, unknown> | undefined)?.[key];
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
    const inventoryItemId = String(body.inventoryItemId ?? "").trim();
    const fineractOfficeId = Number(body.fineractOfficeId);
    const fineractOfficeName = String(body.fineractOfficeName ?? "").trim();
    const quantity = String(body.quantity ?? "").trim();
    const value = String(body.value ?? "").trim();
    const currencyCode = String(body.currencyCode ?? "USD").trim().toUpperCase();
    const reason = String(body.reason ?? "").trim();
    const idempotencyKey =
      typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
        ? body.idempotencyKey.trim()
        : `inventory-receipt:${tenant.id}:${randomUUID()}`;

    if (!inventoryItemId || !Number.isInteger(fineractOfficeId) || !quantity || !value) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: inventoryItemId, fineractOfficeId, quantity, value",
        },
        { status: 400 }
      );
    }

    const result = await receiveInventory(prisma as unknown as InventoryDb, {
      tenantId: tenant.id,
      inventoryItemId,
      fineractOfficeId,
      fineractOfficeName,
      quantity,
      value,
      currencyCode,
      idempotencyKey,
      actorUserId: String(sessionUserValue(session, "userId") ?? session.user.id),
      actorUserName: String(sessionUserValue(session, "name") ?? session.user.name ?? ""),
      reason: reason || "Stock received into branch inventory",
    });

    return NextResponse.json(result, {
      status: result.idempotentReplay ? 200 : 201,
    });
  } catch (error) {
    console.error("Error receiving inventory:", error);

    if (error instanceof InventoryLedgerServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to receive inventory",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
