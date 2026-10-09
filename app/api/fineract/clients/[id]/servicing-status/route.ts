import { NextResponse } from "next/server";
import { hasPermissionServer } from "@/lib/authorization";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";
import { SpecificPermission } from "@/shared/types/auth";

function clientIdFrom(value: string): number | null {
  const clientId = Number(value);
  return Number.isSafeInteger(clientId) && clientId > 0 ? clientId : null;
}

/** Retrieves the current servicing status, restrictions, and immutable audit history. */
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
    const data = await fineractService.getClientServicingStatus(clientId);
    return NextResponse.json(data);
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
