import { NextRequest, NextResponse } from "next/server";
import { triggerRecoveryReminders } from "@/lib/fineract-recoveries";
import { extractTenantSlugFromRequest } from "@/lib/tenant-service";

function normalizeReminderBucket(value: unknown): "30" | "60" | "90" {
  return value === "60" || value === "90" ? value : "30";
}

function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function isAuthorizedCronRequest(request: NextRequest): boolean {
  const expected = process.env.RECOVERY_TRIGGER_API_KEY || process.env.CRON_API_KEY;
  if (!expected) return false;

  const provided =
    request.headers.get("x-recovery-trigger-key") ||
    request.headers.get("x-cron-api-key") ||
    getBearerToken(request);

  return provided === expected;
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorizedCronRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const bucket = normalizeReminderBucket(body.bucket);
    const limit = Number(body.limit);
    const tenantSlug =
      typeof body.tenantSlug === "string" && body.tenantSlug.trim()
        ? body.tenantSlug.trim()
        : extractTenantSlugFromRequest(request);

    const result = await triggerRecoveryReminders({
      bucket,
      limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
      tenantSlug,
      actorName:
        typeof body.actorName === "string" && body.actorName.trim()
          ? body.actorName.trim()
          : "K8s reminder trigger",
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error running recovery reminder cron trigger:", error);
    return NextResponse.json(
      {
        error: "Failed to run recovery reminder cron trigger",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
