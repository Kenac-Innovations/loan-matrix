import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import {
  issueInventoryStock,
} from "@/lib/inventory/inventory-issue-service";
import {
  InventoryLedgerServiceError,
  type InventoryDb,
} from "@/lib/inventory/inventory-ledger-service";

function sessionUserValue(session: Awaited<ReturnType<typeof getSession>>, key: string) {
  return (session?.user as Record<string, unknown> | undefined)?.[key];
}

function decimalToString(value: unknown): string {
  return value == null ? "0" : String(value);
}

function serializeIssue(issue: Record<string, unknown> | null) {
  if (!issue) return null;

  return {
    ...issue,
    totalValue: decimalToString(issue.totalValue),
    issuedAt:
      issue.issuedAt instanceof Date
        ? issue.issuedAt.toISOString()
        : issue.issuedAt,
    createdAt:
      issue.createdAt instanceof Date
        ? issue.createdAt.toISOString()
        : issue.createdAt,
    updatedAt:
      issue.updatedAt instanceof Date
        ? issue.updatedAt.toISOString()
        : issue.updatedAt,
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

    const issues = await prisma.stockLoanIssue.findMany({
      where: { tenantId: tenant.id },
      include: {
        lines: {
          include: {
            inventoryItem: {
              select: {
                id: true,
                sku: true,
                name: true,
                unitOfMeasure: true,
              },
            },
          },
        },
        repayments: {
          orderBy: { paymentDate: "desc" },
        },
      },
      orderBy: { issuedAt: "desc" },
      take: 100,
    });

    return NextResponse.json(
      issues.map((issue) => ({
        ...serializeIssue(issue as unknown as Record<string, unknown>),
        lines: issue.lines.map((line) => ({
          ...line,
          quantity: decimalToString(line.quantity),
          issuedQuantity: decimalToString(line.issuedQuantity),
          unitValue: decimalToString(line.unitValue),
          lineValue: decimalToString(line.lineValue),
        })),
        repayments: issue.repayments.map((repayment) => ({
          ...repayment,
          amount: decimalToString(repayment.amount),
          paymentDate: repayment.paymentDate.toISOString(),
          createdAt: repayment.createdAt.toISOString(),
          updatedAt: repayment.updatedAt.toISOString(),
        })),
      }))
    );
  } catch (error) {
    console.error("Error fetching inventory issues:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch inventory issues",
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
    const inventoryItemId = String(body.inventoryItemId ?? "").trim();
    const fineractOfficeId = Number(body.fineractOfficeId);
    const fineractOfficeName = String(body.fineractOfficeName ?? "").trim();
    const quantity = String(body.quantity ?? "").trim();
    const unitValue = String(body.unitValue ?? "").trim();
    const currencyCode = String(body.currencyCode ?? "USD").trim().toUpperCase();
    const borrowerName = String(body.borrowerName ?? "").trim();
    const loanAccountNo = String(body.loanAccountNo ?? "").trim();
    const externalReference = String(body.externalReference ?? "").trim();
    const notes = String(body.notes ?? "").trim();
    const fineractLoanId = body.fineractLoanId == null ? undefined : Number(body.fineractLoanId);
    const leadId = typeof body.leadId === "string" && body.leadId.trim() ? body.leadId.trim() : undefined;
    const idempotencyKey =
      typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
        ? body.idempotencyKey.trim()
        : `inventory-issue:${tenant.id}:${randomUUID()}`;

    if (
      !inventoryItemId ||
      !Number.isInteger(fineractOfficeId) ||
      !quantity ||
      !unitValue
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: inventoryItemId, fineractOfficeId, quantity, unitValue",
        },
        { status: 400 }
      );
    }

    const result = await issueInventoryStock(prisma as unknown as InventoryDb, {
      tenantId: tenant.id,
      inventoryItemId,
      fineractOfficeId,
      fineractOfficeName,
      quantity,
      unitValue,
      currencyCode,
      borrowerName,
      loanAccountNo,
      externalReference,
      leadId,
      fineractLoanId,
      actorUserId: String(sessionUserValue(session, "userId") ?? session.user.id),
      actorUserName: String(sessionUserValue(session, "name") ?? session.user.name ?? ""),
      notes,
      idempotencyKey,
    });

    return NextResponse.json(result, {
      status: result.idempotentReplay ? 200 : 201,
    });
  } catch (error) {
    console.error("Error issuing inventory stock:", error);

    if (error instanceof InventoryLedgerServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to issue inventory stock",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
