import { NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";

/** Lists the status catalogue and its centrally configured action policies. */
export async function GET() {
  try {
    const fineractService = await getFineractServiceWithSession();
    const data = await fineractService.getClientServicingStatusDefinitions();
    return NextResponse.json(data);
  } catch (error: unknown) {
    return buildFineractErrorResponse(error, {
      action: "load",
      resource: "client servicing status configuration",
    });
  }
}
