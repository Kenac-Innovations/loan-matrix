import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateDefaultTenant } from "@/lib/tenant-service";
import { TenantMetricSettings } from "@/app/actions/leads-actions";

// GET current tenant settings
export async function GET() {
  try {
    const tenant = await getOrCreateDefaultTenant();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const settings = (tenant.settings as TenantMetricSettings) || {};

    // Return settings with defaults
    return NextResponse.json({
      monthlyTarget: settings.monthlyTarget ?? 50,
      conversionTarget: settings.conversionTarget ?? 75,
      processingTimeTarget: settings.processingTimeTarget ?? 10,
    });
  } catch (error) {
    console.error("Error fetching tenant settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch tenant settings" },
      { status: 500 }
    );
  }
}

// PUT/PATCH to update tenant settings
export async function PUT(request: NextRequest) {
  try {
    const tenant = await getOrCreateDefaultTenant();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await request.json();
    const { monthlyTarget, conversionTarget, processingTimeTarget } = body;

    // Get existing settings
    const existingSettings = (tenant.settings as Record<string, any>) || {};

    // Merge with new settings
    const updatedSettings = {
      ...existingSettings,
      ...(monthlyTarget !== undefined && { monthlyTarget }),
      ...(conversionTarget !== undefined && { conversionTarget }),
      ...(processingTimeTarget !== undefined && { processingTimeTarget }),
    };

    // Update tenant
    const updatedTenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { settings: updatedSettings },
    });

    return NextResponse.json({
      message: "Settings updated successfully",
      settings: updatedSettings,
    });
  } catch (error) {
    console.error("Error updating tenant settings:", error);
    return NextResponse.json(
      { error: "Failed to update tenant settings" },
      { status: 500 }
    );
  }
}
