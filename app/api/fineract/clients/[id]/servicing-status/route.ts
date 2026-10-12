import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermissionServer } from "@/lib/authorization";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";
import { SpecificPermission } from "@/shared/types/auth";

function clientIdFrom(value: string): number | null {
  const clientId = Number(value);
  return Number.isSafeInteger(clientId) && clientId > 0 ? clientId : null;
}

function fineractStatusOf(error: unknown): number | undefined {
  const e = error as { status?: number; response?: { status?: number } };
  return typeof e?.status === "number" ? e.status : e?.response?.status;
}

/**
 * Retrieves the current servicing status, restrictions, and immutable audit history.
 * When Fineract refuses because the client is outside the user's office hierarchy
 * (e.g. a "Different Branch" client about to be transferred), falls back to the
 * service account and returns the status and policies only.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const clientId = clientIdFrom(id);
    if (clientId === null) {
      return NextResponse.json({ error: "Invalid client ID" }, { status: 400 });
    }

    const fineractService = await getFineractServiceWithSession();
    try {
      const data = await fineractService.getClientServicingStatus(clientId);
      return NextResponse.json(data);
    } catch (error: unknown) {
      const session = await getSession();
      if (fineractStatusOf(error) !== 403 || !session?.user?.id) {
        throw error;
      }
      const data = await fineractService.getClientServicingStatusWithServiceAuth(clientId);
      return NextResponse.json(data);
    }
  } catch (error: unknown) {
    return buildFineractErrorResponse(error, {
      action: "load",
      resource: "client servicing status",
    });
  }
}

/** Applies a servicing status immediately; Fineract requires a non-empty reason. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (
      !(await hasPermissionServer(
        SpecificPermission.UPDATE_CLIENT_SERVICING_STATUS
      ))
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const clientId = clientIdFrom(id);
    if (clientId === null) {
      return NextResponse.json({ error: "Invalid client ID" }, { status: 400 });
    }

    const payload = await request.json();
    const fineractService = await getFineractServiceWithSession();
    const data = await fineractService.updateClientServicingStatus(
      clientId,
      payload
    );
    return NextResponse.json(data);
  } catch (error: unknown) {
    return buildFineractErrorResponse(error, {
      action: "update",
      resource: "client servicing status",
    });
  }
}
