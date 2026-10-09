import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { hasSuperAdminServer } from "@/lib/authorization";
import { nextTenantSessionSettings } from "@/lib/cashier-session-admin";
import { getCashierSessionTenantSettings } from "@/lib/cashier-session-settings";

/**
 * GET /api/tenant/teller-session-settings
 * Get tenant's teller session closure settings and edit permissions.
 * Allowed for any authenticated user of the tenant.
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenant = await getTenantFromHeaders();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Fetch settings directly from tenant record
    const settings = await getCashierSessionTenantSettings(tenant.id);
    const canEdit = await hasSuperAdminServer();

    return NextResponse.json({
      isTellerManagementModuleOn: settings.isTellerManagementModuleOn,
      enforceSessionClosureByDefault: settings.enforceSessionClosureByDefault,
      sessionClosureEnforcedFrom: settings.sessionClosureEnforcedFrom,
      cashVarianceTolerance: settings.cashVarianceTolerance,
      updatedBy: (await prisma.tenant.findUnique({
        where: { id: tenant.id },
        select: { sessionClosureSettingsUpdatedBy: true },
      }))?.sessionClosureSettingsUpdatedBy,
      updatedAt: (await prisma.tenant.findUnique({
        where: { id: tenant.id },
        select: { sessionClosureSettingsUpdatedAt: true },
      }))?.sessionClosureSettingsUpdatedAt,
      canEdit,
    });
  } catch (error) {
    console.error("Error fetching teller session settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch teller session settings" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/tenant/teller-session-settings
 * Update tenant's teller session closure settings (super admin only).
 */
export async function PUT(request: NextRequest) {
  try {
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

    // Validate input types
    if (body.isTellerManagementModuleOn !== undefined && typeof body.isTellerManagementModuleOn !== "boolean") {
      return NextResponse.json(
        { error: "isTellerManagementModuleOn must be a boolean" },
        { status: 400 }
      );
    }

    if (body.enforceSessionClosureByDefault !== undefined && typeof body.enforceSessionClosureByDefault !== "boolean") {
      return NextResponse.json(
        { error: "enforceSessionClosureByDefault must be a boolean" },
        { status: 400 }
      );
    }

    if (body.cashVarianceTolerance !== undefined && typeof body.cashVarianceTolerance !== "number") {
      return NextResponse.json(
        { error: "cashVarianceTolerance must be a number" },
        { status: 400 }
      );
    }

    // Fetch current settings
    const currentRaw = await getCashierSessionTenantSettings(tenant.id);
    const currentSettings = {
      isTellerManagementModuleOn: currentRaw.isTellerManagementModuleOn,
      enforceSessionClosureByDefault: currentRaw.enforceSessionClosureByDefault,
      sessionClosureEnforcedFrom: currentRaw.sessionClosureEnforcedFrom,
      cashVarianceTolerance: currentRaw.cashVarianceTolerance,
      tellerModuleEnabledAt: currentRaw.tellerModuleEnabledAt ?? null,
    };

    // Validate and compute new settings
    const result = nextTenantSessionSettings(
      currentSettings,
      {
        isTellerManagementModuleOn:
          body.isTellerManagementModuleOn !== undefined
            ? body.isTellerManagementModuleOn
            : undefined,
        enforceSessionClosureByDefault:
          body.enforceSessionClosureByDefault !== undefined
            ? body.enforceSessionClosureByDefault
            : undefined,
        cashVarianceTolerance:
          body.cashVarianceTolerance !== undefined
            ? body.cashVarianceTolerance
            : undefined,
      },
      session.user.id,
      new Date()
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Update tenant record
    const updatedTenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        isTellerManagementModuleOn: result.data.isTellerManagementModuleOn,
        enforceSessionClosureByDefault: result.data.enforceSessionClosureByDefault,
        sessionClosureEnforcedFrom: result.data.sessionClosureEnforcedFrom,
        tellerModuleEnabledAt: result.data.tellerModuleEnabledAt,
        cashVarianceTolerance: result.data.cashVarianceTolerance,
        sessionClosureSettingsUpdatedBy: result.data.sessionClosureSettingsUpdatedBy,
        sessionClosureSettingsUpdatedAt: result.data.sessionClosureSettingsUpdatedAt,
      },
      select: {
        id: true,
        isTellerManagementModuleOn: true,
        enforceSessionClosureByDefault: true,
        sessionClosureEnforcedFrom: true,
        cashVarianceTolerance: true,
        sessionClosureSettingsUpdatedBy: true,
        sessionClosureSettingsUpdatedAt: true,
      },
    });

    return NextResponse.json({
      isTellerManagementModuleOn: updatedTenant.isTellerManagementModuleOn,
      enforceSessionClosureByDefault: updatedTenant.enforceSessionClosureByDefault,
      sessionClosureEnforcedFrom: updatedTenant.sessionClosureEnforcedFrom,
      cashVarianceTolerance: updatedTenant.cashVarianceTolerance,
      updatedBy: updatedTenant.sessionClosureSettingsUpdatedBy,
      updatedAt: updatedTenant.sessionClosureSettingsUpdatedAt,
      canEdit: true,
    });
  } catch (error) {
    console.error("Error updating teller session settings:", error);
    return NextResponse.json(
      { error: "Failed to update teller session settings" },
      { status: 500 }
    );
  }
}
