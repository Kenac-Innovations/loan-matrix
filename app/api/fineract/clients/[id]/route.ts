import { NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { fetchFineractAPI } from "@/lib/api";
import { hasSuperAdminServer } from "@/lib/authorization";
import { getSession } from "@/lib/auth";
import { extractTenantSlugFromRequest } from "@/lib/tenant-service";
import { resolveOmamaOfficeScope } from "@/lib/omama-office-scope";

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
    const tenantSlug = extractTenantSlugFromRequest(request);
    const data = await fetchFineractAPI(`/clients/${clientId}`, {
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

    // Better error handling for different error types
    const errorObj = error as {
      message?: string;
      errorData?: { defaultUserMessage?: string };
      status?: number;
    };
    const errorMessage =
      errorObj?.message ||
      errorObj?.errorData?.defaultUserMessage ||
      "Unknown error";
    const statusCode = errorObj?.status || 500;

    return NextResponse.json(
      {
        error: errorMessage,
        details: error?.errorData || null,
      },
      { status: statusCode }
    );
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
    if (!(await hasSuperAdminServer())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const clientId = Number(id);
    const payload = await request.json();

    if (!Number.isFinite(clientId) || clientId <= 0) {
      return NextResponse.json(
        { error: `Invalid Fineract client ID: ${id}` },
        { status: 400 }
      );
    }

    const fineractService = await getFineractServiceWithSession();
    const data = await fineractService.updateClient(clientId, payload);

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Error updating client:", error);

    // Better error handling for different error types
    const errorObj = error as {
      message?: string;
      errorData?: { defaultUserMessage?: string };
      status?: number;
    };
    const errorMessage =
      errorObj?.message ||
      errorObj?.errorData?.defaultUserMessage ||
      "Unknown error";
    const statusCode = errorObj?.status || 500;

    return NextResponse.json(
      {
        error: errorMessage,
        details: error?.errorData || null,
      },
      { status: statusCode }
    );
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

    // Better error handling for different error types
    const errorObj = error as {
      message?: string;
      errorData?: { defaultUserMessage?: string };
      status?: number;
    };
    const errorMessage =
      errorObj?.message ||
      errorObj?.errorData?.defaultUserMessage ||
      "Unknown error";
    const statusCode = errorObj?.status || 500;

    return NextResponse.json(
      {
        error: errorMessage,
        details: error?.errorData || null,
      },
      { status: statusCode }
    );
  }
}
