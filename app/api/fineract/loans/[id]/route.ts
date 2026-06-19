import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { extractTenantSlugFromRequest } from "@/lib/tenant-service";
import { resolveOmamaOfficeScope } from "@/lib/omama-office-scope";

/**
 * GET /api/fineract/loans/[id]
 * Gets a specific loan by ID with optional associations
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const session = await getSession();
    const tenantSlug = extractTenantSlugFromRequest(request);

    const associations = searchParams.get("associations") || "all";
    const exclude = searchParams.get("exclude");
    const fineractQuery = new URLSearchParams({ associations });
    if (exclude) {
      fineractQuery.set("exclude", exclude);
    }

    const data = await fetchFineractAPI(`/loans/${id}?${fineractQuery.toString()}`, {
      authMode: "service",
    });
    const officeScope = resolveOmamaOfficeScope({
      tenantSlug,
      roles: ((session?.user as any)?.roles || []) as Array<{
        name?: string | null;
        disabled?: boolean | null;
      }>,
      officeId: ((session?.user as any)?.officeId as number | undefined) ?? null,
      officeName: ((session?.user as any)?.officeName as string | undefined) ?? null,
    });
    const loanOfficeId =
      typeof data?.clientOfficeId === "number"
        ? data.clientOfficeId
        : typeof data?.officeId === "number"
          ? data.officeId
          : null;

    if (officeScope?.officeId && loanOfficeId !== officeScope.officeId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Return the data as-is to preserve the original structure
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching loan:", error);
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/fineract/loans/[id]
 * Updates a specific loan
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await request.json();
    const data = await fetchFineractAPI(`/loans/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error updating loan:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/fineract/loans/[id]
 * Deletes a specific loan
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await fetchFineractAPI(`/loans/${id}`, {
      method: "DELETE",
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting loan:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
