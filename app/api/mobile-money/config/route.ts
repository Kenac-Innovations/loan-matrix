import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import {
  getConfiguredMobileMoney,
  getTenantMobileMoneySettings,
} from "@/lib/mobile-money-transactions";
import type { TenantSettings } from "@/shared/types/tenant";

export async function GET() {
  try {
    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    return NextResponse.json({
      config: getTenantMobileMoneySettings(tenant.settings as TenantSettings | null),
      configured: getConfiguredMobileMoney(tenant.settings as TenantSettings | null),
    });
  } catch (error) {
    console.error("Error fetching mobile money config:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch mobile money config",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

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

    const body = await request.json();
    const {
      glAccountId,
      glAccountName,
      glAccountCode,
      defaultOfficeId,
      defaultOfficeName,
      payoutClearingGlAccountId,
      payoutClearingGlAccountName,
      payoutClearingGlAccountCode,
    } = body ?? {};

    if (
      !glAccountId ||
      !glAccountName ||
      !glAccountCode ||
      !defaultOfficeId ||
      !defaultOfficeName ||
      !payoutClearingGlAccountId ||
      !payoutClearingGlAccountName ||
      !payoutClearingGlAccountCode
    ) {
      return NextResponse.json(
        {
          error:
            "Mobile money GL account, payout clearing GL account, and default office are required.",
        },
        { status: 400 }
      );
    }

    const currentSettings = (tenant.settings as Record<string, unknown>) || {};
    const updatedSettings = {
      ...currentSettings,
      mobileMoney: {
        glAccountId: Number(glAccountId),
        glAccountName: String(glAccountName),
        glAccountCode: String(glAccountCode),
        defaultOfficeId: Number(defaultOfficeId),
        defaultOfficeName: String(defaultOfficeName),
        payoutClearingGlAccountId: Number(payoutClearingGlAccountId),
        payoutClearingGlAccountName: String(payoutClearingGlAccountName),
        payoutClearingGlAccountCode: String(payoutClearingGlAccountCode),
      },
    };

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { settings: updatedSettings },
      select: { settings: true },
    });

    return NextResponse.json({
      success: true,
      config: getTenantMobileMoneySettings(
        updatedTenant.settings as TenantSettings | null
      ),
      configured: getConfiguredMobileMoney(
        updatedTenant.settings as TenantSettings | null
      ),
    });
  } catch (error) {
    console.error("Error updating mobile money config:", error);
    return NextResponse.json(
      {
        error: "Failed to update mobile money config",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
