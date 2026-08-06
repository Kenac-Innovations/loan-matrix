import { NextRequest, NextResponse } from "next/server";
import { resolveSupersetRequestContext } from "@/lib/superset-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { decision } = await resolveSupersetRequestContext(request);

  if (decision.allowed) {
    return NextResponse.json(
      { enabled: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  if (decision.status === 401 || decision.status === 403) {
    return NextResponse.json(
      { enabled: false },
      { status: decision.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { enabled: false },
    { headers: { "Cache-Control": "no-store" } }
  );
}
