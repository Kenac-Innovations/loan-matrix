import { NextResponse } from "next/server";
import { hasPermissionServer } from "@/lib/authorization";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";
import { SpecificPermission } from "@/shared/types/auth";

/** Changes the centrally enforced action policy for one servicing status. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ statusCode: string }> }
) {
  try {
    if (
      !(await hasPermissionServer(
        SpecificPermission.UPDATE_CLIENT_SERVICING_STATUS_POLICY
      ))
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { statusCode } = await params;
    const payload = await request.json();
    const fineractService = await getFineractServiceWithSession();
    const data = await fineractService.updateClientServicingStatusPolicies(
      statusCode,
      payload
    );

    return NextResponse.json(data);
  } catch (error: unknown) {
    return buildFineractErrorResponse(error, {
      action: "update",
      resource: "client servicing status policy",
    });
  }
}
