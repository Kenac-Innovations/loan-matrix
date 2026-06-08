import { NextRequest, NextResponse } from "next/server";
import { triggerRecoveryReminders } from "@/lib/fineract-recoveries";
import { extractTenantSlugFromRequest } from "@/lib/tenant-service";
import { getActorName } from "@/app/api/recoveries/_utils";

function normalizeReminderBucket(value: unknown): "30" | "60" | "90" {
  return value === "60" || value === "90" ? value : "30";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const bucket = normalizeReminderBucket(body.bucket);
    const limit = Number(body.limit);
    const actorName =
      typeof body.actorName === "string" && body.actorName.trim()
        ? body.actorName.trim()
        : await getActorName("K8s reminder trigger");

    const result = await triggerRecoveryReminders({
      bucket,
      limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
      tenantSlug: extractTenantSlugFromRequest(request),
      actorName,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error triggering recovery reminders:", error);
    return NextResponse.json(
      {
        error: "Failed to trigger recovery reminders",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
