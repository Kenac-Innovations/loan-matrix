import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";

/**
 * POST /api/receipts/validate
 *
 * Validates a receipt number:
 *  1. Strips prefix if present and checks the numeric part is within an active range
 *  2. Checks the receipt number hasn't already been used
 *
 * Body: { receiptNumber: string }
 *
 * Also used to *record* usage when `markUsed: true` is passed:
 * Body: { receiptNumber: string, markUsed: true, transactionType: string, fineractTxnId?: string, loanId?: number, usedBy?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await request.json();
    const { receiptNumber, markUsed, transactionType, fineractTxnId, loanId, usedBy } = body;

    if (!receiptNumber || typeof receiptNumber !== "string") {
      return NextResponse.json(
        { valid: false, error: "Receipt number is required" },
        { status: 400 }
      );
    }

    const trimmed = receiptNumber.trim();

    // Find all active ranges for this tenant
    const activeRanges = await prisma.receiptRange.findMany({
      where: { tenantId: tenant.id, isActive: true },
    });

    if (activeRanges.length === 0) {
      return NextResponse.json(
        { valid: false, error: "No active receipt ranges configured" },
        { status: 400 }
      );
    }

    // Try to match against each active range
    let matched = false;
    for (const range of activeRanges) {
      let numericStr = trimmed;

      // Strip prefix if range has one
      if (range.prefix) {
        if (trimmed.startsWith(range.prefix)) {
          numericStr = trimmed.slice(range.prefix.length);
        } else {
          continue; // prefix doesn't match, try next range
        }
      }

      const num = parseInt(numericStr, 10);
      if (isNaN(num)) continue;

      if (num >= range.rangeStart && num <= range.rangeEnd) {
        matched = true;
        break;
      }
    }

    if (!matched) {
      const rangeDescriptions = activeRanges
        .map((r) => `${r.prefix ?? ""}${r.rangeStart}–${r.prefix ?? ""}${r.rangeEnd}`)
        .join(", ");
      return NextResponse.json({
        valid: false,
        error: `Receipt number is outside allowed ranges: ${rangeDescriptions}`,
      });
    }

    // Check if already used
    const existing = await prisma.usedReceipt.findUnique({
      where: {
        tenantId_receiptNumber: {
          tenantId: tenant.id,
          receiptNumber: trimmed,
        },
      },
    });

    if (existing) {
      return NextResponse.json({
        valid: false,
        error: `Receipt number ${trimmed} has already been used`,
        usedAt: existing.usedAt,
        usedBy: existing.usedBy,
        transactionType: existing.transactionType,
      });
    }

    // If markUsed, record it
    if (markUsed) {
      if (!transactionType) {
        return NextResponse.json(
          { valid: false, error: "transactionType is required when marking as used" },
          { status: 400 }
        );
      }

      await prisma.usedReceipt.create({
        data: {
          tenantId: tenant.id,
          receiptNumber: trimmed,
          transactionType,
          fineractTxnId: fineractTxnId ?? null,
          loanId: loanId ?? null,
          usedBy: usedBy ?? null,
        },
      });
    }

    return NextResponse.json({ valid: true, receiptNumber: trimmed });
  } catch (error) {
    console.error("Error validating receipt:", error);
    return NextResponse.json(
      { valid: false, error: "Failed to validate receipt number" },
      { status: 500 }
    );
  }
}
