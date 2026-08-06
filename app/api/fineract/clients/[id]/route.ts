import { NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { fetchFineractAPI } from "@/lib/api";
import { hasPermissionServer, hasSuperAdminServer } from "@/lib/authorization";
import {
  isSensitiveClientEditRestrictionEnabled,
  stripRestrictedClientEditFields,
} from "@/lib/client-edit-restrictions";
import { getSession } from "@/lib/auth";
import { SpecificPermission } from "@/shared/types/auth";
import {
  extractTenantSlugFromRequest,
  getTenantBySlug,
} from "@/lib/tenant-service";
import { resolveOmamaOfficeScope } from "@/lib/omama-office-scope";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";

/**
 * GET /api/fineract/clients/[id]
 * Fetches detailed client information by ID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const clientId = Number(id);

    console.log("Client Details API: Fetching client", { id, clientId });

    if (!Number.isFinite(clientId) || clientId <= 0) {
      return NextResponse.json(
        { error: `Invalid Fineract client ID: ${id}` },
        { status: 400 }
      );
    }

    const session = await getSession();
    const sessionUser = session?.user;
    const tenantSlug = extractTenantSlugFromRequest(request);
    const data = await fetchFineractAPI(`/clients/${clientId}`, {
      authMode: "service",
    });
    const officeScope = resolveOmamaOfficeScope({
      tenantSlug,
      roles: (sessionUser?.roles ?? []) as Array<{
        name?: string | null;
        disabled?: boolean | null;
      }>,
      officeId: sessionUser?.officeId ?? null,
      officeName: sessionUser?.officeName ?? null,
    });

    if (officeScope?.officeId && data?.officeId !== officeScope.officeId) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    console.log("Client Details API: Fetched client data:", {
      hasData: !!data,
      clientId: data?.id,
      clientName: data?.displayName,
    });

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Error fetching client details:", error);
    return buildFineractErrorResponse(error, {
      action: "load",
      resource: "client details",
    });
  }
}

/**
 * PUT /api/fineract/clients/[id]
 * Updates a specific client
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await hasPermissionServer(SpecificPermission.UPDATE_CLIENT))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const clientId = Number(id);
    const tenantSlug = extractTenantSlugFromRequest(request);
    const [tenant, isSuperAdmin] = await Promise.all([
      getTenantBySlug(tenantSlug),
      hasSuperAdminServer(),
    ]);
    const payload = await request.json();
    const outboundPayload =
      isSensitiveClientEditRestrictionEnabled(tenant?.settings) &&
      !isSuperAdmin
        ? stripRestrictedClientEditFields(payload)
        : payload;

    if (!Number.isFinite(clientId) || clientId <= 0) {
      return NextResponse.json(
        { error: `Invalid Fineract client ID: ${id}` },
        { status: 400 }
      );
    }

    const fineractService = await getFineractServiceWithSession();
    const data = await fineractService.updateClient(clientId, outboundPayload);

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Error updating client:", error);
    return buildFineractErrorResponse(error, {
      action: "update",
      resource: "client",
    });
  }
}

/**
 * DELETE /api/fineract/clients/[id]
 * Deletes a specific client
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await hasSuperAdminServer())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const clientId = Number(id);

    if (!Number.isFinite(clientId) || clientId <= 0) {
      return NextResponse.json(
        { error: `Invalid Fineract client ID: ${id}` },
        { status: 400 }
      );
    }

    const fineractService = await getFineractServiceWithSession();
    await fineractService.deleteClient(clientId);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error deleting client:", error);
    return buildFineractErrorResponse(error, {
      action: "delete",
      resource: "client",
    });
  }
}
