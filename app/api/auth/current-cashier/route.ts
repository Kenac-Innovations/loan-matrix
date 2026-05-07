import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { resolveCurrentUserCashierContext } from "@/lib/current-user-cashier";
import { getTenantFromHeaders } from "@/lib/tenant-service";

export async function GET() {
  try {
    const [session, tenant] = await Promise.all([
      getSession(),
      getTenantFromHeaders(),
    ]);

    if (!session?.user?.userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      );
    }

    const context = await resolveCurrentUserCashierContext(
      tenant.id,
      session.user.userId
    );

    return NextResponse.json(context);
  } catch (error) {
    console.error("Error resolving current cashier context:", error);
    return NextResponse.json(
      {
        error: "Failed to resolve current cashier context",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
