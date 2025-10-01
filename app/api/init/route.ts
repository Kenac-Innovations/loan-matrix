import { NextRequest, NextResponse } from "next/server";
import { seedDefaultTenant } from "@/lib/seed-tenant";

export async function POST(request: NextRequest) {
  try {
    console.log("🌱 Initializing database with default tenant...");

    // Seed the default tenant and related data
    const tenant = await seedDefaultTenant();

    return NextResponse.json({
      success: true,
      message: "Database initialized successfully",
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
    });
  } catch (error) {
    console.error("Error initializing database:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to initialize database",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check if default tenant exists
    const { getTenantBySlug } = await import("@/lib/tenant-service");
    const tenant = await getTenantBySlug("default");

    return NextResponse.json({
      initialized: !!tenant,
      tenant: tenant
        ? {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
          }
        : null,
    });
  } catch (error) {
    console.error("Error checking database status:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to check database status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
