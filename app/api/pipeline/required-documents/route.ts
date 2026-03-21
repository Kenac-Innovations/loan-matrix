import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getTenantBySlug,
  getOrCreateDefaultTenant,
  extractTenantSlugFromRequest,
} from "@/lib/tenant-service";

async function resolveTenant(request: NextRequest) {
  const tenantSlug = extractTenantSlugFromRequest(request);
  let tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) {
    tenant = await getOrCreateDefaultTenant();
  }
  return tenant;
}

export async function GET(request: NextRequest) {
  try {
    const tenant = await resolveTenant(request);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const documents = await prisma.requiredDocument.findMany({
      where: { tenantId: tenant.id },
      orderBy: { order: "asc" },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error("Error fetching required documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch required documents" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const tenant = await resolveTenant(request);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await request.json();
    const { documents } = body as {
      documents: {
        id?: string;
        name: string;
        description?: string;
        category: string;
        expiryMonths?: number | null;
        isRequired: boolean;
        isActive: boolean;
        order: number;
      }[];
    };

    if (!Array.isArray(documents)) {
      return NextResponse.json(
        { error: "documents array is required" },
        { status: 400 }
      );
    }

    const results = await prisma.$transaction(
      documents.map((doc, idx) => {
        if (doc.id) {
          return prisma.requiredDocument.update({
            where: { id: doc.id },
            data: {
              name: doc.name,
              description: doc.description || null,
              category: doc.category,
              expiryMonths: doc.expiryMonths ?? null,
              isRequired: doc.isRequired,
              isActive: doc.isActive,
              order: doc.order ?? idx,
            },
          });
        }
        return prisma.requiredDocument.create({
          data: {
            tenantId: tenant.id,
            name: doc.name,
            description: doc.description || null,
            category: doc.category,
            expiryMonths: doc.expiryMonths ?? null,
            isRequired: doc.isRequired,
            isActive: doc.isActive,
            order: doc.order ?? idx,
          },
        });
      })
    );

    return NextResponse.json({ success: true, documents: results });
  } catch (error) {
    console.error("Error saving required documents:", error);
    return NextResponse.json(
      { error: "Failed to save required documents" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const tenant = await resolveTenant(request);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await prisma.requiredDocument.delete({
      where: { id, tenantId: tenant.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting required document:", error);
    return NextResponse.json(
      { error: "Failed to delete required document" },
      { status: 500 }
    );
  }
}
