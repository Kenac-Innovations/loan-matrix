import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTenantSlugFromRequest } from "@/lib/tenant-service";
import { DEFAULT_FEATURES, TenantFeatures } from "@/shared/types/tenant";

/**
 * GET /api/tenant/features
 * Fetch feature flags for the current tenant
 */
export async function GET(request: NextRequest) {
  try {
    const tenantSlug = extractTenantSlugFromRequest(request);
    
    const tenant = await prisma.tenant.findFirst({
      where: { slug: tenantSlug, isActive: true },
      select: {
        id: true,
        slug: true,
        settings: true,
      },
    });
    
    if (!tenant) {
      return NextResponse.json({
        features: DEFAULT_FEATURES,
        tenantSlug,
        error: "Tenant not found, using defaults",
      });
    }
    
    // Extract features from settings, merging with defaults
    const settings = tenant.settings as any;
    const features: TenantFeatures = {
      ...DEFAULT_FEATURES,
      ...settings?.features,
    };
    
    return NextResponse.json({
      features,
      tenantSlug: tenant.slug,
    });
  } catch (error) {
    console.error("Error fetching tenant features:", error);
    return NextResponse.json(
      {
        features: DEFAULT_FEATURES,
        error: "Failed to fetch tenant features",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/tenant/features
 * Update feature flags for the current tenant (admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    const tenantSlug = extractTenantSlugFromRequest(request);
    const body = await request.json();
    const { features } = body;
    
    if (!features || typeof features !== "object") {
      return NextResponse.json(
        { error: "Invalid features object" },
        { status: 400 }
      );
    }
    
    const tenant = await prisma.tenant.findFirst({
      where: { slug: tenantSlug, isActive: true },
    });
    
    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      );
    }
    
    // Get current settings and merge with new features
    const currentSettings = (tenant.settings as any) || {};
    const updatedSettings = {
      ...currentSettings,
      features: {
        ...DEFAULT_FEATURES,
        ...currentSettings.features,
        ...features,
      },
    };
    
    // Update tenant settings
    const updatedTenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        settings: updatedSettings,
      },
      select: {
        id: true,
        slug: true,
        settings: true,
      },
    });
    
    return NextResponse.json({
      success: true,
      features: (updatedTenant.settings as any)?.features || DEFAULT_FEATURES,
      tenantSlug: updatedTenant.slug,
    });
  } catch (error) {
    console.error("Error updating tenant features:", error);
    return NextResponse.json(
      { error: "Failed to update tenant features" },
      { status: 500 }
    );
  }
}
