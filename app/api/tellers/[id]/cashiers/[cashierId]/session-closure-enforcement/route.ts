import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { hasSuperAdminServer } from "@/lib/authorization";
import {
  isEnforcementMode,
  nextCashierEnforcementFields,
} from "@/lib/cashier-session-admin";
import {
  getCashierSessionTenantSettings,
  type CashierSessionTenantSettings,
} from "@/lib/cashier-session-settings";
import { resolveSessionClosureEnforcement } from "@/lib/cashier-session-enforcement-policy";

/**
 * PUT /api/tellers/[id]/cashiers/[cashierId]/session-closure-enforcement
 * Set per-cashier enforcement mode (super admin only).
 *
 * Request body: { mode: "ENFORCE" | "EXEMPT" | "INHERIT" }
 * Response: { mode, enforcement: { enforced, source/reason, enforcedFrom? } }
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string; cashierId: string }> }
) {
  try {
    const params = await context.params;
    const { id: tellerIdParam, cashierId } = params;
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await hasSuperAdminServer())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { mode } = body;

    // Validate mode
    if (!isEnforcementMode(mode)) {
      return NextResponse.json(
        { error: "Invalid mode. Must be ENFORCE, EXEMPT, or INHERIT." },
        { status: 400 }
      );
    }

    // Resolve teller: try DB ID first, then Fineract ID
    let teller = await prisma.teller.findFirst({
      where: { id: tellerIdParam, tenantId: tenant.id },
    });

    if (!teller) {
      const fineractTellerId = parseInt(tellerIdParam);
      if (!isNaN(fineractTellerId)) {
        teller = await prisma.teller.findFirst({
          where: { fineractTellerId, tenantId: tenant.id },
        });
      }
    }

    if (!teller) {
      return NextResponse.json({ error: "Teller not found" }, { status: 404 });
    }

    // Resolve cashier: try DB ID first, then Fineract ID, all within teller
    let cashier = await prisma.cashier.findFirst({
      where: { id: cashierId, tellerId: teller.id, tenantId: tenant.id },
    });

    if (!cashier) {
      const fineractCashierId = parseInt(cashierId);
      if (!isNaN(fineractCashierId)) {
        cashier = await prisma.cashier.findFirst({
          where: {
            fineractCashierId,
            tellerId: teller.id,
            tenantId: tenant.id,
          },
        });
      }
    }

    if (!cashier) {
      return NextResponse.json({ error: "Cashier not found" }, { status: 404 });
    }

    // Compute new enforcement fields
    const updateData = nextCashierEnforcementFields(
      {
        enforceSessionClosure: cashier.enforceSessionClosure,
        sessionClosureEnforcedFrom: cashier.sessionClosureEnforcedFrom,
      },
      mode,
      session.user.id,
      new Date()
    );

    // Update cashier record
    const updatedCashier = await prisma.cashier.update({
      where: { id: cashier.id },
      data: updateData,
    });

    // Fetch tenant settings to resolve enforcement
    const settings = await getCashierSessionTenantSettings(tenant.id);

    // Resolve the enforcement state
    const enforcement = resolveSessionClosureEnforcement(
      settings as CashierSessionTenantSettings,
      updatedCashier
    );

    return NextResponse.json({
      mode,
      enforcement,
    });
  } catch (error) {
    console.error("Error updating cashier session-closure enforcement:", error);
    return NextResponse.json(
      {
        error: "Failed to update cashier session-closure enforcement",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
