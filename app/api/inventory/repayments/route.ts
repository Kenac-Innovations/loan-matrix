import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import {
  InventoryLedgerServiceError,
  type InventoryDb,
} from "@/lib/inventory/inventory-ledger-service";
import { recordInventoryRepayment } from "@/lib/inventory/inventory-repayment-service";

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
    const stockLoanIssueId = String(body.stockLoanIssueId ?? "").trim();
    const amount = String(body.amount ?? "").trim();
    const currencyCode = String(body.currencyCode ?? "USD").trim().toUpperCase();
    const reference = String(body.reference ?? "").trim();
    const notes = String(body.notes ?? "").trim();
    const paymentDateValue = String(body.paymentDate ?? "").trim();
    const paymentDate = paymentDateValue ? new Date(paymentDateValue) : new Date();
    const idempotencyKey =
      typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
        ? body.idempotencyKey.trim()
        : `inventory-repayment:${tenant.id}:${randomUUID()}`;

    if (!stockLoanIssueId || !amount || Number.isNaN(paymentDate.getTime())) {
      return NextResponse.json(
        {
          error: "Missing required fields: stockLoanIssueId, amount, paymentDate",
        },
        { status: 400 }
      );
    }

    const result = await recordInventoryRepayment(prisma as unknown as InventoryDb, {
      tenantId: tenant.id,
      stockLoanIssueId,
      amount,
      currencyCode,
      paymentDate,
      reference,
      notes,
      actorUserId: String(sessionUserValue(session, "userId") ?? session.user.id),
      actorUserName: String(sessionUserValue(session, "name") ?? session.user.name ?? ""),
      idempotencyKey,
    });

    return NextResponse.json(result, {
      status: result.idempotentReplay ? 200 : 201,
    });
  } catch (error) {
    console.error("Error recording inventory repayment:", error);

    if (error instanceof InventoryLedgerServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to record inventory repayment",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
